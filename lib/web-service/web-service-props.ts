import {
  Affinity,
  EnvFromSource,
  EnvVar,
  LocalObjectReference,
  Probe,
  ResourceRequirements,
  Volume,
  VolumeMount,
} from "../../imports/k8s";

export const canaryStages = ["base", "canary", "post-canary", "full"] as const;
export type CanaryStage = typeof canaryStages[number];

export interface HorizontalPodAutoscalerProps {
  /** Minimum number of replicas. */
  readonly minReplicas: number;

  /** Maximum number of replicas. */
  readonly maxReplicas: number;

  /** Target average CPU utilization, as a percentage of the request. */
  readonly cpuTargetUtilization: number;
}

export interface NginxContainerProps {
  /** Overrides Nginx Docker image. */
  readonly image?: string;

  /**
   * Port (what container will listen on).
   * @default 80
   */
  readonly port?: number;

  /** Name of the ConfigMap with configuration files that should be mounted for this container. */
  readonly configMap: string;

  /** Overrides for resource requirements and limits for the container. */
  readonly resources?: ResourceRequirements;

  /** Override for liveness probe. Defaults to a probe that checks /livez endpoint. */
  readonly livenessProbe?: Probe;

  /** Override for readiness probe. Defaults to a probe that checks /livez endpoint. */
  readonly readinessProbe?: Probe;
}

interface ServiceAnnotations {
  /** A description of the Service for `talis.io/description` annotation. */
  readonly description: string;

  /** URL where this Service is available for `talis.io/url` annotation. */
  readonly externalUrl: string;

  /** Link to GitHub repo with the project for `talis.io/repository` annotation. */
  readonly repositoryUrl: string;

  /** Link to GitHub issues of the team that owns the project for `talis.io/issues` annotation. */
  readonly issuesUrl: string;

  /** Link to Slack channel of the project/team that owns the project for `talis.io/chat` annotation. */
  readonly chatUrl: string;

  /** Link to incident dashboard for `talis.io/incidents` annotation. */
  readonly incidentsUrl: string;

  /** Link to project runbook for `talis.io/runbook` annotation. */
  readonly runbookUrl: string;

  /** Link to the logs in Kibana for `talis.io/logs` annotation. */
  readonly logsUrl: string;

  /** Link to the graphs in Grafana for `talis.io/graphs` annotation. */
  readonly graphsUrl: string;

  /** Link to the Kubernetes dashboard for `talis.io/eks-dashboard` annotation. */
  readonly eksDashboardUrl: string;

  /** Link to the uptime dashboard for `talis.io/uptime` annotation. */
  readonly uptimeUrl: string;
}

interface ContainerProps {
  /** The Docker image to use for this service. */
  readonly image: string;

  /** Release version of the image. */
  readonly release: string;

  /** Entrypoint array. Not executed within a shell. The Docker image's ENTRYPOINT is used if this is not provided. */
  readonly command?: string[];

  /** Arguments to the entrypoint. The Docker image's CMD is used if this is not provided. */
  readonly args?: string[];

  /**
   * Port (what container will listen on).
   * @default 3000
   */
  readonly port?: number;

  /** Resource requirements and limits for the container. */
  readonly resources: ResourceRequirements;

  /** Nginx container props. */
  readonly nginx?: NginxContainerProps;

  /** Horizontal pod autoscaler props. Cannot be specified with `replicas`. */
  readonly horizontalPodAutoscaler?: HorizontalPodAutoscalerProps;

  /** Static number of replicas. Cannot be specified with `horizontalPodAutoscaler`. */
  readonly replicas?: number;

  /** Literal environment variables. */
  readonly env?: EnvVar[];

  /** Environment variables from ConfigMaps/Secrets. */
  readonly envFrom?: EnvFromSource[];

  /** Periodic probe of container liveness. Container will be restarted if the probe fails. */
  readonly livenessProbe?: Probe;

  /** Periodic probe of container service readiness. Container will be removed from service endpoints if the probe fails. */
  readonly readinessProbe?: Probe;

  /** List of volumes that can be mounted by containers belonging to the Pod. */
  readonly volumes?: Volume[];

  /** Pod volumes to mount into the container's filesystem. */
  readonly volumeMounts?: VolumeMount[];
}

export interface WebServiceProps extends ContainerProps, ServiceAnnotations {
  /**
   * Whether this is an internal service (behind VPN).
   * @default false
   */
  readonly internal?: boolean;

  /**
   * Whether to include canary service.
   * @default false
   */
  readonly canary?: boolean;

  /**
   * Release stage when canary is enabled.
   */
  readonly stage?: CanaryStage;

  /**
   * Domain name for TLS certificate discovery.
   * @see https://kubernetes-sigs.github.io/aws-load-balancer-controller/v2.3/guide/ingress/cert_discovery/
   */
  readonly tslDomain?: string;

  /**
   * Overrides for Ingress annotations.
   * @see https://kubernetes-sigs.github.io/aws-load-balancer-controller/v2.3/guide/ingress/annotations/
   */
  readonly ingressAnnotations?: { [key: string]: string };

  /**
   * Specifies how to route traffic to pods. Also, if "instance" is specified, the service will be exposed as a NodePort.
   * @see https://kubernetes-sigs.github.io/aws-load-balancer-controller/v2.3/guide/ingress/annotations/#target-type
   * @default "instance"
   */
  readonly ingressTargetType?: "instance" | "ip";

  /**
   * The number of old ReplicaSets to retain to allow rollback.
   * @default 1
   */
  readonly revisionHistoryLimit?: number;

  /**
   * Pod's scheduling constraints. Defaults to a soft anti-affinity for the same service in the same AWS zone.
   */
  readonly affinity?: Affinity;

  /**
   * Whether a service account token should be automatically mounted.
   * @default false
   */
  readonly automountServiceAccountToken?: boolean;

  /**
   * A list of references to secrets in the same namespace to use for pulling any of the images.
   */
  readonly imagePullSecrets?: LocalObjectReference[];

  /**
   * Pod's priority class.
   * @default "web"
   */
  readonly priorityClassName?: string;
}
