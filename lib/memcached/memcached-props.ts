export interface MemcachedProps {
  /**
   * Custom selector labels, they will be merged with the default app, role, and instance.
   * They will be applied to the workload, the pod and the service.
   * @default { app: "<app label from chart>", role: "memcached", instance: "<construct id>" }
   */
  readonly selectorLabels?: { [key: string]: string };

  /** Release version of the Docker image. */
  readonly release: string;

  /**
   * Pod's priority class.
   * @default "database"
   */
  readonly priorityClassName?: string;
}
