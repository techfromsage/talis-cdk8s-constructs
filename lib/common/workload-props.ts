import { PodProps } from ".";

export interface WorkloadProps extends PodProps {
  /**
   * Static number of replicas. Kubernetes default is 1 if not specified.
   */
  readonly replicas?: number;

  /**
   * The number of old ReplicaSets to retain to allow rollback.
   * @default 1
   */
  readonly revisionHistoryLimit?: number;
}

export type DeploymentProps = Omit<WorkloadProps, "restartPolicy">;
