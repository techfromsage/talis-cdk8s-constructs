import { Construct } from "constructs";
import { WebService, WebServiceProps } from ".";
import { IntOrString, Quantity } from "../../imports/k8s";
import { supportsTls } from "./tls-util";

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

    const hasProp = (key: string) =>
      Object.prototype.hasOwnProperty.call(props, key);
    const release = props.release ?? "stable";
    const applicationPort = props.port ?? 3000;
    const podDisruptionBudget = hasProp("podDisruptionBudget")
      ? props.podDisruptionBudget
      : undefined;

    const ingressAnnotations: { [key: string]: string } = {
      "alb.ingress.kubernetes.io/healthcheck-path": "/status",
    };
    if (supportsTls(props)) {
      ingressAnnotations["alb.ingress.kubernetes.io/ssl-redirect"] = "443";
    }

    new WebService(this, id, {
      // Service annotations
      description: "Frontend to the Resque job queue system",
      repositoryUrl: "https://github.com/talis/resque-web-container",
      issuesUrl: "https://github.com/talis/platform/issues",
      chatUrl: "https://talis.slack.com/archives/C04P9DPCX",
      runbookUrl: "None",
      logsUrl: "None",
      graphsUrl: "None",
      uptimeUrl: "None",

      // Container options
      image: `talis/resque-web:${release}`,
      release: release,
      replicas: props.replicas ?? 1,
      port: applicationPort,
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
      startupProbe: {
        httpGet: {
          path: "/status",
          port: IntOrString.fromNumber(applicationPort),
        },
        periodSeconds: 2,
        timeoutSeconds: 1,
        failureThreshold: 30,
      },
      livenessProbe: {
        httpGet: {
          path: "/status",
          port: IntOrString.fromNumber(applicationPort),
        },
        periodSeconds: 5,
        timeoutSeconds: 1,
        failureThreshold: 3,
        successThreshold: 1,
      },
      readinessProbe: {
        httpGet: {
          path: "/status",
          port: IntOrString.fromNumber(applicationPort),
        },
        periodSeconds: 5,
        timeoutSeconds: 1,
        failureThreshold: 3,
        successThreshold: 1,
      },

      // Ingress options
      internal: true,
      canary: false,

      // Overrides
      ...props,
      selectorLabels: {
        app: "resque",
        ...props.selectorLabels,
      },
      ingressAnnotations: {
        ...ingressAnnotations,
        ...props.ingressAnnotations,
      },
      podDisruptionBudget,
    });
  }
}
