export interface ServiceRouteProps {
  /**
   * Service name.
   */
  readonly name: string;

  /**
   * Service port.
   */
  readonly port: number;

  /**
   * Service namespace.
   */
  readonly namespace: string;

  /**
   * Weight of the service. Has to be an integer in between 0 and 100.
   */
  readonly weight: number;
}

export interface IngressProps {
  /**
   * Custom labels, they will be merged with the default app, role, and instance.
   * @default { app: "<app label from chart>", role: "server", instance: "<construct id>" }
   */
  readonly labels?: { [key: string]: string };

  /**
   * ARN of one or more certificate managed by AWS Certificate Manager
   */
  readonly certificateArn?: string[];

  /**
   * Overrides for Ingress annotations.
   * @see https://kubernetes-sigs.github.io/aws-load-balancer-controller/v2.3/guide/ingress/annotations/
   */
  readonly ingressAnnotations?: { [key: string]: string };

  /**
   * Hostname to add External DNS record for the ingress.
   */
  readonly externalHostname?: string;

  /**
   * Hostnames, they will be added as Ingress rules.
   */
  readonly hostnames: string[];

  /**
   * Defines routing for each service. This will be used to create target groups for service weighting action.
   */
  readonly serviceRouting: ServiceRouteProps[];

  /**
   * Ingress class name.
   */
  readonly ingressClassName: string;

  /**
   * Ingress class priority, between -1000 and 1000
   */
  readonly ingressClassPriority?: number;

  /**
   * Application name.
   */
  readonly app: string;

  /**
   * Instance name.
   */
  readonly instance: string;
}
