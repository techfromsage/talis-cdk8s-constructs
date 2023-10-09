import { ApiObject, Testing } from "cdk8s";
import { KubeDeployment } from "../../imports/k8s";
import { addLabels } from "../../lib";
import { makeChart } from "../test-util";

describe("metadata-util", () => {
  describe("addLabels", () => {
    test("adds labels to given ApiObjects", () => {
      const chart = makeChart();
      addLabels(
        [
          new ApiObject(chart, "config-map", {
            apiVersion: "v1",
            kind: "ConfigMap",
          }),
          new ApiObject(chart, "secret", {
            apiVersion: "v1",
            kind: "Secret",
          }),
          new ApiObject(chart, "service", {
            apiVersion: "v1",
            kind: "Service",
          }),
        ],
        { foo: "bar", baz: "qux" },
      );

      const results = Testing.synth(chart);

      const configMap = results.find((o) => o.kind === "ConfigMap");
      expect(configMap).toHaveProperty("metadata.labels.foo", "bar");
      expect(configMap).toHaveProperty("metadata.labels.baz", "qux");
      const secret = results.find((o) => o.kind === "Secret");
      expect(secret).toHaveProperty("metadata.labels.foo", "bar");
      expect(secret).toHaveProperty("metadata.labels.baz", "qux");
      const service = results.find((o) => o.kind === "Service");
      expect(service).toHaveProperty("metadata.labels.foo", "bar");
      expect(service).toHaveProperty("metadata.labels.baz", "qux");
    });

    test("adds labels to Pod templates", () => {
      const chart = makeChart();
      const template = {
        metadata: {
          labels: { app: "app" },
        },
        spec: {
          containers: [{ name: "app" }],
        },
      };
      addLabels(
        [
          new ApiObject(chart, "daemonSet", {
            apiVersion: "apps/v1",
            kind: "DaemonSet",
            spec: {
              selector: { matchLabels: { app: "app" } },
              template: template,
            },
          }),
          new ApiObject(chart, "deployment", {
            apiVersion: "apps/v1",
            kind: "Deployment",
            spec: {
              selector: { matchLabels: { app: "app" } },
              template: template,
            },
          }),
          new ApiObject(chart, "job", {
            apiVersion: "batch/v1",
            kind: "Job",
            spec: {
              selector: { matchLabels: { app: "app" } },
              template: template,
            },
          }),
          new ApiObject(chart, "statefulSet", {
            apiVersion: "apps/v1",
            kind: "StatefulSet",
            spec: {
              serviceName: "test",
              selector: { matchLabels: { app: "app" } },
              template: template,
            },
          }),
        ],
        { foo: "bar", baz: "qux" },
      );

      const results = Testing.synth(chart);

      const ds = results.find((o) => o.kind === "DaemonSet");
      expect(ds).toHaveProperty("metadata.labels.foo", "bar");
      expect(ds).toHaveProperty("metadata.labels.baz", "qux");
      expect(ds).toHaveProperty("spec.template.metadata.labels.foo", "bar");
      expect(ds).toHaveProperty("spec.template.metadata.labels.baz", "qux");

      const deploy = results.find((o) => o.kind === "Deployment");
      expect(deploy).toHaveProperty("metadata.labels.foo", "bar");
      expect(deploy).toHaveProperty("metadata.labels.baz", "qux");
      expect(deploy).toHaveProperty("spec.template.metadata.labels.foo", "bar");
      expect(deploy).toHaveProperty("spec.template.metadata.labels.baz", "qux");

      const job = results.find((o) => o.kind === "Job");
      expect(job).toHaveProperty("metadata.labels.foo", "bar");
      expect(job).toHaveProperty("metadata.labels.baz", "qux");
      expect(job).toHaveProperty("spec.template.metadata.labels.foo", "bar");
      expect(job).toHaveProperty("spec.template.metadata.labels.baz", "qux");

      const sts = results.find((o) => o.kind === "StatefulSet");
      expect(sts).toHaveProperty("metadata.labels.foo", "bar");
      expect(sts).toHaveProperty("metadata.labels.baz", "qux");
      expect(sts).toHaveProperty("spec.template.metadata.labels.foo", "bar");
      expect(sts).toHaveProperty("spec.template.metadata.labels.baz", "qux");
    });

    test("adds labels to imported constructs", () => {
      const chart = makeChart();
      addLabels(
        [
          new KubeDeployment(chart, "deployment", {
            spec: {
              selector: { matchLabels: { app: "app" } },
              template: {
                metadata: {
                  labels: { app: "app" },
                },
                spec: {
                  containers: [{ name: "app" }],
                },
              },
            },
          }),
        ],
        { foo: "bar", baz: "qux" },
      );

      const results = Testing.synth(chart);

      const deploy = results.find((o) => o.kind === "Deployment");
      expect(deploy).toHaveProperty("metadata.labels.foo", "bar");
      expect(deploy).toHaveProperty("metadata.labels.baz", "qux");
      expect(deploy).toHaveProperty("spec.template.metadata.labels.foo", "bar");
      expect(deploy).toHaveProperty("spec.template.metadata.labels.baz", "qux");
    });

    test("adds labels to Job and Pod templates in CronJob", () => {
      const chart = makeChart();
      addLabels(
        [
          new ApiObject(chart, "cronJob", {
            apiVersion: "batch/v1",
            kind: "CronJob",
            spec: {
              schedule: "0 0 * * *",
              jobTemplate: {
                metadata: {
                  labels: { app: "app" },
                },
                spec: {
                  template: {
                    metadata: {
                      labels: { app: "app" },
                    },
                    spec: {
                      containers: [{ name: "app" }],
                    },
                  },
                },
              },
            },
          }),
        ],
        { foo: "bar", baz: "qux" },
      );

      const results = Testing.synth(chart);

      const cron = results.find((o) => o.kind === "CronJob");
      expect(cron).toHaveProperty("metadata.labels.foo", "bar");
      expect(cron).toHaveProperty("metadata.labels.baz", "qux");
      expect(cron).toHaveProperty(
        "spec.jobTemplate.metadata.labels.foo",
        "bar",
      );
      expect(cron).toHaveProperty(
        "spec.jobTemplate.metadata.labels.baz",
        "qux",
      );
      expect(cron).toHaveProperty(
        "spec.jobTemplate.spec.template.metadata.labels.foo",
        "bar",
      );
      expect(cron).toHaveProperty(
        "spec.jobTemplate.spec.template.metadata.labels.baz",
        "qux",
      );
    });
  });

  test("throws an error when a label is already set on a selector", () => {
    const chart = makeChart();
    expect(() => {
      addLabels(
        [
          new KubeDeployment(chart, "deployment", {
            spec: {
              selector: { matchLabels: { app: "test-app" } },
              template: {
                metadata: {
                  labels: { app: "test-app" },
                },
                spec: {
                  containers: [{ name: "test" }],
                },
              },
            },
          }),
        ],
        { app: "different-app", foo: "bar" },
      );
    }).toThrowError("Setting app label would overwrite selector");
  });

  test("allows to set a label that is used in selector if values are the same", () => {
    const chart = makeChart();
    expect(() => {
      addLabels(
        [
          new KubeDeployment(chart, "deployment", {
            spec: {
              selector: { matchLabels: { app: "test-app" } },
              template: {
                metadata: {
                  labels: { app: "test-app" },
                },
                spec: {
                  containers: [{ name: "test" }],
                },
              },
            },
          }),
        ],
        { app: "test-app", foo: "bar" },
      );
    }).not.toThrowError();
  });
});
