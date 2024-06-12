import { Chart } from "cdk8s";
import { Construct } from "constructs";
import { KubeJob } from "../../imports/k8s";
import { JobProps } from "./job-props";
import { ContainerImagePullPolicy } from "../k8s";
import { makeSafeToEvictAnnotations } from "../common";

export class Job extends Construct {
  constructor(scope: Construct, id: string, props: JobProps) {
    super(scope, id);

    const hasProp = (key: string) =>
      Object.prototype.hasOwnProperty.call(props, key);
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
            affinity: hasProp("affinity")
              ? props.affinity
              : props.makeAffinity
                ? props.makeAffinity(selectorLabels)
                : undefined,
            automountServiceAccountToken:
              props.automountServiceAccountToken ?? false,
            dnsConfig: props.dnsConfig,
            dnsPolicy: props.dnsPolicy,
            enableServiceLinks: props.enableServiceLinks,
            hostAliases: props.hostAliases,
            imagePullSecrets: props.imagePullSecrets,
            preemptionPolicy: props.preemptionPolicy,
            priorityClassName: props.priorityClassName ?? "job",
            restartPolicy: props.restartPolicy,
            serviceAccountName: props.serviceAccountName,
            setHostnameAsFqdn: props.setHostnameAsFqdn,
            shareProcessNamespace: props.shareProcessNamespace,
            subdomain: props.subdomain,
            terminationGracePeriodSeconds: props.terminationGracePeriodSeconds,
            tolerations: props.tolerations,
            volumes: props.volumes,
            securityContext: props.podSecurityContext,
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
