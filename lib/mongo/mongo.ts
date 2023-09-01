import { Chart } from "cdk8s";
import { Construct } from "constructs";
import {
  IntOrString,
  KubeService,
  KubeStatefulSet,
  Quantity,
} from "../../imports/k8s";
import { DnsAwareStatefulSet, getDnsName } from "../common/statefulset-util";
import { MongoProps } from "./mongo-props";
import { PortProtocol, ServiceSpecType } from "../k8s";

export class Mongo extends Construct implements DnsAwareStatefulSet {
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
            protocol: PortProtocol.TCP,
          },
        ],
        selector: selectorLabels,
        type: exposeService
          ? ServiceSpecType.LOAD_BALANCER
          : ServiceSpecType.CLUSTER_IP,
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

  /** @inheritdoc */
  public getDnsName(replica = 0): string {
    return getDnsName(this, replica);
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
