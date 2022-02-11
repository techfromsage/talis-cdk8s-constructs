import { Construct } from "constructs";
import {
  getCanaryStage,
  nginxUtil,
  ConfigMap,
  WebService,
  TalisChart,
  TalisChartProps,
} from "../../lib";
import { IntOrString, Quantity } from "../../imports/k8s";
import path from "path";

export class AdvancedWebServiceChart extends TalisChart {
  constructor(scope: Construct, props: TalisChartProps) {
    super(scope, { app: "example", ...props });

    const stage = getCanaryStage("CANARY_STAGE");
    const release = process.env.RELEASE || "v0.2.1";

    const applicationPort = 8000;
    const appConfigMap = new ConfigMap(this, "config", {
      envFiles: [path.resolve(__dirname, "example.env")],
    });

    const nginxPort = 80;
    const nginxConfigMap = nginxUtil.createConfigMap(this, {
      includeDefaultConfig: true,
      includeSameSiteCookiesConfig: true,
      applicationPort,
      nginxPort,
    });

    new WebService(this, "web", {
      // Service annotations
      description: "Advanced web service",
      chatUrl: "https://example.slack.com/archives/ABCDEF123",
      eksDashboardUrl: "https://example.io/dashboard",
      externalUrl: "https://api.example.com/",
      graphsUrl: "https://example.io/grafana",
      incidentsUrl: "https://example.io/incidents",
      issuesUrl: "https://github.com/talis/talis-cdk8s-constructs/issues",
      logsUrl: "https://example.io/loki",
      repositoryUrl: "https://github.com/talis/talis-cdk8s-constructs",
      runbookUrl: "https://example.io/wiki/runbook",
      uptimeUrl: "https://example.io/uptime",
      tlsDomain: "*.example.com",

      // Pod details
      image: `docker.io/rodolphoalves/swapi-deno:${release}`,
      release,
      env: [
        {
          name: "ROLLUP_WATCH",
          value: "0",
        },
      ],
      envFrom: [
        {
          configMapRef: { name: appConfigMap.name },
        },
      ],
      resources: {
        requests: {
          cpu: Quantity.fromString("50m"),
          memory: Quantity.fromString("100Mi"),
        },
      },
      livenessProbe: {
        httpGet: {
          path: "/",
          port: IntOrString.fromNumber(applicationPort),
        },
        initialDelaySeconds: 0,
        periodSeconds: 10,
        failureThreshold: 3,
        successThreshold: 1,
        timeoutSeconds: 2,
      },
      readinessProbe: {
        httpGet: {
          path: "/portal",
          port: IntOrString.fromNumber(applicationPort),
        },
        initialDelaySeconds: 0,
        periodSeconds: 30,
        failureThreshold: 3,
        successThreshold: 1,
        timeoutSeconds: 2,
      },

      // Canary releases
      canary: true,
      stage,

      // Auto-scaling
      horizontalPodAutoscaler: {
        minReplicas: 1,
        maxReplicas: 5,
        cpuTargetUtilization: 50,
      },

      // Nginx reverse proxy
      port: applicationPort,
      nginx: {
        configMap: nginxConfigMap.name,
        port: nginxPort,
      },
    });
  }
}
