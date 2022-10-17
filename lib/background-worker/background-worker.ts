import { Chart } from "cdk8s";
import { Construct } from "constructs";
import { KubeDeployment, Lifecycle } from "../../imports/k8s";
import { defaultAffinity } from "../common";
import { BackgroundWorkerProps } from "./background-worker-props";

export class BackgroundWorker extends Construct {
  constructor(scope: Construct, id: string, props: BackgroundWorkerProps) {
    super(scope, id);
    this.validateProps(props);

    const hasProp = (key: string) =>
      Object.prototype.hasOwnProperty.call(props, key);
    const chart = Chart.of(this);
    const app = props.selectorLabels?.app ?? chart.labels.app;
    const labels = {
      ...chart.labels,
      release: props.release,
    };
    const affinityFunc = props.makeAffinity ?? defaultAffinity;

    const selectorLabels: { [key: string]: string } = {
      app: app,
      role: "worker",
      instance: id,
      ...props.selectorLabels,
    };

    new KubeDeployment(this, id, {
      metadata: {
        labels: { ...labels, ...selectorLabels },
      },
      spec: {
        replicas: props.replicas,
        revisionHistoryLimit: props.revisionHistoryLimit ?? 1,
        selector: {
          matchLabels: selectorLabels,
        },
        template: {
          metadata: {
            labels: {
              ...labels, // chart labels are not applied to the Pod so we need to add them here
              ...selectorLabels,
            },
          },
          spec: {
            affinity: hasProp("affinity")
              ? props.affinity
              : affinityFunc(selectorLabels),
            automountServiceAccountToken:
              props.automountServiceAccountToken ?? false,
            imagePullSecrets: props.imagePullSecrets,
            priorityClassName: props.priorityClassName,
            restartPolicy: props.restartPolicy,
            terminationGracePeriodSeconds: props.terminationGracePeriodSeconds,
            volumes: props.volumes,
            hostAliases: props.hostAliases,
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
                lifecycle: this.createLifecycle(props),
                startupProbe: props.startupProbe,
                livenessProbe: props.livenessProbe,
                volumeMounts: props.volumeMounts,
              },
            ],
          },
        },
      },
    });
  }

  validateProps(props: BackgroundWorkerProps): void {
    if (props.stopSignal && props.lifecycle?.preStop) {
      throw new Error(
        "stopSignal and lifecycle.preStop are mutually exclusive"
      );
    }
  }

  createLifecycle({
    stopSignal,
    lifecycle,
  }: BackgroundWorkerProps): Lifecycle | undefined {
    if (stopSignal) {
      return {
        ...lifecycle,
        preStop: {
          exec: {
            command: [
              "/bin/sh",
              "-c",
              `kill -${stopSignal} 1 && while kill -0 1; do sleep 1; done`,
            ],
          },
        },
      };
    }

    return lifecycle;
  }
}
