import { App } from "cdk8s";
import { Construct } from "constructs";

import {
  EnvFromSource,
  IntOrString,
  Quantity,
  ResourceRequirements,
} from "../imports/k8s";
import {
  BackgroundWorker,
  ConfigMap,
  CronJob,
  Job,
  Mongo,
  PodSpecRestartPolicy,
  Redis,
  ResqueWeb,
  Secret,
  TalisChart,
  TalisChartProps,
  TalisDeploymentEnvironment,
  TalisShortRegion,
  WebService,
} from "../lib";
import { getBuildWatermark, makeTtlTimestamp } from "./test-util";

export interface FullStackChartProps extends TalisChartProps {
  domain: string;
}

export class FullStackChart extends TalisChart {
  constructor(scope: Construct, props: FullStackChartProps) {
    super(scope, { app: "cdk8s-stack", release: "test", ...props });

    const { domain, watermark } = props;
    const applicationPort = 9898;
    const podinfoVersion = "6.1.3";
    const mongoVersion = "4.4.29";
    const redisVersion = "5.0.7";
    const busyboxVersion = "1.35.0";
    const busyboxImage = `docker.io/busybox:${busyboxVersion}`;
    const externalHostname = `cdk8s-e2e-${watermark}-web-service.${domain}`;
    const additionalHostname = `cdk8s-e2e-${watermark}-extra.${domain}`;
    const resqueHostname = `cdk8s-e2e-${watermark}-resque.${domain}`;

    const commonResources: ResourceRequirements = {
      requests: {
        cpu: Quantity.fromString("10m"),
        memory: Quantity.fromString("16Mi"),
      },
      limits: {
        cpu: Quantity.fromString("100m"),
        memory: Quantity.fromString("64Mi"),
      },
    };

    const mongo = new Mongo(this, "mongo", {
      release: mongoVersion,
      storageEngine: "wiredTiger",
    });
    const mongoHost = mongo.getDnsName();

    const redis = new Redis(this, "redis", {
      release: redisVersion,
    });
    const redisHost = redis.getDnsName();

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

    const initMongoContainer = mongo.getWaitForPortContainer();

    const initRedisContainer = redis.getWaitForPortContainer();

    new BackgroundWorker(this, "bg-worker", {
      image: busyboxImage,
      release: busyboxVersion,
      command: ["sh", "-c", "while true; do echo hello; sleep 1; done"],
      replicas: 2,
      resources: commonResources,
    });

    new CronJob(this, "cron-job", {
      schedule: "* * * * *",
      image: busyboxImage,
      release: busyboxVersion,
      command: ["sh", "-c", "echo 'hello world'"],
      restartPolicy: PodSpecRestartPolicy.NEVER,
      resources: commonResources,
    });

    new Job(this, "single-job", {
      initContainers: [initMongoContainer],
      image: `docker.io/mongo:${mongoVersion}`,
      release: mongoVersion,
      command: ["mongo", `--host=${mongoHost}`, "--eval", "db.stats()"],
      restartPolicy: PodSpecRestartPolicy.NEVER,
      resources: commonResources,
    });

    new ResqueWeb(this, "resque-web", {
      initContainers: [initRedisContainer],
      image: "docker.io/appwrite/resque-web:1.1.0",
      release: "1.1.0",
      tlsDomain: `*.${domain}`,
      externalHostname: resqueHostname,
      externalUrl: `https://${resqueHostname}/`,
      port: 5678,
      env: [
        {
          name: "RAILS_ENV",
          value: "production",
        },
        {
          name: "RESQUE_WEB_HOST",
          value: redisHost,
        },
      ],
    });

    new WebService(this, "web-svc", {
      initContainers: [initRedisContainer],
      description: "podinfo web service",
      image: `docker.io/stefanprodan/podinfo:${podinfoVersion}`,
      release: podinfoVersion,
      command: [
        "./podinfo",
        `--port=${applicationPort}`,
        `--cache-server=tcp://${redisHost}:${redis.port}`,
      ],
      replicas: 2,
      tlsDomain: `*.${domain}`,
      externalHostname: externalHostname,
      additionalExternalHostnames: [additionalHostname],
      externalUrl: `https://${externalHostname}/`,
      repositoryUrl: "https://github.com/stefanprodan/podinfo",
      issuesUrl: "https://github.com/talis/talis-cdk8s-constructs/issues",
      chatUrl: "None",
      graphsUrl: "None",
      logsUrl: "None",
      runbookUrl: "None",
      uptimeUrl: "None",
      port: applicationPort,
      envFrom: envFrom,
      resources: commonResources,
      loadBalancerLabels: {
        instance: "web",
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
new FullStackChart(app, {
  domain: "talis.io",
  environment: TalisDeploymentEnvironment.BUILD,
  region: TalisShortRegion.LOCAL,
  watermark: getBuildWatermark(),
  ttl: makeTtlTimestamp(),
});
app.synth();
