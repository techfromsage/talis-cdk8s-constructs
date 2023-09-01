import { ContainerProps, WorkloadProps } from "../common";
import { RedisConnectionDetails } from "../redis/redis-util";

export interface RedisListScalerProps {
  /** Name of the Redis List that you want to monitor. */
  readonly listName: string;

  /** Average target value to trigger scaling actions. */
  readonly listLength: number;

  /** Redis connection details. */
  readonly redisConnectionDetails: RedisConnectionDetails;
}

export interface BackgroundWorkerAutoscalingProps {
  /**
   * Whether to pause autoscaling.
   * When set to true, `minReplicas` will be used as the desired replica count.
   * @see https://keda.sh/docs/2.9/concepts/scaling-deployments/#pause-autoscaling
   */
  readonly paused?: boolean;

  /**
   * Minimum number of replicas.
   * @default 0
   */
  readonly minReplicas?: number;

  /**
   * Maximum number of replicas.
   * @default 100
   */
  readonly maxReplicas: number;

  /**
   * Interval to check each scaler on.
   * @default 30
   */
  readonly pollingInterval?: number;

  /**
   * The period to wait after the last trigger reported active before scaling the resource back to 0.
   * @default 300
   */
  readonly cooldownPeriod?: number;

  /** Scale applications based on Redis List(s). */
  readonly redisListScalers?: RedisListScalerProps[];
}

export interface BackgroundWorkerProps
  extends Omit<ContainerProps, "readinessProbe">,
    WorkloadProps {
  /**
   * If specified, it will set up a preStop hook to terminate the container with given signal.
   * When passing a string, don't include the "SIG" prefix, just the name of the signal.
   */
  readonly stopSignal?: string | number;

  /**
   * Custom selector labels, they will be merged with the default app, role, and instance.
   * They will be applied to the workload, the pod and the service.
   * @default { app: "<app label from chart>", role: "worker", instance: "<construct id>" }
   */
  readonly selectorLabels?: { [key: string]: string };

  /**
   * Restart policy for all containers within the pod.
   * @default "Always"
   */
  readonly restartPolicy?: string;

  /**
   * Autoscaling props. Cannot be specified with `replicas`.
   */
  readonly autoscaling?: BackgroundWorkerAutoscalingProps;
}
