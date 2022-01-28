import { Chart, Testing } from "cdk8s";
import { Quantity } from "../../imports/k8s";
import { BackgroundWorker } from "../../lib";

const requiredProps = {
  image: "talis/app:worker-v1",
  release: "v1",
  resources: {
    requests: {
      cpu: Quantity.fromString("100m"),
      memory: Quantity.fromString("100Mi"),
    },
  },
};

describe("BackgroundWorker", () => {
  describe("Props", () => {
    test("Minimal required props", () => {
      const chart = Testing.chart();
      new BackgroundWorker(chart, "worker-test", requiredProps);
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
        instance: "test",
      };
      new BackgroundWorker(chart, "worker-test", {
        ...requiredProps,
        selectorLabels,
        workingDir: "/some/path",
        command: ["/bin/sh", "-c", "echo hello"],
        args: ["--foo", "bar"],
        env: [{ name: "FOO", value: "bar" }],
        envFrom: [{ configMapRef: { name: "foo-config" } }],
        automountServiceAccountToken: true,
        imagePullSecrets: [{ name: "foo-secret" }],
        priorityClassName: "high-priority",
        revisionHistoryLimit: 5,
        affinity: {
          podAntiAffinity: {
            preferredDuringSchedulingIgnoredDuringExecution: [
              {
                podAffinityTerm: {
                  labelSelector: {
                    matchLabels: selectorLabels,
                  },
                  topologyKey: "topology.kubernetes.io/zone",
                },
                weight: 100,
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
        replicas: 4,
        terminationGracePeriodSeconds: 300,
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
        livenessProbe: {
          exec: {
            command: [
              "/bin/sh",
              "-c",
              "test $(stat -c %Y /tmp/live) -gt $(($(date +%s) - 60))",
            ],
          },
          initialDelaySeconds: 30,
          periodSeconds: 10,
          failureThreshold: 3,
          successThreshold: 1,
          timeoutSeconds: 2,
        },
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
      });
      const results = Testing.synth(chart);
      expect(results).toMatchSnapshot();
    });
  });

  describe("Custom stop signal", () => {
    test("Either stopSignal or lifecycle.preStop can be specified", () => {
      expect(() => {
        new BackgroundWorker(Testing.chart(), "worker-test", {
          ...requiredProps,
          stopSignal: "SIGKILL",
          lifecycle: {
            preStop: {
              exec: {
                command: ["kill", "-9", "1"],
              },
            },
          },
        });
      }).toThrowErrorMatchingSnapshot();
    });

    test("Setting stopSignal creates a preStop hook", () => {
      const chart = Testing.chart();
      new BackgroundWorker(chart, "worker-test", {
        ...requiredProps,
        stopSignal: "SIGQUIT",
      });
      const results = Testing.synth(chart);
      const container = results[0].spec.template.spec.containers[0];
      expect(container.lifecycle).toMatchSnapshot();
    });

    test("Merge stopSignal and postStart hook", () => {
      const chart = Testing.chart();
      new BackgroundWorker(chart, "worker-test", {
        ...requiredProps,
        stopSignal: "SIGQUIT",
        lifecycle: {
          postStart: {
            exec: {
              command: ["/bin/sh", "-c", "echo hello"],
            },
          },
        },
      });
      const results = Testing.synth(chart);
      const container = results[0].spec.template.spec.containers[0];
      expect(container.lifecycle).toMatchSnapshot();
    });
  });
});
