import { Construct } from "constructs";
import {
  BackgroundWorker,
  createImagePullSecret,
  ResqueWeb,
  TalisChart,
  TalisChartProps,
} from "../../lib";
import { Quantity } from "../../imports/k8s";

export class BackgroundWorkerChart extends TalisChart {
  constructor(scope: Construct, props: TalisChartProps) {
    super(scope, { app: "example", ...props });

    const release = process.env.RELEASE || "v1.0";
    const redisUrl = "redis.cache.svc.cluster.local:6379:1";

    const dockerHubSecret = createImagePullSecret(this, {
      auth: `${process.env.DOCKER_USERNAME}:${process.env.DOCKER_PASSWORD}`,
    });

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
      stopSignal: "SIGQUIT",
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
