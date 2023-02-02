import { ApiObject, Testing } from "cdk8s";
import {
  DeploymentSpec,
  IntOrString,
  IoK8SApiAppsV1DeploymentStrategyType,
  KubeCronJob,
  KubeDaemonSet,
  KubeDeployment,
  KubeHorizontalPodAutoscalerV2,
  KubeJob,
  KubePod,
  KubeStatefulSet,
  PodSpec,
  Quantity,
  ResourceRequirements,
} from "../../imports/k8s";
import {
  TalisChart,
  TalisChartProps,
  TalisShortRegion,
  TalisDeploymentEnvironment,
} from "../../lib";

const defaultProps = {
  app: "my-app",
  environment: TalisDeploymentEnvironment.TEST,
  region: TalisShortRegion.EU,
  watermark: "test",
};

function makePodSpec(resources?: ResourceRequirements): PodSpec {
  return {
    containers: [
      {
        name: "my-container",
        image: "talis/app:v1",
        resources: resources ?? {
          requests: {
            cpu: Quantity.fromString("100m"),
            memory: Quantity.fromString("128Mi"),
          },
        },
      },
    ],
  };
}

function makePod(
  chart: TalisChart,
  id = "my-pod",
  resources?: ResourceRequirements
) {
  return new KubePod(chart, id, {
    spec: makePodSpec(resources),
  });
}

function makeDeployment(
  chart: TalisChart,
  id = "my-deploy",
  spec: Partial<DeploymentSpec> = {}
) {
  return new KubeDeployment(chart, id, {
    spec: {
      selector: {
        matchLabels: {
          app: "my-app",
        },
      },
      template: {
        metadata: {
          labels: {
            app: "my-app",
          },
        },
        spec: makePodSpec(),
        ...spec.template,
      },
      ...spec,
    },
  });
}

