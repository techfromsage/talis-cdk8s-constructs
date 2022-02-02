import { Chart, Testing } from "cdk8s";
import { IntOrString, KubeConfigMap, Quantity } from "../../imports/k8s";
import { WebService, WebServiceProps } from "../../lib";
import * as _ from "lodash";

const requiredProps = {
  description: "Test web service",
  chatUrl: "https://example.slack.com/archives/ABCDEF123",
  eksDashboardUrl: "https://example.io/dashboard",
  externalUrl: "https://api.example.com/",
  graphsUrl: "https://example.io/grafana",
  incidentsUrl: "https://example.io/incidents",
  issuesUrl: "https://example.io/repo/issues",
  logsUrl: "https://example.io/loki",
  repositoryUrl: "https://example.io/repo",
  runbookUrl: "https://example.io/wiki/runbook",
  uptimeUrl: "https://example.io/uptime",

  image: "my-image",
  release: "test-123",
  resources: {
    requests: {
      cpu: Quantity.fromString("100m"),
      memory: Quantity.fromString("100Mi"),
    },
  },
};

const defaultProps = { ...requiredProps, replicas: 1 };

function synthWebService(
  props: WebServiceProps = defaultProps,
  chartLabels: { [key: string]: string } = {}
) {
  const app = Testing.app();
  const chart = new Chart(app, "test", {
    labels: chartLabels,
  });

  // Just output node's id as the object's name
  chart.generateObjectName = (obj) => {
    return obj.node.id;
  };

  new WebService(chart, "web", props);

  const results = Testing.synth(chart);
  return results;
}

interface AnnotatedObject {
  metadata: {
    annotations: {
      [x: string]: string;
    };
  };
}

function getAnnotation(object: AnnotatedObject, key: string) {
  return object.metadata.annotations[key];
}

