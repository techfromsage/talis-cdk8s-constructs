import { Chart } from "cdk8s";
import { Construct } from "constructs";
import { KubeCronJob } from "../../imports/k8s";
import { CronJobProps } from "./cron-job-props";

export class CronJob extends Construct {
  constructor(scope: Construct, id: string, props: CronJobProps) {
    super(scope, id);
    this.validateProps(props);

    const chart = Chart.of(this);
    const app = chart.labels.app ?? props.selectorLabels?.app;
    const labels = {
      ...chart.labels,
      release: props.release,
    };

    const selectorLabels: { [key: string]: string } = {
      app: app,
      role: "cronjob",
      instance: id,
      ...props.selectorLabels,
    };

    new KubeCronJob(this, id, {
      metadata: {
        labels: { ...labels, ...selectorLabels },
      },
      spec: {
        schedule: props.schedule,
        jobTemplate: {
          spec: {
            template: {
              spec: {
                volumes: props.volumes,
                initContainers: props.initContainers,
                containers: [
                  {
                    name: props.containerName ?? app ?? "app",
                    image: props.image,
                    imagePullPolicy: props.imagePullPolicy ?? "IfNotPresent",
                    workingDir: props.workingDir,
                    command: props.command,
                    args: props.args,
                    resources: props.resources,
                    securityContext: props.securityContext,
                    env: props.env,
                    envFrom: props.envFrom,
                    volumeMounts: props.volumeMounts,
                  },
                ],
              },
            },
          },
        },
      },
    });
  }

  validateProps(props: CronJobProps): void {
    if (!props.schedule) {
      throw new Error("Schedule must be specified");
    }
  }
}
