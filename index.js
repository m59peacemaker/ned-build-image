const {join: joinPath} = require('path')
const {spawn} = require('child_process')
const fs = require('fs-promise')
const denodeify = require('denodeify')
const writeFile = denodeify(require('output-file'))
const rimraf = denodeify(require('rimraf'))
const uuid = require('uuid-v4')
const pkg = require('./package.json')

const nedVersion = '0.0.3'
const defaultBaseImage = 'mhart/alpine-node:6'

const makeBaseImage = (pathToApp, DockerfilePath) => new Promise((resolve, reject) => {
  spawn(
    'docker', ['build', '-t', `ned-app-base`, '--file', DockerfilePath, './'],
    {stdio: 'inherit', cwd: pathToApp}
  ).on('close', exitCode => exitCode ? reject() : resolve())
})

const sharedContents = ({from}) => `
  FROM ${from}

  ${from === 'ned-app-base' ? '' : 'RUN apk update && apk add python make g++'}

  RUN npm install -g ned@${nedVersion}

  COPY ./package.json /app/
  WORKDIR /app
  RUN npm install
`

const devContents = `
  ENTRYPOINT ["ned"]
  CMD ["dev", "-ltw"]
`

const prodContents = `
  COPY ./ /app/
  RUN ned transpile src build
  CMD ["node", "./build"]
`

const getDockerfileContents = (baseImageName, mode) => `
  ${sharedContents({from: baseImageName})}
  ${mode === 'dev' ? devContents : prodContents}
`

const dockerBuild = (appPath, mode, DockerfilePath) => new Promise((resolve, reject) => {
  spawn(
    'docker', ['build', '-t', `ned-app-${mode}`, '-f', DockerfilePath, './'],
    {stdio: 'inherit', cwd: appPath}
  ).on('close', exitCode => exitCode ? reject() : resolve())
})

const buildImage = (pathToApp, mode) => {
  if (!(mode === 'dev' || mode === 'prod')) {
    throw new Error(`"mode" must be "dev" or "prod". "${mode}" given.`)
  }

  const appPath = relativePath => joinPath(pathToApp, relativePath)
  const tmpDir = appPath(`tmp_${pkg.name}_${uuid()}`)
  const tmpPath = relativePath => joinPath(tmpDir, relativePath)
  const cleanup = () => Promise.all([
    rimraf(tmpDir),
    new Promise((resolve, reject) => {
      spawn('docker', ['rmi', 'ned-app-base'], {stdio: 'inherit'}).on('close', resolve)
    })
  ])

  // try to read Dockerfile before trying to docker build
  //   to avoid docker logging an error if it doesn't exist
  return fs.readFile(appPath('Dockerfile'))
    .then(() => makeBaseImage(pathToApp, appPath('Dockerfile')))
    .then(() => 'ned-app-base')
    .catch(() => defaultBaseImage)
    .then(baseImageName => {
      const DockerfileContents = getDockerfileContents(baseImageName, mode)
      return writeFile(tmpPath('Dockerfile'), DockerfileContents)
    })
    .then(() => dockerBuild(pathToApp, mode, tmpPath('Dockerfile')))
    .then(cleanup)
    .catch(err => cleanup().then(() => { throw err }))
}

module.exports = buildImage
