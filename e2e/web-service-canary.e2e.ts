import { Construct } from "constructs";
import { App } from "cdk8s";

import { EnvFromSource, IntOrString, Quantity } from "../imports/k8s";
import {
  WebService,
  TalisShortRegion,
  TalisDeploymentEnvironment,
  TalisChart,
  TalisChartProps,
  ConfigMap,
  Secret,
  getDockerTag,
  getCanaryStage,
} from "../lib";
import { getBuildWatermark, makeTtlTimestamp } from "./test-util";

export interface WebServiceCanaryChartProps extends TalisChartProps {
  domain: string;
}

export class WebServiceCanaryChart extends TalisChart {
  constructor(scope: Construct, props: WebServiceCanaryChartProps) {
    super(scope, { app: "cdk8s-e2e-canary", release: "test", ...props });

    const { domain, environment, watermark } = props;
    const applicationPort = 9898;
    const podinfoVersion = getDockerTag(
      "PODINFO_VERSION",
      environment,
      "6.1.3",
    );
    const stage = getCanaryStage("STAGE", "full");

    const envConfig = new ConfigMap(this, "config", {
      data: {
        WATERMARK: watermark,
      },
    });

    const envSecret = new Secret(this, "secret", {
      envFiles: [`${__dirname}/secret.env`],
    });

    const envFrom: EnvFromSource[] = [
      { configMapRef: { name: envConfig.name } },
      { secretRef: { name: envSecret.name } },
    ];

    new WebService(this, "web-svc", {
      canary: true,
      stage: stage,
      description: "podinfo web service",
      image: `docker.io/stefanprodan/podinfo:${podinfoVersion}`,
      release: podinfoVersion,
      command: ["./podinfo", `--port=${applicationPort}`],
      replicas: 2,
      tlsDomain: `*.${domain}`,
      externalUrl: `https://cdk8s-e2e-${watermark}-web-service-canary.${domain}/`,
      repositoryUrl: "https://github.com/stefanprodan/podinfo",
      issuesUrl: "https://github.com/talis/talis-cdk8s-constructs/issues",
      chatUrl: "None",
      graphsUrl: "None",
      logsUrl: "None",
      runbookUrl: "None",
      uptimeUrl: "None",
      port: applicationPort,
      envFrom: envFrom,
      loadBalancerLabels: {
        instance: "web",
      },
      resources: {
        requests: {
          cpu: Quantity.fromString("10m"),
          memory: Quantity.fromString("16Mi"),
        },
        limits: {
          cpu: Quantity.fromString("100m"),
          memory: Quantity.fromString("64Mi"),
        },
      },
      livenessProbe: {
        httpGet: {
          path: "/healthz",
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
          path: "/readyz",
          port: IntOrString.fromNumber(applicationPort),
        },
        initialDelaySeconds: 0,
        periodSeconds: 30,
        failureThreshold: 3,
        successThreshold: 1,
        timeoutSeconds: 2,
      },
    });
  }
}

const app = new App();
new WebServiceCanaryChart(app, {
  domain: "talis.io",
  environment: TalisDeploymentEnvironment.BUILD,
  region: TalisShortRegion.LOCAL,
  watermark: getBuildWatermark(),
  ttl: makeTtlTimestamp(),
});
app.synth();
