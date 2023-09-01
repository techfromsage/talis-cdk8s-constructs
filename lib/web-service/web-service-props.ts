import { Probe, ResourceRequirements } from "../../imports/k8s";
import { ContainerProps, WorkloadProps } from "../common";

export const canaryStages = ["base", "canary", "post-canary", "full"] as const;
export type CanaryStage = (typeof canaryStages)[number];

export interface HorizontalPodAutoscalerProps {
  /** Minimum number of replicas. */
  readonly minReplicas: number;

  /** Maximum number of replicas. */
  readonly maxReplicas: number;

  /** Target average CPU utilization, as a percentage of the request. */
  readonly cpuTargetUtilization?: number;

  /** Target average memory utilization, as a percentage of the request. */
  readonly memoryTargetUtilization?: number;
}

export interface NginxContainerProps {
  /** Overrides Nginx Docker image. */
  readonly image?: string;

  /**
   * Affects when the kubelet attempts to pull the specified image.
   * @default "IfNotPresent"
   */
  readonly imagePullPolicy?: string;

  /**
   * Port (what container will listen on).
   * @default 80
   */
  readonly port?: number;

  /** Name of the ConfigMap with configuration files that should be mounted for this container. */
  readonly configMap: string;

  /** Overrides for resource requirements and limits for the container. */
  readonly resources?: ResourceRequirements;

  /** Indicates that the Pod has successfully initialized. Container will be restarted if the probe fails. */
  readonly startupProbe?: Probe;

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

export interface WebServiceProps
  extends ServiceAnnotations,
    ContainerProps,
    WorkloadProps {
  /**
   * Static number of replicas. Cannot be specified with `horizontalPodAutoscaler`.
   */
  readonly replicas?: number;

  /**
   * Horizontal pod autoscaler props. Cannot be specified with `replicas`.
   */
  readonly horizontalPodAutoscaler?: HorizontalPodAutoscalerProps;

  /**
   * Port (what application container will listen on).
   * @default 3000
   */
  readonly port?: number;

  /**
   * Nginx container props.
   */
  readonly nginx?: NginxContainerProps;

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
   * Custom selector labels, they will be merged with the default app, role, and instance.
   * They will be applied to the workload, the pod and the service.
   * @default { app: "<app label from chart>", role: "server", instance: "<construct id>" }
   */
  readonly selectorLabels?: { [key: string]: string };

  /**
   * Domain name for TLS certificate discovery.
   * @see https://kubernetes-sigs.github.io/aws-load-balancer-controller/v2.3/guide/ingress/cert_discovery/
   */
  readonly tlsDomain?: string | string[];

  /**
   * Whether to include Ingress and provision an Application Load Balancer.
   * @default true
   */
  readonly includeIngress?: boolean;

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
   * Label overrides for making the load balancer name.
   * Helpful for making the load balancer name shorter.
   */
  readonly loadBalancerLabels?: {
    instance?: string;
  };

  /**
   * Custom function to generate load balancer name.
   * @param namespace Namespace of the service.
   * @param instanceLabels Deployment's labels
   */
  readonly makeLoadBalancerName?: (
    namespace: string | undefined,
    instanceLabels: { [key: string]: string },
  ) => string;

  /**
   * Pod's priority class.
   * @default "web"
   */
  readonly priorityClassName?: string;

  /**
   * Hostname to add External DNS record for the ingress.
   */
  readonly externalHostname?: string;

  /**
   * Additional external hostnames, they will be added as Ingress rules.
   */
  readonly additionalExternalHostnames?: string[];
}
