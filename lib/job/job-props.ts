import { ContainerProps, PodProps, SafeToEvictPodProps } from "../common";

export interface JobProps
  extends Omit<
      ContainerProps,
      "startupProbe" | "readinessProbe" | "livenessProbe"
    >,
    PodProps,
    SafeToEvictPodProps {
  /**
   * Custom selector labels, they will be merged with the default app, role, and instance.
   * They will be applied to the workload, the pod and the service.
   * @default { app: "<app label from chart>", role: "job", instance: "<construct id>" }
   */
  readonly selectorLabels?: { [key: string]: string };

  /**
   * Pod's priority class.
   * @default "job"
   */
  readonly priorityClassName?: string;

  /**
   * Restart policy for all containers within the pod.
   */
  readonly restartPolicy: string;

  /**
   * Specifies whether the Job controller should create Pods or not.
   * @default false.
   */
  readonly suspend?: boolean;

  /**
   * Specifies the number of retries before marking this job failed.
   * @default 6
   */
  readonly backoffLimit?: number;

  /**
   * Specifies the duration in seconds relative to the startTime that the job
   * may be continuously active before the system tries to terminate it; value
   * must be positive integer. If a Job is suspended (at creation or through
   * an update), this timer will effectively be stopped and reset when the Job
   * is resumed again.
   */
  readonly activeDeadlineSeconds?: number;

  /**
   * ttlSecondsAfterFinished limits the lifetime of a Job that has finished execution (either Complete
   * or Failed). If this field is set, ttlSecondsAfterFinished after the Job finishes, it is eligible
   * to be automatically deleted. When the Job is being deleted, its lifecycle guarantees
   * (e.g. finalizers) will be honored. If this field is unset, the Job won't be automatically deleted.
   * If this field is set to zero, the Job becomes eligible to be deleted immediately after it finishes.
   * This field is alpha-level and is only honored by servers that enable the TTLAfterFinished feature.
   */
  readonly ttlSecondsAfterFinished?: number;
}
