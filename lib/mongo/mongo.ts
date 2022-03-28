import { Chart } from "cdk8s";
import { Construct } from "constructs";
import { KubeService, KubeStatefulSet, Quantity } from "../../imports/k8s";
import { MongoProps } from "./mongo-props";

export class Mongo extends Construct {
  readonly service: KubeService;
  readonly statefulSet: KubeStatefulSet;

  constructor(scope: Construct, id: string, props: MongoProps) {
    super(scope, id);

    const chart = Chart.of(this);
    const app = chart.labels.app ?? props.selectorLabels?.app;
    const release = props.release ?? "3.2.8";
    const storageEngine = props.storageEngine ?? "mmapv1";
    const labels = {
      ...chart.labels,
      release: release,
    };

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

    this.service = new KubeService(this, id, {
      metadata: {
        labels: instanceLabels,
      },
      spec: {
        clusterIp: "None",
        ports: [
          {
            port: 27107,
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
                name: "mongo",
                image: `mongo:${release}`,
                args: ["--smallfiles", "--storageEngine", storageEngine],
                ports: [
                  {
                    containerPort: 27017,
                  },
                ],
                resources: {
                  limits: {
                    cpu: Quantity.fromString("100m"),
                    memory: Quantity.fromString("500Mi"),
                  },
                },
                volumeMounts: [
                  {
                    mountPath: "/data/db",
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