describe("TalisChart", () => {
  test("Creates a namespace", () => {
    const app = Testing.app();
    const chart = new TalisChart(app, {
      app: "my-app",
      environment: TalisDeploymentEnvironment.PRODUCTION,
      region: TalisShortRegion.EU,
      watermark: "test",
      includeResourceQuota: false,
    });
    const results = Testing.synth(chart);
    expect(results).toHaveLength(1);
    expect(results[0].kind).toEqual("Namespace");
  });

  test("Sets standard labels on objects", () => {
    const app = Testing.app();
    const chart = new TalisChart(app, {
      app: "my-app",
      environment: TalisDeploymentEnvironment.PRODUCTION,
      region: TalisShortRegion.EU,
      watermark: "test",
      includeResourceQuota: false,
    });

    new ApiObject(chart, "foo", {
      apiVersion: "v1",
      kind: "Foo",
    });

    const results = Testing.synth(chart);
    expect(results).toHaveLength(2);
    const expected = {
      app: "my-app",
      environment: TalisDeploymentEnvironment.PRODUCTION,
      "managed-by": "cdk8s",
      region: TalisShortRegion.EU,
      service: "my-app-eu",
    };
    expect(results[0].metadata.labels).toEqual(expected);
    expect(results[1].metadata.labels).toEqual(expected);
  });

  test("Allows to set custom labels on objects", () => {
    const app = Testing.app();
    const chart = new TalisChart(app, {
      app: "my-app",
      environment: TalisDeploymentEnvironment.STAGING,
      watermark: "test",
      region: TalisShortRegion.EU,
      labels: {
        foo: "bar",
      },
    });

    new ApiObject(chart, "foo", {
      apiVersion: "v1",
      kind: "Foo",
    });

    new ApiObject(chart, "bar", {
      apiVersion: "v1",
      kind: "Bar",
    });

    const results = Testing.synth(chart);
    expect(results).toHaveLength(4);
    const expected = {
      app: "my-app",
      environment: TalisDeploymentEnvironment.STAGING,
      foo: "bar",
      "managed-by": "cdk8s",
      region: TalisShortRegion.EU,
      service: "my-app-staging-eu",
    };
    expect(results[0].metadata.labels).toEqual(expected);
    expect(results[1].metadata.labels).toEqual(expected);
    expect(results[2].metadata.labels).toEqual(expected);
    expect(results[3].metadata.labels).toEqual(expected);
  });

  test("Sets app label and property verbatim", () => {
    const app = Testing.app();
    const chart = new TalisChart(app, {
      app: "my-app",
      environment: TalisDeploymentEnvironment.ONDEMAND,
      region: TalisShortRegion.EU,
      watermark: "plat-123",
    });
    new ApiObject(chart, "foo", {
      apiVersion: "v1",
      kind: "Foo",
    });
    expect(chart.app).toEqual("my-app");
    const results = Testing.synth(chart);
    expect(results[0].metadata.labels.app).toEqual("my-app");
  });

  const namespaceTests: (TalisChartProps & { expected: string })[] = [
    {
      environment: TalisDeploymentEnvironment.STAGING,
      region: TalisShortRegion.EU,
      watermark: "test",
      expected: "my-app-test",
    },
    {
      environment: TalisDeploymentEnvironment.PRODUCTION,
      region: TalisShortRegion.CANADA,
      watermark: "test",
      expected: "my-app-test",
    },
    {
      environment: TalisDeploymentEnvironment.ONDEMAND,
      region: TalisShortRegion.EU,
      watermark: "plat-123",
      expected: "my-app-plat-123",
    },
  ];
  namespaceTests.forEach(({ environment, region, watermark, expected }) => {
    test(`Creates namespace from app and watermark and sets property ${environment}-${region}`, () => {
      const app = Testing.app();
      const chart = new TalisChart(app, {
        app: "my-app",
        environment: environment,
        region: region,
        watermark: watermark,
        includeResourceQuota: false,
      });
      new ApiObject(chart, "foo", {
        apiVersion: "v1",
        kind: "Foo",
      });
      expect(chart.namespace).toEqual(expected);
      const results = Testing.synth(chart);
      expect(results).toHaveLength(2);
      expect(results[0].metadata.name).toEqual(expected);
      expect(results[1].metadata.namespace).toEqual(expected);
    });
  });

  test("Allows to specify the namespace", () => {
    const app = Testing.app();
    const chart = new TalisChart(app, {
      app: "my-app",
      environment: TalisDeploymentEnvironment.DEVELOPMENT,
      region: TalisShortRegion.LOCAL,
      watermark: "my-watermark",
      namespace: "custom-namespace",
      includeResourceQuota: false,
    });
    new ApiObject(chart, "foo", {
      apiVersion: "v1",
      kind: "Foo",
    });
    expect(chart.namespace).toEqual("custom-namespace");
    const results = Testing.synth(chart);
    expect(results).toHaveLength(2);
    expect(results[0].metadata.name).toEqual("custom-namespace");
    expect(results[1].metadata.namespace).toEqual("custom-namespace");
  });

  const serviceLabelTests: (TalisChartProps & { expected: string })[] = [
    {
      environment: TalisDeploymentEnvironment.STAGING,
      region: TalisShortRegion.EU,
      watermark: "test",
      expected: "my-app-staging-eu",
    },
    {
      environment: TalisDeploymentEnvironment.PRODUCTION,
      region: TalisShortRegion.EU,
      watermark: "test",
      expected: "my-app-eu",
    },
    {
      environment: TalisDeploymentEnvironment.PRODUCTION,
      region: TalisShortRegion.CANADA,
      watermark: "test",
      expected: "my-app-ca",
    },
    {
      environment: TalisDeploymentEnvironment.ONDEMAND,
      region: TalisShortRegion.EU,
      watermark: "plat-123",
      expected: "my-app-plat-123-ondemand-eu",
    },
    {
      environment: TalisDeploymentEnvironment.PREVIEW,
      region: TalisShortRegion.EU,
      watermark: "test",
      expected: "my-app-test-preview-eu",
    },
  ];
  serviceLabelTests.forEach(({ environment, region, watermark, expected }) => {
    test(`Sets service label for ${environment}-${region}`, () => {
      const app = Testing.app();
      const chart = new TalisChart(app, {
        app: "my-app",
        environment: environment,
        region: region,
        watermark: watermark,
      });
      new ApiObject(chart, "foo", {
        apiVersion: "v1",
        kind: "Foo",
      });
      const results = Testing.synth(chart);
      expect(results[0].metadata.labels.service).toEqual(expected);
    });
  });

  const ttlTests = [
    {
      environment: TalisDeploymentEnvironment.ONDEMAND,
      region: TalisShortRegion.EU,
      watermark: "test",
      ttl: 1234567890,
      expected: "1234567890",
    },
    {
      environment: TalisDeploymentEnvironment.PREVIEW,
      region: TalisShortRegion.EU,
      watermark: "test",
      ttl: 1234567890,
      expected: "1234567890",
    },
  ];

  ttlTests.forEach(({ environment, region, watermark, ttl, expected }) => {
    test(`Allows to specify TTL for ${environment}-${region}`, () => {
      const app = Testing.app();
      const chart = new TalisChart(app, {
        app: "my-app",
        environment,
        region,
        watermark,
        ttl,
        includeResourceQuota: false,
      });

      new ApiObject(chart, "foo", {
        apiVersion: "v1",
        kind: "Foo",
      });

      const results = Testing.synth(chart);
      expect(results).toHaveLength(2);
      expect(results[0].metadata.labels).toHaveProperty("ttl", expected);
      expect(results[1].metadata.labels).not.toHaveProperty("ttl", expected);
    });
  });

  describe("ResourceQuota", () => {
    test("Creates a ResourceQuota by default", () => {
      const app = Testing.app();
      const chart = new TalisChart(app, defaultProps);
      const results = Testing.synth(chart);
      expect(results).toHaveLength(2);
      expect(results[0].kind).toEqual("Namespace");
      const quota = results.find((obj) => obj.kind === "ResourceQuota");
      expect(quota.spec).toEqual({
        hard: {
          cpu: "0m",
          memory: "0Mi",
          pods: 0,
        },
      });
    });

    test("Calculates ResourceQuota for a single Pod", () => {
      const app = Testing.app();
      const chart = new TalisChart(app, defaultProps);
      makePod(chart);
      const results = Testing.synth(chart);
      const quota = results.find((obj) => obj.kind === "ResourceQuota");
      expect(quota.spec).toEqual({
        hard: {
          cpu: "100m",
          memory: "128Mi",
          pods: 1,
        },
      });
    });

    test("Gets implicit request from a limit", () => {
      const app = Testing.app();
      const chart = new TalisChart(app, defaultProps);
      makePod(chart, "my-pod", {
        requests: {
          cpu: Quantity.fromNumber(0.2),
        },
        limits: {
          memory: Quantity.fromString("128Mi"),
        },
      });
      const results = Testing.synth(chart);
      const quota = results.find((obj) => obj.kind === "ResourceQuota");
      expect(quota.spec).toEqual({
        hard: {
          cpu: "200m",
          memory: "128Mi",
          pods: 1,
        },
      });
    });

    test("Calculates ResourceQuota for a Deployment", () => {
      const app = Testing.app();
      const chart = new TalisChart(app, defaultProps);
      makeDeployment(chart);
      const results = Testing.synth(chart);
      const quota = results.find((obj) => obj.kind === "ResourceQuota");
      expect(quota.spec).toEqual({
        hard: {
          cpu: "200m",
          memory: "256Mi",
          pods: 2,
        },
      });
    });

    test("Calculates ResourceQuota for a Deployment with replicas", () => {
      const app = Testing.app();
      const chart = new TalisChart(app, defaultProps);
      makeDeployment(chart, "my-deploy", {
        replicas: 3,
      });
      const results = Testing.synth(chart);
      const quota = results.find((obj) => obj.kind === "ResourceQuota");
      expect(quota.spec).toEqual({
        hard: {
          cpu: "400m",
          memory: "512Mi",
          pods: 4,
        },
      });
    });

    test("Calculates ResourceQuota for a Deployment with static surge", () => {
      const app = Testing.app();
      const chart = new TalisChart(app, defaultProps);
      makeDeployment(chart, "my-deploy", {
        replicas: 3,
        strategy: {
          type: IoK8SApiAppsV1DeploymentStrategyType.ROLLING_UPDATE,
          rollingUpdate: {
            maxSurge: IntOrString.fromNumber(2),
          },
        },
      });
      const results = Testing.synth(chart);
      const quota = results.find((obj) => obj.kind === "ResourceQuota");
      expect(quota.spec).toEqual({
        hard: {
          cpu: "500m",
          memory: "640Mi",
          pods: 5,
        },
      });
    });

    test("Calculates ResourceQuota for a Deployment with percentage surge", () => {
      const app = Testing.app();
      const chart = new TalisChart(app, defaultProps);
      makeDeployment(chart, "my-deploy", {
        replicas: 3,
        strategy: {
          type: IoK8SApiAppsV1DeploymentStrategyType.ROLLING_UPDATE,
          rollingUpdate: {
            maxSurge: IntOrString.fromString("90%"),
          },
        },
      });
      const results = Testing.synth(chart);
      const quota = results.find((obj) => obj.kind === "ResourceQuota");
      expect(quota.spec).toEqual({
        hard: {
          cpu: "600m",
          memory: "768Mi",
          pods: 6,
        },
      });
    });

    test("Calculates ResourceQuota for a Deployment with autoscaling", () => {
      const app = Testing.app();
      const chart = new TalisChart(app, defaultProps);
      const deployment = makeDeployment(chart);
      new KubeHorizontalPodAutoscalerV2(chart, "hpa", {
        spec: {
          scaleTargetRef: {
            apiVersion: deployment.apiVersion,
            kind: deployment.kind,
            name: deployment.name,
          },
          minReplicas: 1,
          maxReplicas: 5,
          metrics: [
            {
              type: "Resource",
              resource: {
                name: "cpu",
                target: {
                  type: "Utilization",
                  averageUtilization: 80,
                },
              },
            },
          ],
        },
      });
      const results = Testing.synth(chart);
      const quota = results.find((obj) => obj.kind === "ResourceQuota");
      expect(quota.spec).toEqual({
        hard: {
          cpu: "700m",
          memory: "896Mi",
          pods: 7,
        },
      });
    });

    test("Calculates ResourceQuota for mixed units", () => {
      const app = Testing.app();
      const chart = new TalisChart(app, defaultProps);
      makePod(chart, "pod-numeric", {
        requests: {
          cpu: Quantity.fromNumber(0.5),
          memory: Quantity.fromNumber(16777216),
        },
      });
      makePod(chart, "pod-gibi", {
        requests: {
          cpu: Quantity.fromString("1"),
          memory: Quantity.fromString("1Gi"),
        },
      });
      makePod(chart, "pod-mebi", {
        requests: {
          cpu: Quantity.fromString("200m"),
          memory: Quantity.fromString("128Mi"),
        },
      });
      makePod(chart, "pod-kibi", {
        requests: {
          cpu: Quantity.fromString("200m"),
          memory: Quantity.fromString("16384Ki"),
        },
      });
      makePod(chart, "pod-giga", {
        requests: {
          cpu: Quantity.fromNumber(0.2),
          memory: Quantity.fromString("0.5G"),
        },
      });
      makePod(chart, "pod-mega", {
        requests: {
          cpu: Quantity.fromNumber(0.2),
          memory: Quantity.fromString("24M"),
        },
      });
      makePod(chart, "pod-kilo", {
        requests: {
          cpu: Quantity.fromNumber(0.1),
          memory: Quantity.fromString("17024K"),
        },
      });
      const results = Testing.synth(chart);
      const quota = results.find((obj) => obj.kind === "ResourceQuota");
      expect(quota.spec).toEqual({
        hard: {
          cpu: "2400m",
          memory: "1700Mi",
          pods: 7,
        },
      });
    });

    test("Calculates ResourceQuota for different workload kinds", () => {
      const app = Testing.app();
      const chart = new TalisChart(app, defaultProps);
      new KubePod(chart, "pod", {
        spec: makePodSpec(),
      });
      new KubeCronJob(chart, "cronjob", {
        spec: {
          schedule: "0 0 * * *",
          jobTemplate: {
            spec: {
              template: {
                spec: makePodSpec(),
              },
            },
          },
        },
      });
      new KubeDaemonSet(chart, "daemonset", {
        spec: {
          selector: { matchLabels: { app: "my-daemonset" } },
          template: {
            metadata: { labels: { app: "my-daemonset" } },
            spec: makePodSpec(),
          },
        },
      });
      new KubeDeployment(chart, "deployment", {
        spec: {
          selector: { matchLabels: { app: "my-deployment" } },
          template: {
            metadata: { labels: { app: "my-deployment" } },
            spec: makePodSpec(),
          },
        },
      });
      new KubeJob(chart, "job", {
        spec: {
          template: {
            spec: makePodSpec(),
          },
        },
      });
      new KubeStatefulSet(chart, "statefulset", {
        spec: {
          serviceName: "some-service",
          selector: { matchLabels: { app: "my-daemonset" } },
          template: {
            metadata: { labels: { app: "my-daemonset" } },
            spec: makePodSpec(),
          },
        },
      });
      const results = Testing.synth(chart);
      const quota = results.find((obj) => obj.kind === "ResourceQuota");
      expect(quota.spec).toEqual({
        hard: {
          cpu: "1100m",
          memory: "1408Mi",
          pods: 11,
        },
      });
    });

    test("Throws an error when workload is missing containers", () => {
      const app = Testing.app();
      const chart = new TalisChart(app, defaultProps);
      new KubePod(chart, "my-pod");
      expect(() => Testing.synth(chart)).toThrow(
        "Could not find containers in Pod/my-pod"
      );
    });

    test("Throws an error when cpu request is missing", () => {
      const app = Testing.app();
      const chart = new TalisChart(app, defaultProps);
      makePod(chart, "my-pod", {
        requests: {
          memory: Quantity.fromString("128Mi"),
        },
      });
      expect(() => Testing.synth(chart)).toThrow(
        "No cpu requests found in Pod/my-pod"
      );
    });

    test("Throws an error when memory request is missing", () => {
      const app = Testing.app();
      const chart = new TalisChart(app, defaultProps);
      makePod(chart, "my-pod", {
        requests: {
          cpu: Quantity.fromString("100m"),
        },
      });
      expect(() => Testing.synth(chart)).toThrow(
        "No memory requests found in Pod/my-pod"
      );
    });
  });
});
