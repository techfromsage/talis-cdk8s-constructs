import { Chart, Testing } from "cdk8s";
import { KubeService, KubeStatefulSet, Quantity } from "../../imports/k8s";
import { Postgres, PostgresProps } from "../../lib";
import { makeChart } from "../test-util";

const requiredProps = {
  release: "v1",
};

function synthPostgres(props: PostgresProps = requiredProps) {
  const chart = Testing.chart();
  new Postgres(chart, "postgres-test", props);
  const results = Testing.synth(chart);
  return results;
}

describe("Postgres", () => {
  describe("Props", () => {
    test("Minimal required props", () => {
      const chart = Testing.chart();
      new Postgres(chart, "postgres-test", requiredProps);
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
        role: "postgres",
        instance: "test",
      };

      const allProps: Required<PostgresProps> = {
        ...requiredProps,
        selectorLabels,
        storageSize: Quantity.fromString("20Gi"),
        priorityClassName: "test",
        env: [
          {
            name: "POSTGRES_PASSWORD",
            value: "secret123",
          },
        ],
        envFrom: [
          {
            configMapRef: {
              name: "test",
            },
          },
        ],
        resources: {
          limits: {
            cpu: Quantity.fromString("100m"),
            memory: Quantity.fromString("500Mi"),
          },
        },
        initContainers: [
          {
            name: "init-container",
            image: "busybox:1.35.0",
            command: ["/bin/sh", "-c", "echo hello"],
          },
        ],
        volumes: [
          {
            name: "tmp-dir",
            emptyDir: {},
          },
        ],
        volumeMounts: [
          {
            name: "tmp-dir",
            mountPath: "/tmp",
          },
        ],
      };
      new Postgres(chart, "postgres-test", allProps);
      const results = Testing.synth(chart);
      expect(results).toMatchSnapshot();

      const statefulSet = results.find((obj) => obj.kind === "StatefulSet");
      expect(statefulSet).toHaveAllProperties(allProps, [
        "release",
        "selectorLabels",
        "storageSize",
        "resources",
      ]);
    });

    test("selectorLabels can override app", () => {
      const results = synthPostgres({
        ...requiredProps,
        selectorLabels: { app: "foobar" },
      });
      const sts = results.find((obj) => obj.kind === "StatefulSet");
      expect(sts).toHaveProperty("metadata.labels.app", "foobar");
      expect(sts).toHaveProperty("spec.selector.matchLabels.app", "foobar");
      expect(sts).toHaveProperty("spec.template.metadata.labels.app", "foobar");
    });

    test("selectorLabels can override role", () => {
      const results = synthPostgres({
        ...requiredProps,
        selectorLabels: { role: "database" },
      });
      const sts = results.find((obj) => obj.kind === "StatefulSet");
      expect(sts).toHaveProperty("metadata.labels.role", "database");
      expect(sts).toHaveProperty("spec.selector.matchLabels.role", "database");
      expect(sts).toHaveProperty(
        "spec.template.metadata.labels.role",
        "database"
      );
    });
  });

  describe("Object instances", () => {
    test("Exposes service object through property", () => {
      const chart = makeChart();
      const postgres = new Postgres(chart, "postgres-test", requiredProps);
      expect(postgres.service).toBeDefined();
      expect(postgres.service).toBeInstanceOf(KubeService);
      expect(postgres.service.name).toEqual("postgres-test");
    });

    test("Exposes statefulSet object through property", () => {
      const chart = makeChart();
      const postgres = new Postgres(chart, "postgres-test", requiredProps);
      expect(postgres.statefulSet).toBeDefined();
      expect(postgres.statefulSet).toBeInstanceOf(KubeStatefulSet);
      expect(postgres.statefulSet.name).toEqual("postgres-test-sts");
    });
  });

  describe("Container release", () => {
    test("Default container release", () => {
      const results = synthPostgres();
      const postgres = results.find((obj) => obj.kind === "StatefulSet");
      expect(postgres).toHaveProperty(
        "spec.template.spec.containers[0].image",
        "postgres:v1"
      );
    });

    test("Container release set explicitly", () => {
      const results = synthPostgres({
        ...requiredProps,
        release: "12345",
      });
      const postgres = results.find((obj) => obj.kind === "StatefulSet");
      expect(postgres).toHaveProperty(
        "spec.template.spec.containers[0].image",
        "postgres:12345"
      );
    });
  });

  describe("getDnsName", () => {
    test("Builds a DNS name for the first Pod", () => {
      const chart = makeChart();
      const postgres = new Postgres(chart, "postgres-test", requiredProps);
      expect(postgres.getDnsName()).toBe("postgres-test-sts-0.postgres-test");
    });

    const tests: [number, string][] = [
      [0, "postgres-test-sts-0.postgres-test"],
      [1, "postgres-test-sts-1.postgres-test"],
      [3, "postgres-test-sts-3.postgres-test"],
    ];
    tests.forEach(([replica, expected]) => {
      test("Builds a string from non-empty parts", () => {
        const chart = makeChart();
        const postgres = new Postgres(chart, "postgres-test", requiredProps);
        expect(postgres.getDnsName(replica)).toBe(expected);
      });
    });
  });
});
