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

      const allProps: Required<
        Omit<MongoProps, "customArgs" | "replicaSetName">
      > = {
        ...requiredProps,
        selectorLabels,
        storageEngine: "wiredTiger",
        storageClassName: "special-storage-class",
        storageSize: Quantity.fromString("20Gi"),
        replicas: 1,
        resources: {
          limits: {
            cpu: Quantity.fromString("100m"),
            memory: Quantity.fromString("500Mi"),
          },
        },
        priorityClassName: "test",
        exposeService: true,
      };
      new Mongo(chart, "mongo-test", allProps);
      const results = Testing.synth(chart);
      expect(results).toMatchSnapshot();

      const statefulSet = results.find((obj) => obj.kind === "StatefulSet");
      expect(statefulSet).toHaveAllProperties(allProps, [
        "selectorLabels",
        "storageEngine",
        "storageSize",
        "replicaSetName",
        "exposeService",
      ]);

      const loadBalancer = results.find((obj) => obj.kind === "Service");
      expect(loadBalancer).toHaveProperty("metadata.annotations");
      expect(loadBalancer.metadata.annotations).toHaveProperty(
        "service.beta.kubernetes.io/aws-load-balancer-nlb-target-type",
        "instance",
      );
      expect(loadBalancer.metadata.annotations).toHaveProperty(
        "service.beta.kubernetes.io/load-balancer-source-ranges",
        "0.0.0.0/0",
      );
      expect(loadBalancer.metadata.annotations).toHaveProperty(
        "service.beta.kubernetes.io/aws-load-balancer-scheme",
        "internal",
      );
    });

    test("selectorLabels can override app", () => {
      const results = synthMongo({
        ...requiredProps,
        selectorLabels: { app: "foobar" },
      });
      const sts = results.find((obj) => obj.kind === "StatefulSet");
      expect(sts).toHaveProperty("metadata.labels.app", "foobar");
      expect(sts).toHaveProperty("spec.selector.matchLabels.app", "foobar");
      expect(sts).toHaveProperty("spec.template.metadata.labels.app", "foobar");
    });

    test("selectorLabels can override role", () => {
      const results = synthMongo({
        ...requiredProps,
        selectorLabels: { role: "database" },
      });
      const sts = results.find((obj) => obj.kind === "StatefulSet");
      expect(sts).toHaveProperty("metadata.labels.role", "database");
      expect(sts).toHaveProperty("spec.selector.matchLabels.role", "database");
      expect(sts).toHaveProperty(
        "spec.template.metadata.labels.role",
        "database",
      );
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
        "mongo:v1",
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
        "mongo:12345",
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

  describe("customArgs", () => {
    test("It accepts custom arg that override the default", () => {
      const results = synthMongo({
        ...requiredProps,
        customArgs: ["--smallfiles", "--quotaFiles", "8"],
      });
      const mongo = results.find((obj) => obj.kind === "StatefulSet");
      expect(mongo).toHaveProperty("spec.template.spec.containers[0].args", [
        "--smallfiles",
        "--quotaFiles",
        "8",
      ]);
    });
  });

  describe("getDnsName", () => {
    test("Builds a DNS name for the first Pod", () => {
      const chart = makeChart();
      const mongo = new Mongo(chart, "mongo-test", requiredProps);
      expect(mongo.getDnsName()).toBe("mongo-test-sts-0.mongo-test");
    });

    test("Builds a full DNS name if chart knows its namespace", () => {
      const chart = makeChart({ namespace: "test-ns" });
      const mongo = new Mongo(chart, "mongo-test", requiredProps);
      expect(mongo.getDnsName()).toBe(
        "mongo-test-sts-0.mongo-test.test-ns.svc.cluster.local",
      );
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

  describe("replicaSet", () => {
    test("Sets replSet option", () => {
      const results = synthMongo({
        ...requiredProps,
        replicaSetName: "test-rs",
        storageEngine: "wiredTiger",
      });
      const mongo = results.find((obj) => obj.kind === "StatefulSet");
      expect(mongo).toHaveProperty("spec.template.spec.containers[0].args", [
        "--storageEngine",
        "wiredTiger",
        "--replSet=test-rs",
      ]);
    });

    test("Creates a Job to initiate a replica set", () => {
      const chart = makeChart();
      new Mongo(chart, "mongo-rs", {
        ...requiredProps,
        replicas: 3,
        replicaSetName: "test-rs",
      });
      const results = Testing.synth(chart);
      const job = results.find((obj) => obj.kind === "Job");
      expect(job).toHaveProperty("spec.template.spec.containers[0].command", [
        "/bin/bash",
      ]);
      expect(job).toHaveProperty("spec.template.spec.containers[0].args", [
        "/setup-replset.sh",
        "test-rs",
        "mongo-rs-sts-0.mongo-rs,mongo-rs-sts-1.mongo-rs,mongo-rs-sts-2.mongo-rs",
      ]);
    });
  });
});
