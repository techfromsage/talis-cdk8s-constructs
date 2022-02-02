import { Construct } from "constructs";
import { Chart, ChartProps } from "cdk8s";
import { BackgroundWorker, ResqueWeb, Secret } from "../../lib";
import { KubeNamespace, Quantity } from "../../imports/k8s";

export class BackgroundWorkerChart extends Chart {
  constructor(
    scope: Construct,
    id: string,
    { namespace = "example-background-worker", ...props }: ChartProps = {}
  ) {
    super(scope, id, { namespace, ...props });

    const release = process.env.RELEASE || "v1.0";
    const redisUrl = "redis.cache.svc.cluster.local:6379:1";

    new KubeNamespace(this, "namespace", { metadata: { name: namespace } });

    const dockerHubCredentials = `${process.env.DOCKER_USERNAME}:${process.env.DOCKER_PASSWORD}`;
    const dockerHubSecret = new Secret(this, "docker-hub-cred", {
      type: "kubernetes.io/dockerconfigjson",
      data: {
        ".dockerconfigjson": JSON.stringify({
          auths: {
            "https://index.docker.io/v1/": {
              auth: Buffer.from(dockerHubCredentials).toString("base64"),
            },
          },
        }),
      },
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
