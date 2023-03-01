import { Construct } from "constructs";
import {
  BackgroundWorker,
  createDockerHubSecretFromEnv,
  getDockerTag,
  ResqueWeb,
  TalisChart,
  TalisChartProps,
} from "../../lib";
import { Quantity } from "../../imports/k8s";

export class BackgroundWorkerChart extends TalisChart {
  constructor(scope: Construct, props: TalisChartProps) {
    const release = getDockerTag("RELEASE", props.environment, "v1.0");
    super(scope, { app: "worker", release, ...props });

    const redisUrl = "redis.cache.svc.cluster.local:6379:1";
    const dockerHubSecret = createDockerHubSecretFromEnv(this);

    new ResqueWeb(this, "resque", {
      externalUrl: "https://resque.example.com",
      tlsDomain: "*.example.com",
      imagePullSecrets: [{ name: dockerHubSecret.name }],
      env: [
        {
          name: "RAILS_RESQUE_REDIS",
          value: redisUrl,
        },
      ],
    });

    new BackgroundWorker(this, "php-worker-example", {
      image: `docker.io/organization/my-app:worker-${release}`,
      imagePullSecrets: [{ name: dockerHubSecret.name }],
      release,
      command: ["php", "vendor/resque/php-resque/bin/resque"],
      stopSignal: "QUIT",
      terminationGracePeriodSeconds: 300,
      env: [
        {
          name: "WORKER_NUM",
          valueFrom: { fieldRef: { fieldPath: "metadata.name" } },
        },
        {
          name: "REDIS_BACKEND",
          value: redisUrl,
        },
        {
          name: "QUEUE",
          value: "my-app:example:jobs",
        },
      ],
      resources: {
        requests: {
          cpu: Quantity.fromString("50m"),
          memory: Quantity.fromString("100Mi"),
        },
      },
    });
  }
}
