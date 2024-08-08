import { Chart } from "cdk8s";
import { Construct } from "constructs";
import {
  Container,
  IntOrString,
  KubeService,
  KubeStatefulSet,
  Quantity,
} from "../../imports/k8s";
import { makeWaitForPortContainer } from "../common";
import { DnsAwareStatefulSet, getDnsName } from "../common/statefulset-util";
import { PortProtocol } from "../k8s";
import { RedisProps } from "./redis-props";

export class Redis extends Construct implements DnsAwareStatefulSet {
  readonly port: number;
  readonly service: KubeService;
  readonly statefulSet: KubeStatefulSet;

  constructor(scope: Construct, id: string, props: RedisProps) {
    super(scope, id);

    this.port = 6379;

    const chart = Chart.of(this);
    const app = props.selectorLabels?.app ?? chart.labels.app;
    const release = props.release ?? "5.0.7";
    const labels = {
      ...chart.labels,
      release: release,
    };

    const selectorLabels: { [key: string]: string } = {
      app: app,
      role: "redis",
      instance: id,
      ...props.selectorLabels,
    };

    const instanceLabels: { [key: string]: string } = {
      ...labels,
      ...selectorLabels,
    };

    this.service = new KubeService(this, id, {
      metadata: {
        labels: instanceLabels,
      },
      spec: {
        clusterIp: "None",
        ports: [
          {
            port: this.port,
            protocol: PortProtocol.TCP,
          },
        ],
        selector: selectorLabels,
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
        template: {
          metadata: {
            labels: instanceLabels,
          },
          spec: {
            priorityClassName: props.priorityClassName ?? "database",
            volumes: [
              {
                name: "data",
                emptyDir: {},
              },
            ],
            containers: [
              {
                name: "redis",
                image: `redis:${release}`,
                command: ["redis-server", "--appendonly", "yes"],
                env: [
                  {
                    name: "MASTER",
                    value: "true",
                  },
                ],
                ports: [
                  {
                    containerPort: this.port,
                  },
                ],
                resources: {
                  limits: {
                    cpu: Quantity.fromString("100m"),
                    memory: Quantity.fromString("250Mi"),
                  },
                },
                livenessProbe: {
                  tcpSocket: {
                    port: IntOrString.fromNumber(this.port),
                  },
                  initialDelaySeconds: 5,
                  timeoutSeconds: 5,
                  failureThreshold: 5,
                },
                readinessProbe: {
                  exec: {
                    command: ["redis-cli", "ping"],
                  },
                  initialDelaySeconds: 5,
                  timeoutSeconds: 5,
                  failureThreshold: 5,
                },
                volumeMounts: [
                  {
                    mountPath: "/redis-master-data",
                    name: "data",
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

  public getWaitForPortContainer(): Container {
    return makeWaitForPortContainer(this.node.id, this.getDnsName(), this.port);
  }
}
