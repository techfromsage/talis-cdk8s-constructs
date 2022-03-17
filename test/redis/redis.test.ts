import { Chart, Testing } from "cdk8s";
import { Redis, RedisProps } from "../../lib";

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

      new Redis(chart, "redis-test", {
        ...requiredProps,
        selectorLabels,
      });
      const results = Testing.synth(chart);
      expect(results).toMatchSnapshot();
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
});
