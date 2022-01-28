# Backgroundworker construct example

Demonstrates a background worker that uses Resque job queue as well as a frontend for it deployed as an internal web service.

It includes:

- Worker Deployment,
  - We're also setting a custom `stopSignal` to allow for graceful termination - by default Kubernetes uses SIGTERM and some worker frameworks will perform a non-graceful termination upon receiving that signal. That way when a worker Pod needs to be terminated (e.g. during a release rollout) it should allow for currently processed job to finish for up to `terminationGracePeriodSeconds`.
- Resque Deployment, Service, and Ingress.

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
npm test -- examples/background-worker
```
