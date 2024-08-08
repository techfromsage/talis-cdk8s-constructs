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
import { MemcachedProps } from "./memcached-props";

export class Memcached extends Construct implements DnsAwareStatefulSet {
  readonly port: number;
  readonly service: KubeService;
  readonly statefulSet: KubeStatefulSet;

  constructor(scope: Construct, id: string, props: MemcachedProps) {
    super(scope, id);

    this.port = 11211;

    const chart = Chart.of(this);
    const app = props.selectorLabels?.app ?? chart.labels.app;
    const release = props.release ?? "1.6.15";
    const labels = {
      ...chart.labels,
      release: release,
    };

    const memoryLimit = 64;

    const selectorLabels: { [key: string]: string } = {
      app: app,
      role: "memcached",
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
            containers: [
              {
                name: "memcached",
                image: `memcached:${release}`,
                args: [`--memory-limit=${memoryLimit}`],
                ports: [
                  {
                    containerPort: this.port,
                  },
                ],
                resources: {
                  limits: {
                    cpu: Quantity.fromString("50m"),
                    memory: Quantity.fromString(`${memoryLimit}Mi`),
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
                  tcpSocket: {
                    port: IntOrString.fromNumber(this.port),
                  },
                  initialDelaySeconds: 5,
                  timeoutSeconds: 5,
                  failureThreshold: 5,
                },
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
