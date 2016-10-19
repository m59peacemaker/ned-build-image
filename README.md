# ned-build-image

Builds a docker image for running a node application developed with [ned](https://www.npmjs.com/package/ned).

## install

```sh
npm install ned-build-image
```

## cli usage

```sh
ned-build-image <mode>
```

## API

### `buildImage(pathToApp, mode)`

- `pathToApp: string` path to node application
- `mode: string`
  - `'dev'` build image tagged `ned-app-dev` for development.
  - `'prod' build image tagged `ned`app-prod` for production.

## Dockerfile

If there is a `Dockerfile` in the app root, it will be built and used as the base image. It must have the following installed:

- node >= 6
- npm
- python
- make
- g++

## dev image

### run

```sh
docker run -it --rm \
-v $PWD:/app \
ned-app-dev
```

### CMD

- watches `./src` for changes
- lints app
- transpiles app
- runs app and tests

```sh
ned dev -ltw
```

### volumes

### `/app`

Mount the node application here. `./src` will be transpiled and output to `./build` when files in `./src` change.

## prod image

Contains the transpiled app under `/app/build` ready for execution.

### run

```sh
docker run -it ned-app-prod
```

### CMD

The default command just executes the app.
