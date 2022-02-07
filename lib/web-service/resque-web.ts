import { Construct } from "constructs";
import { WebService, WebServiceProps } from ".";
import { Quantity } from "../../imports/k8s";

export interface ResqueWebProps
  extends Partial<Omit<WebServiceProps, "horizontalPodAutoscaler">> {
  readonly externalUrl: string;
}

/**
 * Resque Web Service
 */
export class ResqueWeb extends Construct {
  constructor(scope: Construct, id: string, props: ResqueWebProps) {
    super(scope, id);

    const release = props.release ?? "stable";

    new WebService(this, id, {
      // Service annotations
      description: "Frontend to the Resque job queue system",
      repositoryUrl: "https://github.com/talis/resque-web-container",
      issuesUrl: "https://github.com/talis/platform/issues",
      chatUrl: "https://talis.slack.com/archives/C04P9DPCX",
      incidentsUrl: "None",
      runbookUrl: "None",
      logsUrl: "None",
      graphsUrl: "None",
      eksDashboardUrl: "None",
      uptimeUrl: "None",

      // Ingress options
      internal: true,
      canary: false,
      selectorLabels: {
        app: "resque",
        ...props.selectorLabels,
      },
      ingressAnnotations: {
        "alb.ingress.kubernetes.io/ssl-redirect": "443",
      },

      // Container options
      image: `talis/resque-web:${release}`,
      release: release,
      replicas: props.replicas ?? 1,
      port: 3000,
      resources: {
        requests: {
          cpu: Quantity.fromString("50m"),
          memory: Quantity.fromString("100Mi"),
        },
        limits: {
          cpu: Quantity.fromString("100m"),
          memory: Quantity.fromString("200Mi"),
        },
      },

      // Overrides
      ...props,
    });
  }
}
