import { Chart } from "cdk8s";
import { Construct } from "constructs";
import {
  IntOrString,
  IoK8SApiCoreV1ServicePortProtocol,
  IoK8SApiCoreV1ServiceSpecType,
  KubeService,
  KubeStatefulSet,
  Quantity,
} from "../../imports/k8s";
import { MongoProps } from "./mongo-props";

export class Mongo extends Construct {
  readonly service: KubeService;
  readonly statefulSet: KubeStatefulSet;

  constructor(scope: Construct, id: string, props: MongoProps) {
    super(scope, id);

    const chart = Chart.of(this);
    const app = props.selectorLabels?.app ?? chart.labels.app;
    const release = props.release ?? "3.2.8";
    const port = 27017;
    const labels = {
      ...chart.labels,
      release: release,
    };
    const storageSize = props.storageSize ?? Quantity.fromString("20Gi");
    const resources = props.resources ?? {
      limits: {
        cpu: Quantity.fromString("100m"),
        memory: Quantity.fromString("500Mi"),
      },
    };
    const exposeService = props.exposeService ?? false;

    const selectorLabels: { [key: string]: string } = {
      app: app,
      role: "mongo",
      instance: id,
      ...props.selectorLabels,
    };

    const instanceLabels: { [key: string]: string } = {
      ...labels,
      ...selectorLabels,
    };

    const args = this.getCommandArgs(props);

    const serviceAnnotations: { [key: string]: string } = {};

    if (exposeService) {
      serviceAnnotations[
        "service.beta.kubernetes.io/aws-load-balancer-nlb-target-type"
      ] = "instance";
      serviceAnnotations[
        "service.beta.kubernetes.io/load-balancer-source-ranges"
      ] = "0.0.0.0/0";
      serviceAnnotations[
        "service.beta.kubernetes.io/aws-load-balancer-scheme"
      ] = "internal";
    }

    this.service = new KubeService(this, id, {
      metadata: {
        labels: instanceLabels,
        annotations: serviceAnnotations,
      },
      spec: {
        clusterIp: exposeService ? undefined : "None",
        ports: [
          {
            port: port,
            protocol: IoK8SApiCoreV1ServicePortProtocol.TCP,
          },
        ],
        selector: selectorLabels,
        type: exposeService
          ? IoK8SApiCoreV1ServiceSpecType.LOAD_BALANCER
          : IoK8SApiCoreV1ServiceSpecType.CLUSTER_IP,
        loadBalancerClass: exposeService ? "service.k8s.aws/nlb" : undefined,
      },
    });

    this.statefulSet = new KubeStatefulSet(this, `${id}-sts`, {
      metadata: {
        labels: instanceLabels,
      },
      spec: {
        serviceName: this.service.name,
        replicas: 1,
        selector: {
          matchLabels: selectorLabels,
        },
        volumeClaimTemplates: [
          {
            metadata: {
              name: "mongo-data",
            },
            spec: {
              accessModes: ["ReadWriteOnce"],
              storageClassName: "general-purpose-delete",
              resources: {
                requests: {
                  storage: storageSize,
                },
              },
            },
          },
        ],
        template: {
          metadata: {
            labels: instanceLabels,
          },
          spec: {
            priorityClassName: props.priorityClassName ?? "database",
            containers: [
              {
                name: "mongo",
                image: `mongo:${release}`,
                args: args,
                ports: [
                  {
                    containerPort: port,
                  },
                ],
                resources: resources,
                livenessProbe: {
                  tcpSocket: {
                    port: IntOrString.fromNumber(port),
                  },
                  initialDelaySeconds: 5,
                  timeoutSeconds: 5,
                  failureThreshold: 5,
                },
                readinessProbe: {
                  exec: {
                    command: ["mongo", "--eval", "db.adminCommand('ping')"],
                  },
                  initialDelaySeconds: 5,
                  timeoutSeconds: 5,
                  failureThreshold: 5,
                },
                volumeMounts: [
                  {
                    mountPath: "/data/db",
                    name: "mongo-data",
                  },
                ],
              },
            ],
          },
        },
      },
    });
  }

  /**
   * Get the DNS name of the instance.
   * Each pod in a StatefulSet backed by a headless Service will have a stable
   * DNS name. The template follows this format: <pod-name>.<service-name>.
   * Since Pod replicas in StatefulSets are numbered, we can use the index
   * of the Pod to get the DNS name.
   *
   * @param replica Number of the Pod replica to get address for
   */
  public getDnsName(replica = 0): string {
    return `${this.statefulSet.name}-${replica}.${this.service.name}`;
  }

  private getCommandArgs(props: MongoProps): string[] {
    if (props.customArgs) {
      return props.customArgs;
    }

    const storageEngine = props.storageEngine ?? "mmapv1";
    const args = ["--storageEngine", storageEngine];

    if (storageEngine === "mmapv1") {
      args.push("--smallfiles");
    }

    return args;
  }
}
