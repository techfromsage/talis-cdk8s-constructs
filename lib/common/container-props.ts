import { Container } from "../../imports/k8s";

export interface MainContainerProps
  extends Pick<
    Container,
    | "imagePullPolicy"
    | "workingDir"
    | "command"
    | "args"
    | "resources"
    | "securityContext"
    | "env"
    | "envFrom"
    | "lifecycle"
    | "startupProbe"
    | "livenessProbe"
    | "readinessProbe"
    | "volumeMounts"
  > {
  /**
   * What name to give the main application container
   * @default set from the "app" label
   */
  readonly containerName?: string;

  /**
   * Container image to use.
   * More info: https://kubernetes.io/docs/concepts/containers/images
   */
  readonly image: string;
}

export interface ContainerProps extends MainContainerProps {
  /** Release version of the Docker image. */
  readonly release: string;

  /**
   * Additional containers for Pods with multiple containers.
   * More info: https://kubernetes.io/docs/concepts/workloads/pods/#how-pods-manage-multiple-containers
   */
  readonly containers?: Container[];

  /**
   * List of initialization containers belonging to the pod.
   * More info: https://kubernetes.io/docs/concepts/workloads/pods/init-containers/
   */
  readonly initContainers?: Container[];
}