describe("WebService", () => {
  describe("Props", () => {
    test("Minimal required props", () => {
      const results = synthWebService();
      expect(results).toMatchSnapshot();
    });

    test("All the props", () => {
      const app = Testing.app();
      const chart = new Chart(app, "test", {
        namespace: "props-test",
        labels: {
          app: "my-app",
          environment: "test",
          region: "testing",
        },
      });
      new WebService(chart, "web", {
        ...requiredProps,
        workingDir: "/some/path",
        command: ["/bin/sh", "-c", "echo hello"],
        args: ["--foo", "bar"],
        env: [{ name: "FOO", value: "bar" }],
        envFrom: [{ configMapRef: { name: "foo-config" } }],
        automountServiceAccountToken: true,
        imagePullPolicy: "Always",
        imagePullSecrets: [{ name: "foo-secret" }],
        priorityClassName: "high-priority",
        revisionHistoryLimit: 5,
        affinity: {
          podAntiAffinity: {
            preferredDuringSchedulingIgnoredDuringExecution: [
              {
                podAffinityTerm: {
                  labelSelector: {
                    matchLabels: {
                      role: "server",
                    },
                  },
                  topologyKey: "kubernetes.io/hostname",
                },
                weight: 100,
              },
            ],
          },
        },
        canary: true,
        stage: "full",
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
        horizontalPodAutoscaler: {
          minReplicas: 2,
          maxReplicas: 10,
          cpuTargetUtilization: 100,
        },
        ingressAnnotations: {
          "alb.ingress.kubernetes.io/ip-address-type": "dualstack",
          "alb.ingress.kubernetes.io/healthcheck-path": "/ping",
        },
        internal: false,
        port: 3000,
        nginx: {
          image: "ubuntu/nginx:1.18-21.10_edge",
          imagePullPolicy: "Always",
          configMap: "nginx-config",
          port: 80,
        },
        selectorLabels: {
          foo: "bar",
          instance: "props-test",
        },
        tlsDomain: "*.example.com",
        ingressTargetType: "ip",
        terminationGracePeriodSeconds: 60,
        lifecycle: {
          preStop: {
            exec: {
              command: ["/bin/sh", "-c", "echo hello"],
            },
          },
        },
        readinessProbe: {
          httpGet: {
            path: "/health/ready",
            port: IntOrString.fromNumber(3000),
          },
          initialDelaySeconds: 0,
          periodSeconds: 15,
          failureThreshold: 3,
          successThreshold: 1,
          timeoutSeconds: 2,
        },
        livenessProbe: {
          httpGet: {
            path: "/health/alive",
            port: IntOrString.fromNumber(3000),
          },
          initialDelaySeconds: 0,
          periodSeconds: 10,
          failureThreshold: 3,
          successThreshold: 1,
          timeoutSeconds: 2,
        },
        volumes: [
          {
            name: "foo-volume",
            awsElasticBlockStore: {
              volumeId: "vol-123",
              fsType: "ext4",
              readOnly: true,
            },
          },
        ],
        volumeMounts: [
          {
            name: "foo-volume",
            mountPath: "/data/foo",
            readOnly: true,
          },
        ],
      });
      const results = Testing.synth(chart);
      expect(results).toMatchSnapshot();
    });

    test("Horizontal Pod Autoscaler", () => {
      const results = synthWebService({
        ...requiredProps,
        horizontalPodAutoscaler: {
          minReplicas: 2,
          maxReplicas: 4,
          cpuTargetUtilization: 100,
        },
      });
      expect(results).toMatchSnapshot();
    });

    test("Either horizontalPodAutoscaler or replicas must be specified", () => {
      expect(() => {
        new WebService(Testing.chart(), "web", { ...requiredProps });
      }).toThrowErrorMatchingSnapshot();
    });

    test("Either horizontalPodAutoscaler or replicas can be specified, not both", () => {
      expect(() => {
        new WebService(Testing.chart(), "web", {
          ...requiredProps,
          replicas: 1,
          horizontalPodAutoscaler: {
            minReplicas: 1,
            maxReplicas: 4,
            cpuTargetUtilization: 80,
          },
        });
      }).toThrowErrorMatchingSnapshot();
    });

    test("Release stage must be specified when canary deployments are enabled", () => {
      expect(() => {
        new WebService(Testing.chart(), "web", {
          ...defaultProps,
          canary: true,
        });
      }).toThrowErrorMatchingSnapshot();
    });

    test("Creates load balancer names from components", () => {
      const results = synthWebService(
        { ...defaultProps, canary: true, stage: "base" },
        { app: "some-app", environment: "staging", region: "eu" }
      );
      const ingresses = results.filter((obj) => obj.kind === "Ingress");
      expect(ingresses).toHaveLength(2);
      const getLbName = (ingress: AnnotatedObject) =>
        getAnnotation(ingress, "alb.ingress.kubernetes.io/load-balancer-name");
      expect(getLbName(ingresses[0])).toEqual("some-app-web-staging-eu");
      expect(getLbName(ingresses[1])).toEqual("some-app-web-c-staging-eu");
    });

    test("Load balancer name must not exceed 32 characters", () => {
      expect(() => {
        synthWebService(
          { ...defaultProps },
          {
            app: "our-awesome-app",
            environment: "production",
            region: "eu",
          }
        );
      }).toThrowErrorMatchingSnapshot();
    });

    test("Creates internet-facing load balancer by default", () => {
      const results = synthWebService();
      const ingress = results.find((obj) => obj.kind === "Ingress");
      expect(ingress.spec.ingressClassName).toBe(
        "aws-load-balancer-internet-facing"
      );
    });

    test("Creates internal load balancer", () => {
      const results = synthWebService({
        ...defaultProps,
        internal: true,
      });
      const ingress = results.find((obj) => obj.kind === "Ingress");
      expect(ingress.spec.ingressClassName).toBe("aws-load-balancer-internal");
    });

    test("Allows to set TLS domain for ACM certificate discovery", () => {
      const results = synthWebService({
        ...defaultProps,
        tlsDomain: "*.example.com",
      });
      const ingress = results.find((obj) => obj.kind === "Ingress");
      expect(ingress.spec.tls).toHaveLength(1);
      expect(ingress.spec.tls[0].hosts).toHaveLength(1);
      expect(ingress.spec.tls[0].hosts[0]).toBe("*.example.com");
    });

    test("Ingress target-type instance (by default)", () => {
      const results = synthWebService();
      const service = results.find((obj) => obj.kind === "Service");
      const ingress = results.find((obj) => obj.kind === "Ingress");
      expect(service.spec.type).toBe("NodePort");
      expect(
        ingress.metadata.annotations["alb.ingress.kubernetes.io/target-type"]
      ).toBe("instance");
    });

    test("Ingress target-type ip", () => {
      const results = synthWebService({
        ...defaultProps,
        ingressTargetType: "ip",
      });
      const service = results.find((obj) => obj.kind === "Service");
      const ingress = results.find((obj) => obj.kind === "Ingress");
      expect(service.spec.type).toBe("ClusterIP");
      expect(
        ingress.metadata.annotations["alb.ingress.kubernetes.io/target-type"]
      ).toBe("ip");
    });
  });

  describe("Labels and annotations", () => {
    test("Inherits labels from the chart", () => {
      const results = synthWebService(defaultProps, {
        app: "my-app",
        environment: "test",
        region: "dev",
      });
      expect(results).toHaveLength(3);

      // All objects should have the same labels in their metadata
      results.forEach((obj) => {
        expect(obj.metadata.labels).toEqual({
          app: "my-app",
          environment: "test",
          instance: "web",
          region: "dev",
          release: "test-123",
          role: "server",
        });
      });

      const byKind = _.groupBy(results, (obj) => obj.kind);

      // Service selector should include app label
      expect(byKind.Service[0].spec.selector).toEqual({
        app: "my-app",
        instance: "web",
        role: "server",
      });

      // Deployment selector should include app label
      expect(byKind.Deployment[0].spec.selector.matchLabels).toEqual({
        app: "my-app",
        instance: "web",
        role: "server",
      });

      // Deployment pod spec should include all labels
      expect(byKind.Deployment[0].spec.template.metadata.labels).toEqual({
        app: "my-app",
        environment: "test",
        instance: "web",
        region: "dev",
        release: "test-123",
        role: "server",
      });
    });

    test("Allows to set custom selectorLabels", () => {
      const results = synthWebService(
        {
          ...defaultProps,
          selectorLabels: {
            app: "side-app",
            special: "special-value",
          },
        },
        {
          app: "my-app",
          environment: "test",
          region: "dev",
        }
      );
      expect(results).toHaveLength(3);

      // Metadata labels are overridden as well
      results.forEach((obj) => {
        expect(obj.metadata.labels).toEqual({
          app: "side-app",
          environment: "test",
          instance: "web",
          region: "dev",
          release: "test-123",
          role: "server",
          special: "special-value",
        });
      });

      const byKind = _.groupBy(results, (obj) => obj.kind);

      // Service selector should include custom labels
      expect(byKind.Service[0].spec.selector).toEqual({
        app: "side-app",
        instance: "web",
        role: "server",
        special: "special-value",
      });

      // Deployment selector should include custom labels
      expect(byKind.Deployment[0].spec.selector.matchLabels).toEqual({
        app: "side-app",
        instance: "web",
        role: "server",
        special: "special-value",
      });

      // Deployment pod spec should include all labels
      expect(byKind.Deployment[0].spec.template.metadata.labels).toEqual({
        app: "side-app",
        environment: "test",
        instance: "web",
        region: "dev",
        release: "test-123",
        role: "server",
        special: "special-value",
      });
    });

    test("Sets talis.io annotations on the service", () => {
      const results = synthWebService({ ...defaultProps });
      const service = results.find((obj) => obj.kind === "Service");
      expect(service.metadata.annotations).toEqual({
        "talis.io/description": requiredProps.description,
        "talis.io/repository": requiredProps.repositoryUrl,
        "talis.io/issues": requiredProps.issuesUrl,
        "talis.io/chat": requiredProps.chatUrl,
        "talis.io/incidents": requiredProps.incidentsUrl,
        "talis.io/runbook": requiredProps.runbookUrl,
        "talis.io/url": requiredProps.externalUrl,
        "talis.io/logs": requiredProps.logsUrl,
        "talis.io/graphs": requiredProps.graphsUrl,
        "talis.io/eks-dashboard": requiredProps.eksDashboardUrl,
        "talis.io/uptime": requiredProps.uptimeUrl,
      });
    });
  });

  describe("Canary releases", () => {
    test("Creates one set of objects with canary disabled", () => {
      const results = synthWebService({ ...defaultProps, canary: false });
      const byKind = _.groupBy(results, (obj) => obj.kind);
      expect(byKind.Service).toHaveLength(1);
      expect(byKind.Ingress).toHaveLength(1);
      expect(byKind.Deployment).toHaveLength(1);
    });

    test("Creates two sets of objects with canary enabled", () => {
      const results = synthWebService({
        ...defaultProps,
        canary: true,
        stage: "base",
      });
      const byKind = _.groupBy(results, (obj) => obj.kind);

      expect(byKind.Service).toHaveLength(2);
      expect(byKind.Ingress).toHaveLength(2);
      expect(byKind.Deployment).toHaveLength(2);

      expect(results.map((obj) => obj.metadata.name)).toEqual([
        "service",
        "ingress",
        "deployment",
        "service-canary",
        "ingress-canary",
        "deployment-canary",
      ]);
    });

    test("Includes canary label with canary enabled", () => {
      const results = synthWebService({
        ...defaultProps,
        canary: true,
        stage: "base",
      });

      // All should have the canary label in their metadata
      expect(results.map((obj) => obj.metadata.labels.canary)).toEqual([
        "false",
        "false",
        "false",
        "true",
        "true",
        "true",
      ]);

      const byKind = _.groupBy(results, (obj) => obj.kind);

      // Services should have the canary selector in their spec
      const services = byKind.Service;
      expect(services[0].spec.selector.canary).toBe("false");
      expect(services[1].spec.selector.canary).toBe("true");

      // Deployments should have the canary label in their pod spec and selector
      const deployments = byKind.Deployment;
      expect(deployments[0].spec.template.metadata.labels.canary).toBe("false");
      expect(deployments[0].spec.selector.matchLabels.canary).toBe("false");
      expect(deployments[1].spec.template.metadata.labels.canary).toBe("true");
      expect(deployments[1].spec.selector.matchLabels.canary).toBe("true");
    });

    test("Does not include canary label with canary disabled", () => {
      const results = synthWebService({ ...defaultProps, canary: false });

      expect(results[0].metadata.labels).not.toHaveProperty("canary");
      expect(results[1].metadata.labels).not.toHaveProperty("canary");
      expect(results[2].metadata.labels).not.toHaveProperty("canary");

      const byKind = _.groupBy(results, (obj) => obj.kind);
      expect(byKind.Service[0].spec.selector).not.toHaveProperty("canary");
      const dep = byKind.Deployment[0];
      expect(dep.spec.template.metadata.labels).not.toHaveProperty("canary");
      expect(dep.spec.selector.matchLabels).not.toHaveProperty("canary");
    });

    test("Configures the 'canary' stage", () => {
      const results = synthWebService({
        ...defaultProps,
        canary: true,
        stage: "canary",
      });
      const byKind = _.groupBy(results, (obj) => obj.kind);

      // Services should have the canary selector in their spec
      const services = byKind.Service;
      expect(services[0].spec.selector.canary).toBe("false");
      expect(services[1].spec.selector.canary).toBe("true");

      // The "live" deployment should not be included
      const deployments = byKind.Deployment;
      expect(deployments).toHaveLength(1);
      expect(deployments[0].spec.selector.matchLabels.canary).toBe("true");
    });

    test("Configures the 'base' stage", () => {
      const results = synthWebService({
        ...defaultProps,
        canary: true,
        stage: "base",
      });
      const byKind = _.groupBy(results, (obj) => obj.kind);

      // Services should have the canary selector in their spec
      const services = byKind.Service;
      expect(services[0].spec.selector.canary).toBe("false");
      expect(services[1].spec.selector.canary).toBe("true");

      // Both deployments should be included
      const deployments = byKind.Deployment;
      expect(deployments).toHaveLength(2);
    });

    test("Configures the 'post-canary' stage", () => {
      const results = synthWebService({
        ...defaultProps,
        canary: true,
        stage: "post-canary",
      });
      const byKind = _.groupBy(results, (obj) => obj.kind);

      // The "live" service should not have the canary selector
      const services = byKind.Service;
      expect(services[0].spec.selector).not.toHaveProperty("canary");
      expect(services[1].spec.selector.canary).toBe("true");

      // The "live" deployment should not be included
      const deployments = byKind.Deployment;
      expect(deployments).toHaveLength(1);
      expect(deployments[0].spec.selector.matchLabels.canary).toBe("true");
    });

    test("Configures the 'full' stage", () => {
      const results = synthWebService({
        ...defaultProps,
        canary: true,
        stage: "full",
      });
      const byKind = _.groupBy(results, (obj) => obj.kind);

      // The "live" service should not have the canary selector
      const services = byKind.Service;
      expect(services[0].spec.selector).not.toHaveProperty("canary");
      expect(services[1].spec.selector.canary).toBe("true");

      // Both deployments should be included
      const deployments = byKind.Deployment;
      expect(deployments).toHaveLength(2);
    });
  });

  describe("Nginx", () => {
    test("Does not create nginx container by default", () => {
      const results = synthWebService();
      const deployment = results.find((obj) => obj.kind === "Deployment");
      const containers = deployment.spec.template.spec.containers;
      expect(containers).toHaveLength(1);
      expect(containers[0].image).not.toContain("nginx");
    });

    test("Allows to create nginx container", () => {
      const chart = Testing.chart();
      const configMap = new KubeConfigMap(chart, "nginx-config", {
        data: {
          "nginx.conf": "server { listen 80; }",
        },
      });
      new WebService(chart, "web", {
        ...defaultProps,
        nginx: { configMap: configMap.name },
      });

      const results = Testing.synth(chart);
      const deployment = results.find((obj) => obj.kind === "Deployment");
      expect(deployment.spec.template.spec.volumes).toMatchSnapshot("volumes");
      const containers = deployment.spec.template.spec.containers;
      expect(containers).toHaveLength(2);
      expect(containers[0].image).not.toContain("nginx");
      expect(containers[1].image).toContain("nginx");
      expect(containers[1]).toMatchSnapshot("container");
    });

    test("Allows to create nginx container with specified ports", () => {
      const chart = Testing.chart();
      const applicationPort = 1234;
      const nginxPort = 4567;
      const configMap = new KubeConfigMap(chart, "nginx-config", {
        data: {
          "nginx.conf": `server { listen ${nginxPort}; }`,
        },
      });
      new WebService(chart, "web", {
        ...defaultProps,
        port: applicationPort,
        nginx: { configMap: configMap.name, port: nginxPort },
      });

      const results = Testing.synth(chart);
      const deployment = results.find((obj) => obj.kind === "Deployment");
      const containers = deployment.spec.template.spec.containers;
      expect(containers).toHaveLength(2);
      expect(containers[0].image).not.toContain("nginx");
      expect(containers[0].ports[0].containerPort).toBe(applicationPort);
      expect(containers[1].image).toContain("nginx");
      expect(containers[1].ports[0].containerPort).toBe(nginxPort);
    });

    test("Validates that application port and nginx port are not the same", () => {
      expect(() => {
        const chart = Testing.chart();
        const configMap = new KubeConfigMap(chart, "nginx-config");
        new WebService(chart, "web", {
          ...defaultProps,
          port: 80,
          nginx: { configMap: configMap.name, port: 80 },
        });
      }).toThrowErrorMatchingSnapshot();
    });
  });
});
