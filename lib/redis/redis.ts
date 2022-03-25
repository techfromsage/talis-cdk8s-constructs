import { Chart } from "cdk8s";
import { Construct } from "constructs";
import { KubeService, KubeStatefulSet, Quantity } from "../../imports/k8s";
import { RedisProps } from "./redis-props";

export class Redis extends Construct {
  readonly service: KubeService;

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
        ports: [
          {
            port: 6379,
            protocol: "TCP",
          },
        ],
        selector: selectorLabels,
      },
    });

    new KubeStatefulSet(this, `${id}-sts`, {
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
}
