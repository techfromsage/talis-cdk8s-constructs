import { Chart } from "cdk8s";
import { Construct } from "constructs";
import { KubeService, KubeStatefulSet, Quantity } from "../../imports/k8s";
import { RedisProps } from "./redis-props";

export class Redis extends Construct {
  readonly service: KubeService;
  readonly statefulSet: KubeStatefulSet;

  constructor(scope: Construct, id: string, props: RedisProps) {
    super(scope, id);

    const chart = Chart.of(this);
    const app = chart.labels.app ?? props.selectorLabels?.app;
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
            port: 6379,
            protocol: "TCP",
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
            labels: selectorLabels,
          },
          spec: {
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
                    containerPort: 6379,
                  },
                ],
                resources: {
                  limits: {
                    cpu: Quantity.fromString("100m"),
                    memory: Quantity.fromString("250Mi"),
                  },
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
}
