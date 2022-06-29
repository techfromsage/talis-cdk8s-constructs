import { Chart } from "cdk8s";
import { Construct } from "constructs";
import { KubeService, KubeStatefulSet, Quantity } from "../../imports/k8s";
import { PostgresProps } from "./postgres-props";

export class Postgres extends Construct {
  readonly service: KubeService;
  readonly statefulSet: KubeStatefulSet;

  constructor(scope: Construct, id: string, props: PostgresProps) {
    super(scope, id);

    const chart = Chart.of(this);
    const app = props.selectorLabels?.app ?? chart.labels.app;
    const release = props.release ?? "14.4";
    const port = 5432;
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

    const selectorLabels: { [key: string]: string } = {
      app: app,
      role: "postgres",
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
            port: port,
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
        volumeClaimTemplates: [
          {
            metadata: {
              name: "postgres-data",
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
            initContainers: props.initContainers,
            volumes: props.volumes,
            containers: [
              {
                name: "postgres",
                image: `postgres:${release}`,
                env: props.env,
                envFrom: props.envFrom,
                ports: [
                  {
                    containerPort: port,
                  },
                ],
                resources: resources,
                livenessProbe: {
                  exec: {
                    command: ["pg_isready"],
                  },
                  initialDelaySeconds: 30,
                  timeoutSeconds: 5,
                  failureThreshold: 3,
                  successThreshold: 1,
                  periodSeconds: 10,
                },
                readinessProbe: {
                  exec: {
                    command: ["pg_isready"],
                  },
                  initialDelaySeconds: 30,
                  timeoutSeconds: 5,
                  failureThreshold: 3,
                  successThreshold: 1,
                  periodSeconds: 10,
                },
                volumeMounts: [
                  {
                    mountPath: "/var/lib/postgresql/data",
                    name: "postgres-data",
                    subPath: "postgres",
                  },
                  ...(props.volumeMounts ?? []),
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
