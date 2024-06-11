import { Chart } from "cdk8s";
import { Construct } from "constructs";
import { KubeJob } from "../../imports/k8s";
import { JobProps } from "./job-props";
import { ContainerImagePullPolicy } from "../k8s";
import { makeSafeToEvictAnnotations } from "../common";

export class Job extends Construct {
  constructor(scope: Construct, id: string, props: JobProps) {
    super(scope, id);

    const chart = Chart.of(this);
    const app = props.selectorLabels?.app ?? chart.labels.app;
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
        suspend: props.suspend,
        backoffLimit: props.backoffLimit ?? 6,
        activeDeadlineSeconds: props.activeDeadlineSeconds,
        ttlSecondsAfterFinished: props.ttlSecondsAfterFinished,
        template: {
          metadata: {
            annotations: makeSafeToEvictAnnotations(props),
            labels: {
              ...labels, // chart labels are not applied to the Pod so we need to add them here
              ...selectorLabels,
            },
          },
          spec: {
            volumes: props.volumes,
            restartPolicy: props.restartPolicy,
            imagePullSecrets: props.imagePullSecrets,
            priorityClassName: props.priorityClassName ?? "job",
            initContainers: props.initContainers,
            containers: [
              {
                name: props.containerName ?? app ?? "app",
                image: props.image,
                imagePullPolicy:
                  props.imagePullPolicy ??
                  ContainerImagePullPolicy.IF_NOT_PRESENT,
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
              ...(props.containers ?? []),
            ],
          },
        },
      },
    });
  }
}
