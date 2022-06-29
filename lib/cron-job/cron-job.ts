import { Chart } from "cdk8s";
import { Construct } from "constructs";
import { KubeCronJob } from "../../imports/k8s";
import { CronJobProps } from "./cron-job-props";
import { parseExpression } from "cron-parser";

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
        suspend: props.suspend,
        startingDeadlineSeconds: props.startingDeadlineSeconds,
        successfulJobsHistoryLimit: props.successfulJobsHistoryLimit ?? 3,
        failedJobsHistoryLimit: props.failedJobsHistoryLimit ?? 1,
        jobTemplate: {
          spec: {
            backoffLimit: props.backoffLimit ?? 6,
            template: {
              metadata: {
                labels: {
                  ...labels, // chart labels are not applied to the Pod so we need to add them here
                  ...selectorLabels,
                },
              },
              spec: {
                volumes: props.volumes,
                restartPolicy: props.restartPolicy,
                imagePullSecrets: props.imagePullSecrets,
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
                    lifecycle: props.lifecycle,
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

    // Validate that we get a full 5 or 6 character cron expression
    // parseExpression only checks for max length not min length
    if (props.schedule.split(" ").length < 5) {
      throw new Error("Invalid cron expression");
    }

    parseExpression(props.schedule);
  }
}
