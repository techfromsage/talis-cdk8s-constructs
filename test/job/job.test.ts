import { Chart, Testing } from "cdk8s";
import { Quantity } from "../../imports/k8s";
import {
  ContainerImagePullPolicy,
  DNSPolicy,
  Job,
  JobProps,
  PodSpecRestartPolicy,
  PreemptionPolicy,
} from "../../lib";
import { makeChart } from "../test-util";

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
  restartPolicy: PodSpecRestartPolicy.NEVER,
};

function synthJob(
  props: JobProps = requiredProps,
  chartLabels: { [key: string]: string } = {},
) {
  const chart = makeChart({
    namespace: "test",
    labels: chartLabels,
  });
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
      const allProps: Required<Omit<JobProps, "makeAffinity">> = {
        ...requiredProps,
        selectorLabels,
        suspend: false,
        containerName: "my-container",
        workingDir: "/some/path",
        command: ["/bin/sh", "-c", "echo hello"],
        args: ["--foo", "bar"],
        backoffLimit: 1,
        activeDeadlineSeconds: 120,
        terminationGracePeriodSeconds: 60,
        ttlSecondsAfterFinished: 30,
        safeToEvict: false,
        safeToEvictLocalVolumes: ["tmp-dir"],
        env: [{ name: "FOO", value: "bar" }],
        envFrom: [{ configMapRef: { name: "foo-config" } }],
        automountServiceAccountToken: false,
        dnsConfig: {
          options: [
            {
              name: "ndots",
              value: "2",
            },
          ],
        },
        dnsPolicy: DNSPolicy.CLUSTER_FIRST,
        enableServiceLinks: false,
        preemptionPolicy: PreemptionPolicy.PREEMPT_LOWER_PRIORITY,
        serviceAccountName: "service-account",
        setHostnameAsFqdn: false,
        shareProcessNamespace: false,
        subdomain: "sub",
        tolerations: [
          {
            effect: "NoSchedule",
            operator: "Exists",
          },
        ],
        imagePullPolicy: ContainerImagePullPolicy.ALWAYS,
        imagePullSecrets: [{ name: "foo-secret" }],
        priorityClassName: "high-priority-nonpreempting",
        containers: [{ name: "secondary", image: "second-image" }],
        affinity: {
          nodeAffinity: {
            requiredDuringSchedulingIgnoredDuringExecution: {
              nodeSelectorTerms: [
                {
                  matchExpressions: [
                    {
                      key: "kubernetes.io/arch",
                      operator: "In",
                      values: ["amd64"],
                    },
                  ],
                },
              ],
            },
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
        podSecurityContext: {
          fsGroup: 1000,
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
      new Job(chart, "job-test", allProps);
      const results = Testing.synth(chart);
      expect(results).toMatchSnapshot();

      const job = results.find((obj) => obj.kind === "Job");
      expect(job).toHaveAllProperties(allProps, [
        "containerName",
        "podSecurityContext",
        "release",
        "safeToEvict",
        "safeToEvictLocalVolumes",
        "selectorLabels",
        "setHostnameAsFqdn",
      ]);
      expect(job).toHaveProperty("spec.template.spec.setHostnameAsFQDN");
    });

    test("Setting restartPolicy", () => {
      const results = synthJob({
        ...requiredProps,
        restartPolicy: PodSpecRestartPolicy.NEVER,
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

    test("Setting safeToEvict", () => {
      const results = synthJob({
        ...requiredProps,
        safeToEvict: true,
        safeToEvictLocalVolumes: ["foo", "bar"],
      });
      const job = results.find((obj) => obj.kind === "Job");
      expect(job).toHaveProperty("spec.template.metadata.annotations", {
        "cluster-autoscaler.kubernetes.io/safe-to-evict": "true",
        "cluster-autoscaler.kubernetes.io/safe-to-evict-local-volumes":
          "foo,bar",
      });
    });

    test("Allows specifying no affinity", () => {
      const results = synthJob({
        ...requiredProps,
        affinity: undefined,
      });
      const job = results.find((obj) => obj.kind === "Job");
      expect(job).not.toHaveProperty("spec.template.spec.affinity");
    });

    test("Allows specifying custom logic to make affinity", () => {
      const results = synthJob({
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
      const job = results.find((obj) => obj.kind === "Job");
      expect(job).toHaveProperty("spec.template.spec.affinity");
      expect(job.spec.template.spec.affinity).toMatchSnapshot();
    });

    test("Allows returning no affinity", () => {
      const results = synthJob({
        ...requiredProps,
        makeAffinity() {
          return undefined;
        },
      });
      const job = results.find((obj) => obj.kind === "Job");
      expect(job).not.toHaveProperty("spec.template.spec.affinity");
    });

    test("selectorLabels can override app", () => {
      const results = synthJob({
        ...requiredProps,
        selectorLabels: { app: "foobar" },
      });
      const job = results.find((obj) => obj.kind === "Job");
      expect(job).toHaveProperty("metadata.labels.app", "foobar");
      expect(job).toHaveProperty("spec.template.metadata.labels.app", "foobar");
    });
  });

  describe("Containers", () => {
    test("Default container name", () => {
      const results = synthJob();
      const job = results.find((obj) => obj.kind === "Job");
      expect(job).toHaveProperty(
        "spec.template.spec.containers[0].name",
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
      new Job(chart, "worker-test", requiredProps);
      const results = Testing.synth(chart);
      const job = results.find((obj) => obj.kind === "Job");
      expect(job).toHaveProperty(
        "spec.template.spec.containers[0].name",
        "from-chart",
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
        "from-selector",
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
        "explicit-name",
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

    test("Allows setting multiple containers", () => {
      const results = synthJob({
        ...requiredProps,
        containers: [
          {
            name: "sideapp",
            image: "side-image",
          },
        ],
      });
      const job = results.find((obj) => obj.kind === "Job");
      expect(job).toHaveProperty("spec.template.spec.containers");
      expect(job.spec.template.spec.containers).toHaveLength(2);
      expect(job).toHaveProperty(
        "spec.template.spec.containers[0].name",
        "app",
      );
      expect(job).toHaveProperty(
        "spec.template.spec.containers[1].name",
        "sideapp",
      );
    });
  });

  describe("Labels and annotations", () => {
    test("Inherits labels from the chart", () => {
      const results = synthJob(requiredProps, {
        app: "my-app",
        environment: "test",
        region: "dev",
      });
      const job = results.find((obj) => obj.kind === "Job");

      expect(job.metadata.labels).toEqual({
        app: "my-app",
        environment: "test",
        instance: "job-test",
        region: "dev",
        release: "v1",
        role: "job",
      });

      expect(job.spec.template.metadata.labels).toEqual({
        app: "my-app",
        environment: "test",
        instance: "job-test",
        region: "dev",
        release: "v1",
        role: "job",
      });
    });

    test("Allows to set custom selectorLabels", () => {
      const results = synthJob(
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
      const job = results.find((obj) => obj.kind === "Job");

      expect(job.metadata.labels).toEqual({
        app: "side-app",
        environment: "test",
        instance: "job-test",
        region: "dev",
        release: "v1",
        role: "job",
        special: "special-value",
      });

      expect(job.spec.template.metadata.labels).toEqual({
        app: "side-app",
        environment: "test",
        instance: "job-test",
        region: "dev",
        release: "v1",
        role: "job",
        special: "special-value",
      });
    });
  });
});
