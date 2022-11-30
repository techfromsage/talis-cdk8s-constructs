import { ContainerProps } from "../common";
import {
  IoK8SApiCoreV1PodSpecRestartPolicy,
  LocalObjectReference,
  Volume,
} from "../../imports/k8s";

export interface JobProps
  extends Omit<
    ContainerProps,
    "startupProbe" | "readinessProbe" | "livenessProbe"
  > {
  /**
   * Custom selector labels, they will be merged with the default app, role, and instance.
   * They will be applied to the workload, the pod and the service.
   * @default { app: "<app label from chart>", role: "job", instance: "<construct id>" }
   */
  readonly selectorLabels?: { [key: string]: string };

  /**
   * A list of references to secrets in the same namespace to use for pulling any of the images.
   */
  readonly imagePullSecrets?: LocalObjectReference[];

  /**
   * list of volumes that can be mounted by containers belonging to the pod.
   */
  readonly volumes?: Volume[];

  /**
   * Restart policy for all containers within the pod.
   */
  readonly restartPolicy: IoK8SApiCoreV1PodSpecRestartPolicy;

  /**
   * Specifies the number of retries before marking this job failed.
   * @default 6
   */
  readonly backoffLimit?: number;

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
