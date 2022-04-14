import { ApiObject, Testing } from "cdk8s";
import {
  TalisChart,
  TalisChartProps,
  TalisShortRegion,
  TalisDeploymentEnvironment,
} from "../../lib";

describe("TalisChart", () => {
  test("Creates a namespace", () => {
    const app = Testing.app();
    const chart = new TalisChart(app, {
      app: "my-app",
      environment: TalisDeploymentEnvironment.PRODUCTION,
      region: TalisShortRegion.EU,
      watermark: "test",
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
    expect(results).toHaveLength(3);
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
      });

      new ApiObject(chart, "foo", {
        apiVersion: "v1",
        kind: "Foo",
      });

      const results = Testing.synth(chart);
      expect(results).toHaveLength(2);
      expect(results[0].metadata.labels).toHaveProperty("ttl", expected);
      expect(results[1].metadata.labels).toHaveProperty("ttl", expected);
    });
  });
});
