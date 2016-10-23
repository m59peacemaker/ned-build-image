const {join: joinPath} = require('path')
const {spawn} = require('child_process')
const fs = require('fs-promise')
const denodeify = require('denodeify')
const rimraf = denodeify(require('rimraf'))
const uuid = require('uuid-v4')
const download = require('download')
const pkg = require('./package.json')

const nedVersion = '0.0.4'
const yarnVersion = '0.16.1'
const defaultBaseImage = 'mhart/alpine-node:6.3.1'

const makeBaseImage = (pathToApp, DockerfilePath) => new Promise((resolve, reject) => {
  spawn(
    'docker', ['build', '-t', `ned-app-base`, '--file', DockerfilePath, './'],
    {stdio: 'inherit', cwd: pathToApp}
  ).on('close', exitCode => exitCode ? reject() : resolve())
})

// try to read Dockerfile before trying to docker build
//   to avoid docker logging an error if it doesn't exist
const handleBaseImage = (pathToApp, DockerfilePath) => fs.readFile(DockerfilePath)
  .then(() => makeBaseImage(pathToApp, DockerfilePath))
  .then(() => 'ned-app-base')
  .catch(() => defaultBaseImage)

const maybeDownloadDumbInit = (mode, dest) => mode === 'prod' ?
  download('https://github.com/Yelp/dumb-init/releases/download/v1.2.0/dumb-init_1.2.0_amd64')
    .then((contents) => fs.writeFile(dest, contents)) :
  Promise.resolve()

const sharedContents = ({from, nedVersion}) => `
  FROM ${from}
  ${from === 'ned-app-base' ? '' : 'RUN apk update && apk add python make g++'}
  RUN npm install -g yarn@${yarnVersion}
  RUN yarn global add ned@${nedVersion}
`

const devContents = (pre, tmpDirname) => `
  ${pre}
  WORKDIR /app
  COPY ./${tmpDirname}/image-files/entrypoint.sh /usr/local/bin/

  ENTRYPOINT ["entrypoint.sh"]
  CMD ["ned", "dev", "-ltw"]
`

const prodContents = (pre, tmpDirname) => `
  ${pre}

  COPY ./${tmpDirname}/dumb-init /usr/local/bin/
  RUN chmod +x /usr/local/bin/dumb-init

  COPY ./ /app
  WORKDIR /app
  RUN yarn install
  RUN ned transpile src build

  RUN adduser -D node && chown -R node /app
  USER node

  ENTRYPOINT ["dumb-init", "--"]
  CMD ["node", "./build"]
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
  const tmpDirname = `tmp_${pkg.name}_${uuid()}`
  const tmpDir = appPath(tmpDirname)
  const tmpPath = relativePath => joinPath(tmpDir, relativePath)
  const cleanup = () => Promise.all([
    rimraf(tmpDir),
    new Promise((resolve, reject) => {
      spawn('docker', ['rmi', 'ned-app-base']).on('close', resolve)
    })
  ]).catch(() => {})

  return fs.mkdirs(tmpDir)
    .then(() => Promise.all([
      handleBaseImage(pathToApp, appPath('Dockerfile')),
      fs.copy(joinPath(__dirname, 'image-files'), tmpPath('image-files')),
      maybeDownloadDumbInit(mode, tmpPath('dumb-init'))
    ]))
    .then(([baseImageName]) => {
      const pre = sharedContents({from: baseImageName, nedVersion})
      const DockerfileContents = mode === 'dev' ?
        devContents(pre, tmpDirname) :
        prodContents(pre, tmpDirname)
      return fs.writeFile(tmpPath('Dockerfile'), DockerfileContents)
    })
    .then(() => dockerBuild(pathToApp, mode, tmpPath('Dockerfile')))
    .then(cleanup)
    .catch(err => cleanup().then(() => { if (err) { throw err } }))
}

module.exports = buildImage
