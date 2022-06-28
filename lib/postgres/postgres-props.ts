import {
  Container,
  EnvFromSource,
  EnvVar,
  Quantity,
  ResourceRequirements,
  Volume,
  VolumeMount,
} from "../../imports/k8s";

export interface PostgresProps {
  /**
   * Custom selector labels, they will be merged with the default app, role, and instance.
   * They will be applied to the workload, the pod and the service.
   * @default { app: "<app label from chart>", role: "cronjob", instance: "<construct id>" }
   */
  readonly selectorLabels?: { [key: string]: string };

  /** Release version of the Docker image. */
  readonly release: string;

  /**
   * Storage for the postgres pod
   * @default Quantity.fromString("20Gi")
   */
  readonly storageSize?: Quantity;

  /**
   * Resources for the postgres Pod
   * @default { limits: { cpu: "100m", memory: "500Mi" } }
   */
  readonly resources?: ResourceRequirements;

  /* List of environment variables to set in the container. */
  readonly env?: EnvVar[];

  /* List of sources to populate environment variables in the container. */
  readonly envFrom?: EnvFromSource[];

  /** List of initialization containers. */
  readonly initContainers?: Container[];

  /** List of additional volumes. */
  readonly volumes?: Volume[];

  /** List of additional volumes mounts. */
  readonly volumeMounts?: VolumeMount[];
}
