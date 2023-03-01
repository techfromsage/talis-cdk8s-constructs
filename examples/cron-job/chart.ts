import { Construct } from "constructs";
import {
  createDockerHubSecretFromEnv,
  CronJob,
  getDockerTag,
  TalisChart,
  TalisChartProps,
} from "../../lib";
import {
  IoK8SApiCoreV1PodSpecRestartPolicy,
  Quantity,
} from "../../imports/k8s";

export class CronJobChart extends TalisChart {
  constructor(scope: Construct, props: TalisChartProps) {
    const release = getDockerTag("RELEASE", props.environment, "v1.0");
    super(scope, { app: "example-cron-app", release, ...props });

    const dockerHubSecret = createDockerHubSecretFromEnv(this);

    new CronJob(this, "cron-job-example", {
      schedule: "0 0 13 * 5",
      restartPolicy: IoK8SApiCoreV1PodSpecRestartPolicy.NEVER,
      image: `docker.io/organization/my-app:cron-${release}`,
      imagePullSecrets: [{ name: dockerHubSecret.name }],
      release,
      workingDir: "/some/path",
      command: ["/bin/sh", "-c", "echo hello"],
      resources: {
        requests: {
          cpu: Quantity.fromString("100m"),
          memory: Quantity.fromString("100Mi"),
        },
      },
    });
  }
}
