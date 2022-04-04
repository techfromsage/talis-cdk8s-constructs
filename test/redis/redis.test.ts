import { Chart, Testing } from "cdk8s";
import { KubeService, KubeStatefulSet } from "../../imports/k8s";
import { Redis, RedisProps } from "../../lib";
import { makeChart } from "../test-util";

const requiredProps = {
  release: "v1",
};

function synthRedis(props: RedisProps = requiredProps) {
  const chart = Testing.chart();
  new Redis(chart, "redis-test", props);
  const results = Testing.synth(chart);
  return results;
}

describe("Redis", () => {
  describe("Props", () => {
    test("Minimal required props", () => {
      const chart = Testing.chart();
      new Redis(chart, "redis-test", requiredProps);
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
        role: "redis",
        instance: "test",
      };

      const allProps: Required<RedisProps> = {
        ...requiredProps,
        selectorLabels,
      };
      new Redis(chart, "redis-test", allProps);
      const results = Testing.synth(chart);
      expect(results).toMatchSnapshot();

      const statefulSet = results.find((obj) => obj.kind === "StatefulSet");
      expect(statefulSet).toHaveAllProperties(allProps, [
        "release",
        "selectorLabels",
      ]);
    });
  });

  describe("Object instances", () => {
    test("Exposes service object through property", () => {
      const chart = makeChart();
      const redis = new Redis(chart, "redis-test", requiredProps);
      expect(redis.service).toBeDefined();
      expect(redis.service).toBeInstanceOf(KubeService);
      expect(redis.service.name).toEqual("redis-test");
    });

    test("Exposes statefulSet object through property", () => {
      const chart = makeChart();
      const redis = new Redis(chart, "redis-test", requiredProps);
      expect(redis.statefulSet).toBeDefined();
      expect(redis.statefulSet).toBeInstanceOf(KubeStatefulSet);
      expect(redis.statefulSet.name).toEqual("redis-test-sts");
    });
  });

  describe("Container release", () => {
    test("Default container release", () => {
      const results = synthRedis();
      const job = results.find((obj) => obj.kind === "StatefulSet");
      expect(job).toHaveProperty(
        "spec.template.spec.containers[0].image",
        "redis:v1"
      );
    });

    test("Container release set explicitly", () => {
      const results = synthRedis({
        ...requiredProps,
        release: "12345",
      });
      const job = results.find((obj) => obj.kind === "StatefulSet");
      expect(job).toHaveProperty(
        "spec.template.spec.containers[0].image",
        "redis:12345"
      );
    });
  });

  describe("getDnsName", () => {
    test("Builds a DNS name for the first Pod", () => {
      const chart = makeChart();
      const redis = new Redis(chart, "redis-test", requiredProps);
      expect(redis.getDnsName()).toBe("redis-test-sts-0.redis-test");
    });

    const tests: [number, string][] = [
      [0, "redis-test-sts-0.redis-test"],
      [1, "redis-test-sts-1.redis-test"],
      [3, "redis-test-sts-3.redis-test"],
    ];
    tests.forEach(([replica, expected]) => {
      test("Builds a string from non-empty parts", () => {
        const chart = makeChart();
        const redis = new Redis(chart, "redis-test", requiredProps);
        expect(redis.getDnsName(replica)).toBe(expected);
      });
    });
  });
});
