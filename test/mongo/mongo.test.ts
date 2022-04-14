import { Chart, Testing } from "cdk8s";
import { KubeService, KubeStatefulSet, Quantity } from "../../imports/k8s";
import { Mongo, MongoProps } from "../../lib";
import { makeChart } from "../test-util";

const requiredProps = {
  release: "v1",
};

function synthMongo(props: MongoProps = requiredProps) {
  const chart = Testing.chart();
  new Mongo(chart, "mongo-test", props);
  const results = Testing.synth(chart);
  return results;
}

describe("Mongo", () => {
  describe("Props", () => {
    test("Minimal required props", () => {
      const chart = Testing.chart();
      new Mongo(chart, "mongo-test", requiredProps);
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
        role: "mongo",
        instance: "test",
      };

      const allProps: Required<MongoProps> = {
        ...requiredProps,
        selectorLabels,
        storageEngine: "wiredTiger",
        storageSize: Quantity.fromString("20Gi"),
        resources: {
          limits: {
            cpu: Quantity.fromString("100m"),
            memory: Quantity.fromString("500Mi"),
          },
        },
      };
      new Mongo(chart, "mongo-test", allProps);
      const results = Testing.synth(chart);
      expect(results).toMatchSnapshot();

      const statefulSet = results.find((obj) => obj.kind === "StatefulSet");
      expect(statefulSet).toHaveAllProperties(allProps, [
        "release",
        "selectorLabels",
        "storageEngine",
        "storageSize",
        "resources",
      ]);
    });
  });

  describe("Object instances", () => {
    test("Exposes service object through property", () => {
      const chart = makeChart();
      const mongo = new Mongo(chart, "mongo-test", requiredProps);
      expect(mongo.service).toBeDefined();
      expect(mongo.service).toBeInstanceOf(KubeService);
      expect(mongo.service.name).toEqual("mongo-test");
    });

    test("Exposes statefulSet object through property", () => {
      const chart = makeChart();
      const mongo = new Mongo(chart, "mongo-test", requiredProps);
      expect(mongo.statefulSet).toBeDefined();
      expect(mongo.statefulSet).toBeInstanceOf(KubeStatefulSet);
      expect(mongo.statefulSet.name).toEqual("mongo-test-sts");
    });
  });

  describe("Container release", () => {
    test("Default container release", () => {
      const results = synthMongo();
      const mongo = results.find((obj) => obj.kind === "StatefulSet");
      expect(mongo).toHaveProperty(
        "spec.template.spec.containers[0].image",
        "mongo:v1"
      );
    });

    test("Container release set explicitly", () => {
      const results = synthMongo({
        ...requiredProps,
        release: "12345",
      });
      const mongo = results.find((obj) => obj.kind === "StatefulSet");
      expect(mongo).toHaveProperty(
        "spec.template.spec.containers[0].image",
        "mongo:12345"
      );
    });
  });

  describe("Storage Engine", () => {
    test("Default storage engine", () => {
      const results = synthMongo({
        ...requiredProps,
      });
      const mongo = results.find((obj) => obj.kind === "StatefulSet");
      expect(mongo).toHaveProperty("spec.template.spec.containers[0].args", [
        "--storageEngine",
        "mmapv1",
        "--smallfiles",
      ]);
    });

    test("Storage engine set explicitly", () => {
      const results = synthMongo({
        ...requiredProps,
        storageEngine: "wiredTiger",
      });
      const mongo = results.find((obj) => obj.kind === "StatefulSet");
      expect(mongo).toHaveProperty("spec.template.spec.containers[0].args", [
        "--storageEngine",
        "wiredTiger",
      ]);
    });
  });

  describe("getDnsName", () => {
    test("Builds a DNS name for the first Pod", () => {
      const chart = makeChart();
      const mongo = new Mongo(chart, "mongo-test", requiredProps);
      expect(mongo.getDnsName()).toBe("mongo-test-sts-0.mongo-test");
    });

    const tests: [number, string][] = [
      [0, "mongo-test-sts-0.mongo-test"],
      [1, "mongo-test-sts-1.mongo-test"],
      [3, "mongo-test-sts-3.mongo-test"],
    ];
    tests.forEach(([replica, expected]) => {
      test("Builds a string from non-empty parts", () => {
        const chart = makeChart();
        const mongo = new Mongo(chart, "mongo-test", requiredProps);
        expect(mongo.getDnsName(replica)).toBe(expected);
      });
    });
  });
});
