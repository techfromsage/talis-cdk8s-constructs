import { Chart, Testing } from "cdk8s";
import { KubeService, KubeStatefulSet } from "../../imports/k8s";
import { Memcached, MemcachedProps } from "../../lib";
import { makeChart } from "../test-util";

const requiredProps = {
  release: "v1",
};

function synthMemcached(props: MemcachedProps = requiredProps) {
  const chart = Testing.chart();
  new Memcached(chart, "memcached-test", props);
  const results = Testing.synth(chart);
  return results;
}

describe("Memcached", () => {
  describe("Props", () => {
    test("Minimal required props", () => {
      const chart = Testing.chart();
      new Memcached(chart, "memcached-test", requiredProps);
      const results = Testing.synth(chart);
      expect(results).toMatchSnapshot();
    });

    test("All the props", () => {
      const app = Testing.app();
      const chart = new Chart(app, "test", {
        namespace: "test",
        labels: {
          app: "my-app",
          environment: "test",
          region: "local",
        },
      });
      const selectorLabels = {
        app: "my-app",
        role: "memcached",
        instance: "test",
      };

      const allProps: Required<MemcachedProps> = {
        ...requiredProps,
        selectorLabels,
      };
      new Memcached(chart, "memcached-test", allProps);
      const results = Testing.synth(chart);
      expect(results).toMatchSnapshot();

      const statefulSet = results.find((obj) => obj.kind === "StatefulSet");
      expect(statefulSet).toHaveAllProperties(allProps, [
        "release",
        "selectorLabels",
      ]);
    });

    test("selectorLabels can override app", () => {
      const results = synthMemcached({
        ...requiredProps,
        selectorLabels: { app: "foobar" },
      });
      const sts = results.find((obj) => obj.kind === "StatefulSet");
      expect(sts).toHaveProperty("metadata.labels.app", "foobar");
      expect(sts).toHaveProperty("spec.selector.matchLabels.app", "foobar");
      expect(sts).toHaveProperty("spec.template.metadata.labels.app", "foobar");
    });

    test("selectorLabels can override role", () => {
      const results = synthMemcached({
        ...requiredProps,
        selectorLabels: { role: "cache" },
      });
      const sts = results.find((obj) => obj.kind === "StatefulSet");
      expect(sts).toHaveProperty("metadata.labels.role", "cache");
      expect(sts).toHaveProperty("spec.selector.matchLabels.role", "cache");
      expect(sts).toHaveProperty("spec.template.metadata.labels.role", "cache");
    });
  });

  describe("Object instances", () => {
    test("Exposes service object through property", () => {
      const chart = makeChart();
      const memcached = new Memcached(chart, "memcached-test", requiredProps);
      expect(memcached.service).toBeDefined();
      expect(memcached.service).toBeInstanceOf(KubeService);
      expect(memcached.service.name).toEqual("memcached-test");
    });

    test("Exposes statefulSet object through property", () => {
      const chart = makeChart();
      const memcached = new Memcached(chart, "memcached-test", requiredProps);
      expect(memcached.statefulSet).toBeDefined();
      expect(memcached.statefulSet).toBeInstanceOf(KubeStatefulSet);
      expect(memcached.statefulSet.name).toEqual("memcached-test-sts");
    });
  });

  describe("Container release", () => {
    test("Default container release", () => {
      const results = synthMemcached();
      const sts = results.find((obj) => obj.kind === "StatefulSet");
      expect(sts).toHaveProperty(
        "spec.template.spec.containers[0].image",
        "memcached:v1"
      );
    });

    test("Container release set explicitly", () => {
      const results = synthMemcached({
        ...requiredProps,
        release: "12345",
      });
      const sts = results.find((obj) => obj.kind === "StatefulSet");
      expect(sts).toHaveProperty(
        "spec.template.spec.containers[0].image",
        "memcached:12345"
      );
    });
  });

  describe("getDnsName", () => {
    test("Builds a DNS name for the first Pod", () => {
      const chart = makeChart();
      const memcached = new Memcached(chart, "memcached-test", requiredProps);
      expect(memcached.getDnsName()).toBe(
        "memcached-test-sts-0.memcached-test"
      );
    });

    const tests: [number, string][] = [
      [0, "memcached-test-sts-0.memcached-test"],
      [1, "memcached-test-sts-1.memcached-test"],
      [3, "memcached-test-sts-3.memcached-test"],
    ];
    tests.forEach(([replica, expected]) => {
      test("Builds a string from non-empty parts", () => {
        const chart = makeChart();
        const memcached = new Memcached(chart, "memcached-test", requiredProps);
        expect(memcached.getDnsName(replica)).toBe(expected);
      });
    });
  });
});
