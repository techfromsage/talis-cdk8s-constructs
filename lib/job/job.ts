import { Chart } from "cdk8s";
import { Construct } from "constructs";
import { KubeJob } from "../../imports/k8s";
import { JobProps } from "./job-props";

export class Job extends Construct {
  constructor(scope: Construct, id: string, props: JobProps) {
    super(scope, id);

    const chart = Chart.of(this);
    const app = chart.labels.app ?? props.selectorLabels?.app;
    const labels = {
      ...chart.labels,
      release: props.release,
    };

    const selectorLabels: { [key: string]: string } = {
      app: app,
      role: "job",
      instance: id,
      ...props.selectorLabels,
    };

    new KubeJob(this, id, {
      metadata: {
        labels: { ...labels, ...selectorLabels },
      },
      spec: {
        backoffLimit: props.backoffLimit ?? 6,
        ttlSecondsAfterFinished: props.ttlSecondsAfterFinished,
        template: {
          spec: {
            volumes: props.volumes,
            restartPolicy: props.restartPolicy,
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
    });
  }
}
