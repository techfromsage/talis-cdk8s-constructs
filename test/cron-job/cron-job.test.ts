import { Chart, Testing } from "cdk8s";
import { Quantity } from "../../imports/k8s";
import {
  ContainerImagePullPolicy,
  CronJob,
  CronJobProps,
  PodSpecRestartPolicy,
} from "../../lib";
import { makeChart } from "../test-util";

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
  restartPolicy: PodSpecRestartPolicy.ON_FAILURE,
};

function synthCronJob(
  props: CronJobProps = requiredProps,
  chartLabels: { [key: string]: string } = {},
) {
  const chart = makeChart({
    namespace: "test",
    labels: chartLabels,
  });
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
      const allProps: Required<Omit<CronJobProps, "makeAffinity">> = {
        ...requiredProps,
        selectorLabels,
        suspend: false,
        suspendJob: true,
        containerName: "my-container",
        workingDir: "/some/path",
        command: ["/bin/sh", "-c", "echo hello"],
        args: ["--foo", "bar"],
        backoffLimit: 1,
        activeDeadlineSeconds: 120,
        ttlSecondsAfterFinished: 30,
        terminationGracePeriodSeconds: 60,
        safeToEvict: false,
        safeToEvictLocalVolumes: ["tmp-dir"],
        env: [{ name: "FOO", value: "bar" }],
        envFrom: [{ configMapRef: { name: "foo-config" } }],
        automountServiceAccountToken: false,
        imagePullPolicy: ContainerImagePullPolicy.ALWAYS,
        imagePullSecrets: [{ name: "foo-secret" }],
        priorityClassName: "high-priority-nonpreempting",
        startingDeadlineSeconds: 200,
        successfulJobsHistoryLimit: 4,
        failedJobsHistoryLimit: 2,
        containers: [{ name: "secondary", image: "second-image" }],
        affinity: {
          podAffinity: {
            requiredDuringSchedulingIgnoredDuringExecution: [
              {
                labelSelector: {
                  matchExpressions: [
                    {
                      key: "app.kubernetes.io/component",
                      operator: "In",
                      values: ["redis"],
                    },
                  ],
                },
                topologyKey: "kubernetes.io/hostname",
              },
            ],
          },
        },
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
        hostAliases: [
          {
            ip: "127.0.0.1",
            hostnames: ["foo.local"],
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
        "safeToEvict",
        "safeToEvictLocalVolumes",
        "suspendJob",
      ]);
    });

    test("Setting restartPolicy", () => {
      const results = synthCronJob({
        ...requiredProps,
        restartPolicy: PodSpecRestartPolicy.NEVER,
      });
      const cron = results.find((obj) => obj.kind === "CronJob");
      expect(cron).toHaveProperty(
        "spec.jobTemplate.spec.template.spec.restartPolicy",
        "Never",
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
        },
      );
    });

    test("Setting safeToEvict", () => {
      const results = synthCronJob({
        ...requiredProps,
        safeToEvict: true,
        safeToEvictLocalVolumes: ["foo", "bar"],
      });
      const cron = results.find((obj) => obj.kind === "CronJob");
      expect(cron).toHaveProperty(
        "spec.jobTemplate.spec.template.metadata.annotations",
        {
          "cluster-autoscaler.kubernetes.io/safe-to-evict": "true",
          "cluster-autoscaler.kubernetes.io/safe-to-evict-local-volumes":
            "foo,bar",
        },
      );
    });

    test("Allows specifying no affinity", () => {
      const results = synthCronJob({
        ...requiredProps,
        affinity: undefined,
      });
      const cron = results.find((obj) => obj.kind === "CronJob");
      expect(cron).not.toHaveProperty(
        "spec.jobTemplate.spec.template.spec.affinity",
      );
    });

    test("Allows specifying custom logic to make affinity", () => {
      const results = synthCronJob({
        ...requiredProps,
        makeAffinity(matchLabels) {
          return {
            podAffinity: {
              requiredDuringSchedulingIgnoredDuringExecution: [
                {
                  labelSelector: {
                    matchExpressions: [
                      {
                        key: "role",
                        operator: "In",
                        values: [matchLabels.role],
                      },
                    ],
                  },
                  topologyKey: "kubernetes.io/hostname",
                },
              ],
            },
          };
        },
      });
      const cron = results.find((obj) => obj.kind === "CronJob");
      expect(cron).toHaveProperty(
        "spec.jobTemplate.spec.template.spec.affinity",
      );
      expect(
        cron.spec.jobTemplate.spec.template.spec.affinity,
      ).toMatchSnapshot();
    });

    test("Allows returning no affinity", () => {
      const results = synthCronJob({
        ...requiredProps,
        makeAffinity() {
          return undefined;
        },
      });
      const cron = results.find((obj) => obj.kind === "CronJob");
      expect(cron).not.toHaveProperty(
        "spec.jobTemplate.spec.template.spec.affinity",
      );
    });

    test("selectorLabels can override app", () => {
      const results = synthCronJob({
        ...requiredProps,
        selectorLabels: { app: "foobar" },
      });
      const cron = results.find((obj) => obj.kind === "CronJob");
      expect(cron).toHaveProperty("metadata.labels.app", "foobar");
      expect(cron).toHaveProperty(
        "spec.jobTemplate.spec.template.metadata.labels.app",
        "foobar",
      );
    });
  });

  describe("Containers", () => {
    test("Default container name", () => {
      const results = synthCronJob();
      const cron = results.find((obj) => obj.kind === "CronJob");
      expect(cron).toHaveProperty(
        "spec.jobTemplate.spec.template.spec.containers[0].name",
        "app",
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
        "from-chart",
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
        "from-selector",
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
        "explicit-name",
      );
    });

    test("Allows setting multiple containers", () => {
      const results = synthCronJob({
        ...requiredProps,
        containers: [
          {
            name: "sideapp",
            image: "side-image",
          },
        ],
      });
      const cron = results.find((obj) => obj.kind === "CronJob");
      expect(cron).toHaveProperty("spec.jobTemplate");
      const jobTemplate = cron.spec.jobTemplate;
      expect(jobTemplate).toHaveProperty("spec.template.spec.containers");
      expect(jobTemplate.spec.template.spec.containers).toHaveLength(2);
      expect(jobTemplate).toHaveProperty(
        "spec.template.spec.containers[0].name",
        "app",
      );
      expect(jobTemplate).toHaveProperty(
        "spec.template.spec.containers[1].name",
        "sideapp",
      );
    });
  });

  describe("Labels and annotations", () => {
    test("Inherits labels from the chart", () => {
      const results = synthCronJob(requiredProps, {
        app: "my-app",
        environment: "test",
        region: "dev",
      });
      const cron = results.find((obj) => obj.kind === "CronJob");

      expect(cron.metadata.labels).toEqual({
        app: "my-app",
        environment: "test",
        instance: "cron-job-test",
        region: "dev",
        release: "v1",
        role: "cronjob",
      });

      expect(cron.spec.jobTemplate.spec.template.metadata.labels).toEqual({
        app: "my-app",
        environment: "test",
        instance: "cron-job-test",
        region: "dev",
        release: "v1",
        role: "cronjob",
      });
    });

    test("Allows to set custom selectorLabels", () => {
      const results = synthCronJob(
        {
          ...requiredProps,
          selectorLabels: {
            app: "side-app",
            special: "special-value",
          },
        },
        {
          app: "my-app",
          environment: "test",
          region: "dev",
        },
      );
      const cron = results.find((obj) => obj.kind === "CronJob");

      expect(cron.metadata.labels).toEqual({
        app: "side-app",
        environment: "test",
        instance: "cron-job-test",
        region: "dev",
        release: "v1",
        role: "cronjob",
        special: "special-value",
      });

      expect(cron.spec.jobTemplate.spec.template.metadata.labels).toEqual({
        app: "side-app",
        environment: "test",
        instance: "cron-job-test",
        region: "dev",
        release: "v1",
        role: "cronjob",
        special: "special-value",
      });
    });
  });
});
