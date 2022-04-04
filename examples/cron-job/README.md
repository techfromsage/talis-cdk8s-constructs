# Cron-Job construct example

Demonstrates a Cron-Job.

## Cron Parser Syntax

```
*    *    *    *    *    *
┬    ┬    ┬    ┬    ┬    ┬
│    │    │    │    │    |
│    │    │    │    │    └ day of week (0 - 7, 1L - 7L) (0 or 7 is Sun)
│    │    │    │    └───── month (1 - 12)
│    │    │    └────────── day of month (1 - 31, L)
│    │    └─────────────── hour (0 - 23)
│    └──────────────────── minute (0 - 59)
└───────────────────────── second (0 - 59, optional)
```

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
npm test -- examples/cron-job
```
