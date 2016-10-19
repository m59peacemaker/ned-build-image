const test = require('tape')
const {execSync} = require('child_process')
const fs = require('fs-promise')
const path = require('path')
const tryCatch = require('try_catch')
const pkg = require('../package.json')
const cmdName = Object.keys(pkg.bin)[0]
const cmdPath = require.resolve('../bin/cmd')
const buildImage = require('../')

const tmpDir = path.join('/tmp', pkg.name)
const setup = (name) => fs.copySync(path.join(__dirname, 'fixtures', name), tmpDir)
const clean = (images = []) => {
  fs.removeSync(tmpDir)
  images.forEach(i => tryCatch(() => execSync(`docker rmi ${i}`), () => {}))
}

test(`"${cmdName} dev" builds image that can transpile app`, t => {
  t.plan(1)
  setup('no-dockerfile')
  const result = tryCatch(() => {
    execSync(`${cmdPath} dev`, {cwd: tmpDir, stdio: 'inherit'})
    execSync(`docker run --rm \
      --user ${process.getuid()} \
      -v ${tmpDir}:/app \
      ned-app-dev transpile`, {cwd: tmpDir, stdio: 'inherit'})
    return execSync(`node ${path.join(tmpDir, 'build')}`)
  }, () => {})
  clean(['ned-app-dev'])
  t.equal(String(result), 'abc\n')
})

test(`"${cmdName} prod" builds image that runs app`, t => {
  t.plan(1)
  setup('no-dockerfile')
  execSync(`${cmdPath} prod`, {cwd: tmpDir, stdio: 'inherit'})
  const result = execSync(`docker run --rm ned-app-prod`)
  clean(['ned-app-prod'])
  t.equal(String(result), 'abc\n')
})

test(`"${cmdName} dev" builds image that extends from present Dockerfile`, t => {
  t.plan(1)
  setup('with-dockerfile')
  const result = tryCatch(() => {
    execSync(`${cmdPath} dev`, {cwd: tmpDir, stdio: 'inherit'})
    return execSync(`docker run --rm \
      --entrypoint /bin/sh \
      ned-app-dev -c "echo \\$FOO"`)
  }, () => {})
  clean(['ned-app-dev'])
  t.equal(String(result), 'foo\n')
})

test(`"${cmdName} prod" builds image that extends from present Dockerfile`, t => {
  t.plan(1)
  setup('with-dockerfile')
  const result = tryCatch(() => {
    execSync(`${cmdPath} prod`, {cwd: tmpDir, stdio: 'inherit'})
    return execSync(`docker run --rm \
      --entrypoint /bin/sh \
      ned-app-prod -c "echo \\$FOO"`)
  }, () => {})
  clean(['ned-app-prod'])
  t.equal(String(result), 'foo\n')
})
