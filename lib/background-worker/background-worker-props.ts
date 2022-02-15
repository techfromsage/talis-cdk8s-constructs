import { ContainerProps, WorkloadProps } from "../common";

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
}
