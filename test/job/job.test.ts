import { Chart, Testing } from "cdk8s";
import { Quantity } from "../../imports/k8s";
import { Job, JobProps } from "../../lib";

const requiredProps: JobProps = {
  image: "talis/app:worker-v1",
  release: "v1",
  resources: {
    requests: {
      cpu: Quantity.fromString("100m"),
      memory: Quantity.fromString("100Mi"),
    },
  },
  backoffLimit: 0,
  restartPolicy: "Never",
};

function synthJob(props: JobProps = requiredProps) {
  const chart = Testing.chart();
  new Job(chart, "job-test", props);
  const results = Testing.synth(chart);
  return results;
}

describe("Job", () => {
  describe("Props", () => {
    test("Minimal required props", () => {
      const chart = Testing.chart();
      new Job(chart, "job-test", requiredProps);
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
        role: "job",
        instance: "test",
      };
      const allProps: Required<JobProps> = {
        ...requiredProps,
        selectorLabels,
        containerName: "my-container",
        workingDir: "/some/path",
        command: ["/bin/sh", "-c", "echo hello"],
        args: ["--foo", "bar"],
        backoffLimit: 1,
        ttlSecondsAfterFinished: 30,
        env: [{ name: "FOO", value: "bar" }],
        envFrom: [{ configMapRef: { name: "foo-config" } }],
        imagePullPolicy: "Always",
        imagePullSecrets: [{ name: "foo-secret" }],
        resources: {
          requests: {
            cpu: Quantity.fromNumber(0.1),
            memory: Quantity.fromString("100Mi"),
          },
          limits: {
            cpu: Quantity.fromNumber(1),
            memory: Quantity.fromString("1Gi"),
          },
        },
        securityContext: {
          runAsUser: 1000,
          runAsGroup: 1000,
          runAsNonRoot: true,
        },
        lifecycle: {
          postStart: {
            exec: {
              command: ["/bin/sh", "-c", "echo hello"],
            },
          },
          preStop: {
            exec: {
              command: ["/bin/sh", "-c", "echo goodbye"],
            },
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
      new Job(chart, "job-test", allProps);
      const results = Testing.synth(chart);
      expect(results).toMatchSnapshot();

      const job = results.find((obj) => obj.kind === "Job");
      expect(job).toHaveAllProperties(allProps, [
        "containerName",
        "release",
        "selectorLabels",
      ]);
    });

    test("Setting restartPolicy", () => {
      const results = synthJob({
        ...requiredProps,
        restartPolicy: "Never",
      });
      const job = results.find((obj) => obj.kind === "Job");
      expect(job).toHaveProperty("spec.template.spec.restartPolicy", "Never");
    });

    test("Setting backoffLimit", () => {
      const results = synthJob({
        ...requiredProps,
        backoffLimit: 42,
      });
      const job = results.find((obj) => obj.kind === "Job");
      expect(job).toHaveProperty("spec.backoffLimit", 42);
    });
  });

  describe("Container name", () => {
    test("Default container name", () => {
      const results = synthJob();
      const job = results.find((obj) => obj.kind === "Job");
      expect(job).toHaveProperty(
        "spec.template.spec.containers[0].name",
        "app"
      );
    });

    test("Container name from chart's app label", () => {
      const app = Testing.app();
      const chart = new Chart(app, "test", {
        labels: {
          app: "from-chart",
        },
      });
      new Job(chart, "worker-test", requiredProps);
      const results = Testing.synth(chart);
      const job = results.find((obj) => obj.kind === "Job");
      expect(job).toHaveProperty(
        "spec.template.spec.containers[0].name",
        "from-chart"
      );
    });

    test("Container name from selector label", () => {
      const results = synthJob({
        ...requiredProps,
        selectorLabels: { app: "from-selector" },
      });
      const job = results.find((obj) => obj.kind === "Job");
      expect(job).toHaveProperty(
        "spec.template.spec.containers[0].name",
        "from-selector"
      );
    });

    test("Container name set explicitly", () => {
      const results = synthJob({
        ...requiredProps,
        containerName: "explicit-name",
      });
      const job = results.find((obj) => obj.kind === "Job");
      expect(job).toHaveProperty(
        "spec.template.spec.containers[0].name",
        "explicit-name"
      );
    });

    test("ttlSecondsAfterFinished set explicitly", () => {
      const results = synthJob({
        ...requiredProps,
        ttlSecondsAfterFinished: 100,
      });
      const job = results.find((obj) => obj.kind === "Job");
      expect(job).toHaveProperty("spec.ttlSecondsAfterFinished", 100);
    });
  });
});