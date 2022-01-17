# WebService construct simple example

Represents a web application exposed via an AWS Application Load Balancer.

It includes:

- Deployment,
- Service,
- Ingress.

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
npm test -- examples/simple-web-service
```
