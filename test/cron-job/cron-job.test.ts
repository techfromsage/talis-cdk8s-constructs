import { Chart, Testing } from "cdk8s";
import { Quantity } from "../../imports/k8s";
import { CronJob, CronJobProps } from "../../lib";

const requiredProps: CronJobProps = {
  schedule: "0 0 13 * 5",
  image: "talis/app:worker-v1",
  release: "v1",
  resources: {
    requests: {
      cpu: Quantity.fromString("100m"),
      memory: Quantity.fromString("100Mi"),
    },
  },
  backoffLimit: 2,
  restartPolicy: "OnFailure",
};

function synthCronJob(props: CronJobProps = requiredProps) {
  const chart = Testing.chart();
  new CronJob(chart, "cron-job-test", props);
  const results = Testing.synth(chart);
  return results;
}

describe("CronJob", () => {
  describe("Props", () => {
    test("Minimal required props", () => {
      const chart = Testing.chart();
      new CronJob(chart, "cron-job-test", requiredProps);
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
        role: "cronjob",
        instance: "test",
      };
      const allProps: Required<CronJobProps> = {
        ...requiredProps,
        selectorLabels,
        containerName: "my-container",
        workingDir: "/some/path",
        command: ["/bin/sh", "-c", "echo hello"],
        args: ["--foo", "bar"],
        backoffLimit: 1,
        env: [{ name: "FOO", value: "bar" }],
        envFrom: [{ configMapRef: { name: "foo-config" } }],
        imagePullPolicy: "Always",
        imagePullSecrets: [{ name: "foo-secret" }],
        startingDeadlineSeconds: 200,
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
      new CronJob(chart, "cron-job-test", allProps);
      const results = Testing.synth(chart);
      expect(results).toMatchSnapshot();

      const cronJob = results.find((obj) => obj.kind === "CronJob");
      expect(cronJob).toHaveAllProperties(allProps, [
        "containerName",
        "release",
        "selectorLabels",
      ]);
    });

    test("Setting restartPolicy", () => {
      const results = synthCronJob({
        ...requiredProps,
        restartPolicy: "Never",
      });
      const cron = results.find((obj) => obj.kind === "CronJob");
      expect(cron).toHaveProperty(
        "spec.jobTemplate.spec.template.spec.restartPolicy",
        "Never"
      );
    });

    test("Setting backoffLimit", () => {
      const results = synthCronJob({
        ...requiredProps,
        backoffLimit: 42,
      });
      const cron = results.find((obj) => obj.kind === "CronJob");
      expect(cron).toHaveProperty("spec.jobTemplate.spec.backoffLimit", 42);
    });

    describe("Schedule Validation", () => {
      test.each([
        ["Schedule must be specified", "", "Empty schedule"],
        [
          "Invalid cron expression",
          "* * * *",
          "Too short cron schedule string",
        ],
        [
          "Invalid cron expression",
          "* * * * * * *",
          "Too long cron schedule string",
        ],
        [
          "Constraint error, got value 100 expected range 0-59",
          "100 * * * * *",
          "Invalid second",
        ],
        [
          "Constraint error, got value 100 expected range 0-59",
          "* 100 * * * *",
          "Invalid minute",
        ],
      ])(
        "Throws '%s' error with cron schedule (%s) - %s",
        (errorMessage, schedule) => {
          expect(() => {
            synthCronJob({
              ...requiredProps,
              schedule: schedule,
            });
          }).toThrowError(errorMessage);
        }
      );
    });
  });

  describe("Container name", () => {
    test("Default container name", () => {
      const results = synthCronJob();
      const cron = results.find((obj) => obj.kind === "CronJob");
      expect(cron).toHaveProperty(
        "spec.jobTemplate.spec.template.spec.containers[0].name",
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
      new CronJob(chart, "worker-test", requiredProps);
      const results = Testing.synth(chart);
      const cron = results.find((obj) => obj.kind === "CronJob");
      expect(cron).toHaveProperty(
        "spec.jobTemplate.spec.template.spec.containers[0].name",
        "from-chart"
      );
    });

    test("Container name from selector label", () => {
      const results = synthCronJob({
        ...requiredProps,
        selectorLabels: { app: "from-selector" },
      });
      const cron = results.find((obj) => obj.kind === "CronJob");
      expect(cron).toHaveProperty(
        "spec.jobTemplate.spec.template.spec.containers[0].name",
        "from-selector"
      );
    });

    test("Container name set explicitly", () => {
      const results = synthCronJob({
        ...requiredProps,
        containerName: "explicit-name",
      });
      const cron = results.find((obj) => obj.kind === "CronJob");
      expect(cron).toHaveProperty(
        "spec.jobTemplate.spec.template.spec.containers[0].name",
        "explicit-name"
      );
    });
  });
});
