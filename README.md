# Talis CDK8s constructs

A Talis library of [CDK8s](https://cdk8s.io/docs/latest/) constructs for Kubernetes-orchestrated apps, implemented in Typescript.

## Contributing

This project follows [conventional commits](https://www.conventionalcommits.org/en/v1.0.0/), and enforces this choice during the build and release cycle.

Builds are conducted by CircleCI, and upon successful build of the `main` branch, [`semantic-release`](https://semantic-release.gitbook.io/semantic-release/) will generate a new release, an appropriate version (based on commits), and release-notes to cover the content of the commit log.

## Available constructs

- `BackgroundWorker`

  - Represents a background worker that runs continuously, reads messages from a queue, and processes them.
  - Applied as a simple Deployment.
  - Supports setting a custom stop signal to allow for graceful termination.
  - Details in an [example](./examples/background-worker/README.md).

- `ConfigMap`

  - Represents a Kubernetes ConfigMap.
  - Supports setting a key/value from a file.
  - Supports loading keys/values from a .env file.
  - Supports setting binary data.
  - Example use can be found in [WebService advanced example](./examples/advanced-web-service/README.md).

- `Secret`

  - Represents a Kubernetes Secret.
  - Encodes data in base64.
  - Supports setting a key/value from a file.
  - Supports loading keys/values from a .env file.
  - Supports setting string data, allowing Kubernetes API to encode on write.

- `WebService`

  - Represents a web application exposed via an AWS Application Load Balancer.
  - Supports autoscaling.
  - Supports adding Nginx reverse proxy.
  - Supports canary releases with a separate canary deployment and load balancer, allowing to test the new version via host hack.
  - Details in a [simple](./examples/simple-web-service/README.md) and [advanced](./examples/advanced-web-service/README.md) examples.

## Useful commands

- `npm run build` compile typescript to js
- `npm run watch` watch for changes and compile
- `npm run lint` will check code quality and style guidelines (using ESlint and Prettier)
- `npm run format` will format the code (using Prettier)
- `npm run test` run tests
