import { Chart, Testing } from "cdk8s";
import { KubeService } from "../../imports/k8s";
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

      new Mongo(chart, "mongo-test", {
        ...requiredProps,
        selectorLabels,
      });
      const results = Testing.synth(chart);
      expect(results).toMatchSnapshot();
    });
  });

  describe("Service instance", () => {
    test("Exposes service object through property", () => {
      const chart = makeChart();
      const mongo = new Mongo(chart, "mongo-test", requiredProps);
      expect(mongo.service).toBeDefined();
      expect(mongo.service).toBeInstanceOf(KubeService);
      expect(mongo.service.name).toEqual("mongo-test");
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
      expect(mongo).toHaveProperty("spec.template.spec.containers[0].command", [
        "--smallfiles",
        "--storageEngine",
        "mmapv1",
      ]);
    });

    test("Storage engine set explicitly", () => {
      const results = synthMongo({
        ...requiredProps,
        storageEngine: "wiredTiger",
      });
      const mongo = results.find((obj) => obj.kind === "StatefulSet");
      expect(mongo).toHaveProperty("spec.template.spec.containers[0].command", [
        "--smallfiles",
        "--storageEngine",
        "wiredTiger",
      ]);
    });
  });
});
