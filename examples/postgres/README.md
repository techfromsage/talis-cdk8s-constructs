# Postgres construct example

Demonstrates running a simple standalone PostgreSQL server.

This example also demonstrates how to use the `ConfigMap` construct and volume mounts to make use of Postgres' [initialization scripts](https://github.com/docker-library/docs/tree/master/postgres#initialization-scripts).

## Usage

In order to synthesize the example to Kubernetes YAML, you need to run the following command:

```sh
npx cdk8s synth
```

This will produce `dist/app.k8s.yaml` file which you can then apply to your cluster:

```sh
kubectl apply -f dist/app.k8s.yaml
```

## Testing

You can run the tests with the following command:

```sh
npm test -- examples/postgres
```
