# WebService construct advanced example

Advanced WebService construct example

It includes:

- Two sets of objects:
  - One for the live deployment,
  - One for the canary deployment.
- An environment variable to control the deployment's stage.
- Auto-scaling for the live deployment.
- An Nginx container that serves the application and patches cookies to include SameSite.

## Usage

In order to synthesize the example to Kubernetes YAML, you need to set the `CANARY_STAGE` environment variable to one of the following values:

- `base` - two sets of objects are created (live and canary) and are completely separate (i.e. live load balancer only serves live deployment and same with canary).
- `canary` - only the canary deployment is applied so you can update its version.
- `post-canary` - as above and also the live service's selector is updated to include both deployments, so load balancer will serve both versions.
- `full` - both deployments are updated to the new version and the live service serves from both deployments.

Once you choose the stage, you can run the command like so:

```sh
CANARY_STAGE=full npx cdk8s synth
```

This will produce `dist/app.k8s.yaml` file which you can then apply to your cluster:

```sh
kubectl apply -f dist/app.k8s.yaml
```

You can then try changing the release version and apply the `canary` stage:

```sh
RELEASE=v0.2.2 CANARY_STAGE=canary npx cdk8s synth
kubectl apply -f dist/app.k8s.yaml
```

## Testing

You can run the tests with the following command:

```sh
npm test -- examples/advanced-web-service
```
