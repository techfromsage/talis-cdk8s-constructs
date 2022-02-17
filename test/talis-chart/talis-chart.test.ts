import { ApiObject, Testing } from "cdk8s";
import { TalisChart, TalisChartProps } from "../../lib";

describe("TalisChart", () => {
  test("Creates a namespace", () => {
    const app = Testing.app();
    const chart = new TalisChart(app, {
      app: "my-app",
      environment: "production",
      region: "eu",
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
      environment: "production",
      region: "eu",
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
      environment: "production",
      "managed-by": "cdk8s",
      region: "eu",
      service: "my-app-eu",
    };
    expect(results[0].metadata.labels).toEqual(expected);
    expect(results[1].metadata.labels).toEqual(expected);
  });

  test("Allows to set custom labels on objects", () => {
    const app = Testing.app();
    const chart = new TalisChart(app, {
      app: "my-app",
      environment: "staging",
      watermark: "test",
      region: "eu",
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
      environment: "staging",
      foo: "bar",
      "managed-by": "cdk8s",
      region: "eu",
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
      environment: "ondemand",
      region: "eu",
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
      environment: "staging",
      region: "eu",
      watermark: "test",
      expected: "my-app-test",
    },
    {
      environment: "production",
      region: "ca",
      watermark: "test",
      expected: "my-app-test",
    },
    {
      environment: "ondemand",
      region: "eu",
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
      environment: "development",
      region: "local",
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
      environment: "staging",
      region: "eu",
      watermark: "test",
      expected: "my-app-staging-eu",
    },
    {
      environment: "production",
      region: "eu",
      watermark: "test",
      expected: "my-app-eu",
    },
    {
      environment: "production",
      region: "ca",
      watermark: "test",
      expected: "my-app-ca",
    },
    {
      environment: "ondemand",
      region: "eu",
      watermark: "plat-123",
      expected: "my-app-plat-123-ondemand-eu",
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
});
