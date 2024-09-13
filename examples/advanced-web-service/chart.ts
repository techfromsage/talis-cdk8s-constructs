import { Construct } from "constructs";
import path from "node:path";
import { IntOrString, Quantity } from "../../imports/k8s";
import {
  ConfigMap,
  getCanaryStage,
  getDockerTag,
  nginxUtil,
  TalisChart,
  TalisChartProps,
  WebService,
} from "../../lib";

export class AdvancedWebServiceChart extends TalisChart {
  constructor(scope: Construct, props: TalisChartProps) {
    const release = getDockerTag("RELEASE", props.environment, "v0.2.1");
    super(scope, { app: "advanced", release, ...props });

    const stage = getCanaryStage("CANARY_STAGE");

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
      externalUrl: "https://api.example.com/",
      graphsUrl: "https://example.io/grafana",
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
