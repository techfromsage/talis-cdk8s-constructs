import { Chart, Testing } from "cdk8s";
import { KubeService, KubeStatefulSet, Quantity } from "../../imports/k8s";
import { Mongo, MongoProps } from "../../lib";
import { makeChart } from "../test-util";

const requiredProps = {
  release: "4.4.29",
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
    test("Exposes service port through property", () => {
      const chart = makeChart();
      const mongo = new Mongo(chart, "mongo-test", requiredProps);
      expect(mongo.port).toBe(27017);
    });

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
    const tests: [string, string, string][] = [
      ["patch", "4.4.29", "mongo"],
      ["minor", "5.0", "mongo"],
      ["major", "6", "mongosh"],
    ];
    tests.forEach(([name, release, shell]) => {
      test(`Accepts ${name} version`, () => {
        const results = synthMongo({ ...requiredProps, release: release });
        const mongo = results.find((obj) => obj.kind === "StatefulSet");
        expect(mongo).toHaveProperty(
          "spec.template.spec.containers[0].image",
          `mongo:${release}`,
        );
        expect(mongo).toHaveProperty(
          "spec.template.metadata.labels.release",
          release,
        );
        expect(mongo).toHaveProperty(
          "spec.template.spec.containers[0].readinessProbe.exec.command",
          [shell, "--eval", "db.adminCommand('ping')"],
        );
      });
    });

    test("Throws if release version is invalid", () => {
      expect(() => {
        synthMongo({ ...requiredProps, release: "v8" });
      }).toThrowError();
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
      new Mongo(chart, "mongo", {
        ...requiredProps,
        replicas: 3,
        replicaSetName: "test-rs",
      });
      const results = Testing.synth(chart);
      const job = results.find((obj) => obj.kind === "Job");
      expect(job).toHaveProperty("metadata.name", "mongo-setup-rs");
      expect(job).toHaveProperty("spec.template.spec.containers[0].command", [
        "/bin/bash",
      ]);
      expect(job).toHaveProperty("spec.template.spec.containers[0].args", [
        "/setup-replset.sh",
        "test-rs",
        "mongo-sts-0.mongo,mongo-sts-1.mongo,mongo-sts-2.mongo",
      ]);
    });
  });

  describe("getHosts", () => {
    test("Gets a host name for a single replica", () => {
      const chart = makeChart();
      const mongo = new Mongo(chart, "mongo-test", requiredProps);
      expect(mongo.getHosts()).toEqual(["mongo-test-sts-0.mongo-test"]);
    });

    test("Gets host names for all Pods", () => {
      const chart = makeChart();
      const mongo = new Mongo(chart, "mongo-rs", {
        ...requiredProps,
        replicas: 3,
        replicaSetName: "test-rs",
      });
      expect(mongo.getHosts()).toEqual([
        "mongo-rs-sts-0.mongo-rs",
        "mongo-rs-sts-1.mongo-rs",
        "mongo-rs-sts-2.mongo-rs",
      ]);
    });
  });

  describe("getWaitForPortContainer", () => {
    test("Gets a wait container for a single host", () => {
      const chart = makeChart();
      const mongo = new Mongo(chart, "mongo", requiredProps);
      expect(mongo.getWaitForPortContainer()).toMatchInlineSnapshot(`
        {
          "command": [
            "/bin/sh",
            "-c",
            "echo 'waiting for mongo'; until nc -vz -w1 mongo-sts-0.mongo 27017; do sleep 1; done",
          ],
          "image": "busybox:1.36.1",
          "name": "wait-for-mongo",
          "resources": {
            "limits": {
              "memory": Quantity {
                "value": "50Mi",
              },
            },
            "requests": {
              "cpu": Quantity {
                "value": "10m",
              },
              "memory": Quantity {
                "value": "50Mi",
              },
            },
          },
        }
      `);
    });

    test("Gets a wait container for all replicas", () => {
      const chart = makeChart();
      const mongo = new Mongo(chart, "mongo", {
        ...requiredProps,
        replicas: 2,
      });
      expect(mongo.getWaitForPortContainer()).toHaveProperty("command", [
        "/bin/sh",
        "-c",
        "echo 'waiting for mongo'; until nc -vz -w1 mongo-sts-0.mongo 27017; do sleep 1; done && until nc -vz -w1 mongo-sts-1.mongo 27017; do sleep 1; done",
      ]);
    });
  });

  describe("getWaitForReplicaSetContainer", () => {
    test("Gets a noop container for standalone", () => {
      const chart = makeChart();
      const mongo = new Mongo(chart, "mongo1", requiredProps);
      const container = mongo.getWaitForReplicaSetContainer();
      expect(container).toHaveProperty("name", "wait-for-mongo1-rs");
      expect(container).toHaveProperty("command", [
        "/bin/bash",
        "-c",
        "exit 0",
      ]);
    });

    test("Gets a wait container for a replica set", () => {
      const chart = makeChart();
      const mongo = new Mongo(chart, "mongo2", {
        ...requiredProps,
        replicas: 3,
        replicaSetName: "test-rs",
      });
      const container = mongo.getWaitForReplicaSetContainer();
      expect(container).toHaveProperty("name", "wait-for-mongo2-rs");
      expect(container).toHaveProperty("command", [
        "/bin/bash",
        "-c",
        "mongo --quiet --host mongo2-sts-0.mongo2 <<<'while (true) { if ( rs.status().members.some(({ state }) => state === 1) && rs.status().members.every(({ state }) => state === 1 || state === 2) ) { break; } sleep(1000); }'",
      ]);
    });
  });
});
