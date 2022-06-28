import { Construct } from "constructs";
import { App } from "cdk8s";

import {
  IntOrString,
  Probe,
  Quantity,
  ResourceRequirements,
} from "../imports/k8s";
import {
  WebService,
  TalisShortRegion,
  TalisDeploymentEnvironment,
  TalisChart,
  TalisChartProps,
  Postgres,
  Secret,
  Memcached,
} from "../lib";
import { getBuildWatermark, makeTtlTimestamp } from "./test-util";

export class RubyOnRailsAppChart extends TalisChart {
  constructor(scope: Construct, props: TalisChartProps) {
    super(scope, { app: "cdk8s-rails", ...props });

    const applicationPort = 3000;
    const redmineVersion = "5.0.2";
    const postgresVersion = "14.4";
    const memcachedVersion = "1.6.15";
    const busyboxVersion = "1.35.0";

    const commonResources: ResourceRequirements = {
      requests: {
        cpu: Quantity.fromString("10m"),
        memory: Quantity.fromString("16Mi"),
      },
      limits: {
        cpu: Quantity.fromString("100m"),
        memory: Quantity.fromString("256Mi"),
      },
    };

    const postgresSecret = new Secret(this, "postgres-secret", {
      data: {
        POSTGRES_DB: "redmine",
        POSTGRES_USER: "redmine",
        POSTGRES_PASSWORD: "secret",
      },
    });

    const postgres = new Postgres(this, "postgres", {
      release: postgresVersion,
      storageSize: Quantity.fromString("1Gi"),
      resources: commonResources,
      envFrom: [
        {
          secretRef: {
            name: postgresSecret.name,
          },
        },
      ],
    });
    const postgresHost = postgres.getDnsName();

    const memcached = new Memcached(this, "memcached", {
      release: memcachedVersion,
    });
    const memcachedHost = memcached.getDnsName();

    const redmineProbe: Probe = {
      httpGet: {
        path: "/",
        port: IntOrString.fromNumber(applicationPort),
      },
      initialDelaySeconds: 0,
      periodSeconds: 10,
      failureThreshold: 3,
      successThreshold: 1,
      timeoutSeconds: 2,
    };

    new WebService(this, "redmine", {
      description: "Redmine web service",
      repositoryUrl: "https://github.com/redmine/redmine",
      issuesUrl: "https://github.com/talis/talis-cdk8s-constructs/issues",
      externalUrl: "None",
      chatUrl: "None",
      eksDashboardUrl: "None",
      graphsUrl: "None",
      incidentsUrl: "None",
      logsUrl: "None",
      runbookUrl: "None",
      uptimeUrl: "None",
      includeIngress: false,
      image: `docker.io/redmine:${redmineVersion}`,
      replicas: 1,
      release: redmineVersion,
      port: applicationPort,
      resources: commonResources,
      initContainers: [
        {
          name: "init-postgres",
          image: `docker.io/busybox:${busyboxVersion}`,
          command: [
            "sh",
            "-c",
            `until nc -vz -w1 ${postgresHost} 5432; do echo waiting for postgres; sleep 1; done`,
          ],
          resources: commonResources,
        },
        {
          name: "init-memcached",
          image: `docker.io/busybox:${busyboxVersion}`,
          command: [
            "sh",
            "-c",
            `until nc -vz -w1 ${memcachedHost} 11211; do echo waiting for memcached; sleep 1; done`,
          ],
          resources: commonResources,
        },
      ],
      env: [
        {
          name: "REDMINE_DB_POSTGRES",
          value: postgresHost,
        },
        {
          name: "REDMINE_DB_DATABASE",
          valueFrom: {
            secretKeyRef: {
              name: postgresSecret.name,
              key: "POSTGRES_DB",
            },
          },
        },
        {
          name: "REDMINE_DB_USERNAME",
          valueFrom: {
            secretKeyRef: {
              name: postgresSecret.name,
              key: "POSTGRES_USER",
            },
          },
        },
        {
          name: "REDMINE_DB_PASSWORD",
          valueFrom: {
            secretKeyRef: {
              name: postgresSecret.name,
              key: "POSTGRES_PASSWORD",
            },
          },
        },
        {
          name: "MEMCACHED_HOST",
          value: memcachedHost,
        },
        {
          name: "MEMCACHED_PORT",
          value: "11211",
        },
      ],
      startupProbe: {
        ...redmineProbe,
        failureThreshold: 60,
      },
      livenessProbe: redmineProbe,
      readinessProbe: redmineProbe,
    });
  }
}

const app = new App();
new RubyOnRailsAppChart(app, {
  environment: TalisDeploymentEnvironment.BUILD,
  region: TalisShortRegion.LOCAL,
  watermark: getBuildWatermark(),
  ttl: makeTtlTimestamp(),
});
app.synth();
