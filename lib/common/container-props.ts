import {
  Container,
  EnvFromSource,
  EnvVar,
  Lifecycle,
  Probe,
  ResourceRequirements,
  SecurityContext,
  VolumeMount,
} from "../../imports/k8s";

export interface ContainerProps {
  /**
   * What name to give the application container
   * @default set from the "app" label
   */
  readonly containerName?: string;

  /** The Docker image to use. */
  readonly image: string;

  /**
   * Affects when the kubelet attempts to pull the specified image.
   * @default "IfNotPresent"
   */
  readonly imagePullPolicy?: string;

  /** Release version of the Docker image. */
  readonly release: string;

  /** Overrides container's working directory. */
  readonly workingDir?: string;

  /** Entrypoint array. Not executed within a shell. The Docker image's ENTRYPOINT is used if this is not provided. */
  readonly command?: string[];

  /** Arguments to the entrypoint. The Docker image's CMD is used if this is not provided. */
  readonly args?: string[];

  /** Resource requirements and limits for the container. */
  readonly resources: ResourceRequirements;

  /** SecurityContext defines the security options the container should be run with. */
  readonly securityContext?: SecurityContext;

  /** Literal environment variables. */
  readonly env?: EnvVar[];

  /** Environment variables from ConfigMaps/Secrets. */
  readonly envFrom?: EnvFromSource[];

  /** Lifecycle describes actions that the management system should take in response to container lifecycle events. */
  readonly lifecycle?: Lifecycle;

  /** Indicates that the Pod has successfully initialized. Container will be restarted if the probe fails. */
  readonly startupProbe?: Probe;

  /** Periodic probe of container liveness. Container will be restarted if the probe fails. */
  readonly livenessProbe?: Probe;

  /** Periodic probe of container service readiness. Container will be removed from service endpoints if the probe fails. */
  readonly readinessProbe?: Probe;

  /** Pod volumes to mount into the container's filesystem. */
  readonly volumeMounts?: VolumeMount[];

  /**
   * List of initialization containers belonging to the pod.
   * More info: https://kubernetes.io/docs/concepts/workloads/pods/init-containers/
   */
  readonly initContainers?: Container[];
}
