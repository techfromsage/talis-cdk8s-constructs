import { App } from "cdk8s";
import { Construct } from "constructs";

import { Quantity, ResourceRequirements } from "../imports/k8s";
import {
  BackgroundWorker,
  CronJob,
  PodSpecRestartPolicy,
  Redis,
  TalisChart,
  TalisChartProps,
  TalisDeploymentEnvironment,
  TalisShortRegion,
} from "../lib";
import { getRedisConnectionDetails } from "../lib/redis/redis-util";
import { getBuildWatermark, makeTtlTimestamp } from "./test-util";

export class AutoscalingWorkerChart extends TalisChart {
  constructor(scope: Construct, props: TalisChartProps) {
    super(scope, { app: "cdk8s-autoscale", release: "test", ...props });

    const redisVersion = "5.0.7";
    const busyboxVersion = "1.35.0";
    const busyboxImage = `docker.io/busybox:${busyboxVersion}`;

    const redis = new Redis(this, "redis", {
      release: redisVersion,
    });
    const redisHost = redis.getDnsName();

    const commonResources: ResourceRequirements = {
      requests: {
        cpu: Quantity.fromString("10m"),
        memory: Quantity.fromString("16Mi"),
      },
      limits: {
        cpu: Quantity.fromString("100m"),
        memory: Quantity.fromString("64Mi"),
      },
    };

    const redisConnectionDetails = getRedisConnectionDetails({
      host: redisHost,
    });

    const initRedisContainer = redis.getWaitForPortContainer();

    const jobs = [
      {
        name: "append-to-list-a",
        command: ["rpush", "my-list-a", "a"],
      },
      {
        name: "append-to-list-b",
        command: ["rpush", "my-list-b", "b"],
      },
      {
        name: "clear-lists",
        command: ["del", "my-list-a", "my-list-b"],
      },
    ];

    jobs.forEach(({ name, command }) => {
      new CronJob(this, name, {
        schedule: "0 0 29 2 1",
        suspend: true,
        initContainers: [initRedisContainer],
        image: `docker.io/redis:${redisVersion}`,
        release: redisVersion,
        command: [
          "redis-cli",
          "-h",
          redisConnectionDetails.host,
          "-p",
          redisConnectionDetails.port,
          "-n",
          redisConnectionDetails.database,
          ...command,
        ],
        restartPolicy: PodSpecRestartPolicy.NEVER,
        resources: commonResources,
      });
    });

    new BackgroundWorker(this, "worker", {
      initContainers: [initRedisContainer],
      image: busyboxImage,
      release: busyboxVersion,
      command: ["sh", "-c", "while true; do echo hello; sleep 1; done"],
      resources: commonResources,
      autoscaling: {
        minReplicas: 0,
        maxReplicas: 3,
        pollingInterval: 10,
        cooldownPeriod: 10,
        redisListScalers: [
          {
            listName: "my-list-a",
            listLength: 5,
            redisConnectionDetails: redisConnectionDetails,
          },
          {
            listName: "my-list-b",
            listLength: 1,
            redisConnectionDetails: redisConnectionDetails,
          },
        ],
      },
    });
  }
}

const app = new App();
new AutoscalingWorkerChart(app, {
  environment: TalisDeploymentEnvironment.BUILD,
  region: TalisShortRegion.LOCAL,
  watermark: getBuildWatermark(),
  ttl: makeTtlTimestamp(),
});
app.synth();
