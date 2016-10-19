#!/usr/bin/env node

const buildImage = require('../')
const pkg = require('../package.json')
const cmdName = Object.keys(pkg.bin)[0]

const pathToApp = process.cwd()

const mode = process.argv[2]
if (!mode) {
  throw new Error(`<mode> is required`)
}

buildImage(pathToApp, mode)
  .catch(err => {
    console.error(err)
    process.exit(1)
  })
