import { Chart } from "cdk8s";
import { Construct } from "constructs";
import * as path from "node:path";
import {
  IntOrString,
  KubeService,
  KubeStatefulSet,
  Quantity,
} from "../../imports/k8s";
import { DnsAwareStatefulSet, getDnsName } from "../common/statefulset-util";
import { ConfigMap } from "../data";
import { Job } from "../job";
import { PodSpecRestartPolicy, PortProtocol, ServiceSpecType } from "../k8s";
import { MongoProps } from "./mongo-props";

function resolvePath(filePath: string): string {
  return path.resolve(__dirname, filePath);
}

export class Mongo extends Construct implements DnsAwareStatefulSet {
  readonly service: KubeService;
  readonly statefulSet: KubeStatefulSet;
  private readonly replicas: number;
  private readonly replicaSetName?: string;

  constructor(scope: Construct, id: string, props: MongoProps) {
    super(scope, id);

    this.replicas = props.replicas ?? 1;
    this.replicaSetName = props.replicaSetName;
    const chart = Chart.of(this);
    const app = props.selectorLabels?.app ?? chart.labels.app;
    const release = props.release ?? "3.6.23";
    const port = 27017;
    const labels = {
      ...chart.labels,
      release: release,
    };
    const storageClassName = props.storageClassName ?? "general-purpose-delete";
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
        replicas: this.replicas,
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
              storageClassName: storageClassName,
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

    if (this.replicaSetName) {
      this.addSetupReplicaSetJob();
    }
  }

  /** @inheritdoc */
  public getDnsName(replica = 0): string {
    return getDnsName(this, replica);
  }

  /**
   * Get the DNS names of all replicas.
   * Note: this assumes number of replicas is as given in the props, i.e. there
   * is no external scaling involved.
   * @returns Array of pods' DNS names
   */
  public getHosts(): string[] {
    return Array.from({ length: this.replicas }, (_, index) =>
      this.getDnsName(index),
    );
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

    if (this.replicaSetName) {
      args.push(`--replSet=${this.replicaSetName}`);
    }

    return args;
  }

  private addSetupReplicaSetJob(): void {
    if (!this.replicaSetName) {
      return;
    }

    const setupConfig = new ConfigMap(this, `${this.node.id}-setup-rs-conf`, {
      metadata: {
        name: `${this.node.id}-setup-rs-conf`,
      },
      disableNameSuffixHash: true,
    });
    setupConfig.setFile(resolvePath("init/setup-replset.sh"));

    new Job(this, `${this.node.id}-setup-rs`, {
      image: `mongo:${this.release}`,
      restartPolicy: PodSpecRestartPolicy.NEVER,
      backoffLimit: 0,
      release: this.release,
      command: ["/bin/bash"],
      args: [
        "/setup-replset.sh",
        this.replicaSetName,
        this.getHosts().join(","),
      ],
      resources: {
        requests: {
          cpu: Quantity.fromString("10m"),
          memory: Quantity.fromString("10Mi"),
        },
      },
      volumes: [
        {
          name: "setup-replset",
          configMap: { name: setupConfig.name },
        },
      ],
      volumeMounts: [
        {
          name: "setup-replset",
          mountPath: "/setup-replset.sh",
          subPath: "setup-replset.sh",
        },
      ],
    });
  }
}
