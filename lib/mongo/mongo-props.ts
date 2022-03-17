export interface MongoProps {
  /**
   * Custom selector labels, they will be merged with the default app, role, and instance.
   * They will be applied to the workload, the pod and the service.
   * @default { app: "<app label from chart>", role: "cronjob", instance: "<construct id>" }
   */
  readonly selectorLabels?: { [key: string]: string };

  /** Release version of the Docker image. */
  readonly release: string;

  /**
   * The storage engine to use
   * @default mmapv1
   */
  readonly storageEngine?: "wiredTiger" | "inMemory" | "mmapv1";
}
