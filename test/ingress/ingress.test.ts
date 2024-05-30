import { Chart, Testing } from "cdk8s";
import { Ingress, IngressProps } from "../../lib";

const requiredProps: IngressProps = {
  app: "my-app",
  instance: "my-instance",
  serviceRouting: [
    {
      name: "my-name",
      port: 80,
      namespace: "my-namespace",
      weight: 100,
    },
  ],
  ingressClassName: "my-ingress-class",
  hostnames: ["my-hostname"],
};

function synthIngress(props: IngressProps, chart: Chart = Testing.chart()) {
  new Ingress(chart, "ingress-test", props);
  const results = Testing.synth(chart);
  return results;
}

describe("Ingress", () => {
  describe("Props", () => {
    test("Minimal required props", () => {
      const results = synthIngress(requiredProps);
      expect(results).toMatchSnapshot();
    });

    test("All the props", () => {
      const props: IngressProps = {
        ...requiredProps,
        labels: { "my-key": "my-value" },
        certificateArn: ["my-certificate"],
        ingressAnnotations: { "my-key": "my-value" },
        externalHostname: "my-external-hostname",
        ingressClassPriority: 1000,
      };

      const app = Testing.app();
      const chart = new Chart(app, "test", {
        namespace: "test",
        labels: {
          app: "test-app",
          environment: "test",
          region: "local",
        },
      });
      const results = synthIngress(props, chart);
      expect(results).toMatchSnapshot();
    });
  });

  describe("Props validation", () => {
    test("throws error when at least one hostname is not set", () => {
      const props: IngressProps = {
        ...requiredProps,
        hostnames: [],
      };
      expect(() => synthIngress(props)).toThrowError();
    });

    test("throws error when ingress class priority has invalid value", () => {
      const propsForUnderLowerLimit: IngressProps = {
        ...requiredProps,
        ingressClassPriority: -1001,
      };
      expect(() => synthIngress(propsForUnderLowerLimit)).toThrowError();

      const propsForOverUpperLimit: IngressProps = {
        ...requiredProps,
        ingressClassPriority: 1001,
      };
      expect(() => synthIngress(propsForOverUpperLimit)).toThrowError();
    });

    test("throws error when weight sum is not 100", () => {
      const props: IngressProps = {
        ...requiredProps,
        serviceRouting: [
          {
            name: "test-name1",
            port: 104,
            namespace: "test-namespace1",
            weight: 30,
          },
          {
            name: "test-name2",
            port: 102,
            namespace: "test-namespace2",
            weight: 50,
          },
        ],
      };

      expect(() => synthIngress(props)).toThrowError();
    });

    test("throws error when service routing is not set", () => {
      const props: IngressProps = {
        ...requiredProps,
        serviceRouting: [],
      };

      expect(() => synthIngress(props)).toThrowError();
    });
  });

  describe("Services", () => {
    test("expected length when more than one service exists", () => {
      const props: IngressProps = {
        ...requiredProps,
        serviceRouting: [
          {
            name: "test-name1",
            port: 104,
            namespace: "test-namespace1",
            weight: 20,
          },
          {
            name: "test-name2",
            port: 102,
            namespace: "test-namespace2",
            weight: 80,
          },
        ],
      };

      const results = synthIngress(props);
      const service = results.filter((obj) => obj.kind === "Service");
      expect(service.length).toBe(2);
    });

    test("all labels and namespace are set", () => {
      const props: IngressProps = {
        ...requiredProps,
        labels: { "my-key": "my-value" },
      };

      const app = Testing.app();
      const chart = new Chart(app, "test", {
        namespace: "test",
        labels: {
          app: "test-app", // should be overriden with "my-app" from props
          environment: "test",
          region: "local",
        },
      });
      const results = synthIngress(props, chart);
      const service = results.find((obj) => obj.kind === "Service");
      expect(service).toHaveProperty("metadata.labels.my-key", "my-value");
      expect(service).toHaveProperty("metadata.labels.app", "my-app");
      expect(service).toHaveProperty("metadata.labels.instance", "my-instance");
      expect(service).toHaveProperty("metadata.labels.role", "server");
      expect(service).toHaveProperty("metadata.labels.region", "local");
      expect(service).toHaveProperty("metadata.labels.environment", "test");
      expect(service).toHaveProperty(
        "metadata.labels.service",
        "my-app-test-local",
      );

      expect(service).toHaveProperty("metadata.namespace", "test");
    });

    test("all properties are set", () => {
      const props: IngressProps = {
        ...requiredProps,
        serviceRouting: [
          {
            name: "test-name",
            port: 80,
            namespace: "test-namespace",
            weight: 100,
          },
        ],
      };

      const results = synthIngress(props);
      const service = results.find((obj) => obj.kind === "Service");

      expect(service).toHaveProperty(
        "metadata.name",
        "test-name-test-namespace",
      );
      expect(service).toHaveProperty(
        "spec.externalName",
        "test-name.test-namespace.svc.cluster.local",
      );
      const ports = service["spec"]["ports"];
      expect(ports.length).toBe(1);
      expect(ports[0]).toHaveProperty("port", 80);
      expect(ports[0]).toHaveProperty("targetPort", 80);
    });
  });

  describe("Ingress", () => {
    test("all labels and namespace are set", () => {
      const props: IngressProps = {
        ...requiredProps,
        labels: { "my-key": "my-value" },
      };

      const app = Testing.app();
      const chart = new Chart(app, "test", {
        namespace: "test",
        labels: {
          app: "test-app", // should be overriden with "my-app" from props
          environment: "test",
          region: "local",
        },
      });
      const results = synthIngress(props, chart);
      const ingress = results.find((obj) => obj.kind === "Ingress");
      expect(ingress).toHaveProperty("metadata.labels.my-key", "my-value");
      expect(ingress).toHaveProperty("metadata.labels.app", "my-app");
      expect(ingress).toHaveProperty("metadata.labels.instance", "my-instance");
      expect(ingress).toHaveProperty("metadata.labels.role", "server");
      expect(ingress).toHaveProperty("metadata.labels.region", "local");
      expect(ingress).toHaveProperty("metadata.labels.environment", "test");
      expect(ingress).toHaveProperty(
        "metadata.labels.service",
        "my-app-test-local",
      );

      expect(ingress).toHaveProperty("metadata.namespace", "test");
    });

    test("annotation exists when externalHostname is set", () => {
      const props: IngressProps = {
        ...requiredProps,
        externalHostname: "test-external-hostname",
      };

      const results = synthIngress(props);
      const ingress = results.find((obj) => obj.kind === "Ingress");
      const annotations = ingress["metadata"]["annotations"];
      expect(annotations).toHaveProperty(
        "external-dns.alpha.kubernetes.io/hostname",
        "test-external-hostname",
      );
    });

    test("annotation exists when certificateArn is set", () => {
      const props: IngressProps = {
        ...requiredProps,
        certificateArn: ["test-certificate-arn"],
      };

      const results = synthIngress(props);
      const ingress = results.find((obj) => obj.kind === "Ingress");
      const annotations = ingress["metadata"]["annotations"];
      expect(annotations).toHaveProperty(
        "alb.ingress.kubernetes.io/certificate-arn",
        "test-certificate-arn",
      );
    });

    test("annotation exists when forwarded through additional ingress annotations", () => {
      const props: IngressProps = {
        ...requiredProps,
        ingressAnnotations: {
          "test-annotation-key": "test-annotation-value",
          "test-second-annotation-key": "test-second-annotation-value",
        },
      };

      const results = synthIngress(props);
      const ingress = results.find((obj) => obj.kind === "Ingress");
      const annotations = ingress["metadata"]["annotations"];
      expect(annotations).toHaveProperty(
        "test-annotation-key",
        "test-annotation-value",
      );
      expect(annotations).toHaveProperty(
        "test-second-annotation-key",
        "test-second-annotation-value",
      );
    });

    test("ingress has a annotation with proper tags", () => {
      const props: IngressProps = {
        ...requiredProps,
        certificateArn: ["test-certificate-arn"],
      };

      const app = Testing.app();
      const chart = new Chart(app, "test", {
        namespace: "test",
        labels: {
          environment: "test",
          region: "local",
        },
      });
      const results = synthIngress(props, chart);
      const ingress = results.find((obj) => obj.kind === "Ingress");
      const annotations = ingress["metadata"]["annotations"];
      expect(annotations).toHaveProperty(
        "alb.ingress.kubernetes.io/tags",
        "service=my-app-test-local,instance=ingress-test,environment=test",
      );
    });

    test("ingress has a annotation with proper value for ingress class priority when it's defined", () => {
      const props: IngressProps = {
        ...requiredProps,
        ingressClassPriority: 101,
      };

      const results = synthIngress(props);
      const ingress = results.find((obj) => obj.kind === "Ingress");
      const annotations = ingress["metadata"]["annotations"];
      expect(annotations).toHaveProperty(
        "alb.ingress.kubernetes.io/group.order",
        "101",
      );
    });

    test("ingress has a annotation with proper value for ingress class priority when it's not defined", () => {
      const props: IngressProps = {
        ...requiredProps,
      };

      const results = synthIngress(props);
      const ingress = results.find((obj) => obj.kind === "Ingress");
      const annotations = ingress["metadata"]["annotations"];
      expect(annotations).toHaveProperty(
        "alb.ingress.kubernetes.io/group.order",
        "0",
      );
    });

    test("rules exists when multiple hostnames are defined", () => {
      const props: IngressProps = {
        ...requiredProps,
        hostnames: ["firstHostname", "secondHostname"],
      };

      const results = synthIngress(props);
      const ingress = results.find((obj) => obj.kind === "Ingress");
      const rules = ingress["spec"]["rules"];
      expect(rules.length).toBe(2);
      expect(rules[0]).toHaveProperty("host", "firstHostname");
      expect(rules[1]).toHaveProperty("host", "secondHostname");
    });

    test("ingress class name has proper value", () => {
      const props: IngressProps = {
        ...requiredProps,
        ingressClassName: "test-class-name",
      };

      const results = synthIngress(props);
      const ingress = results.find((obj) => obj.kind === "Ingress");
      expect(ingress).toHaveProperty(
        "spec.ingressClassName",
        "test-class-name",
      );
    });

    test("service weighting annotation has a proper value when multiple service routes are set", () => {
      const props: IngressProps = {
        ...requiredProps,
        serviceRouting: [
          {
            name: "test-first-name",
            port: 80,
            namespace: "test-namespace",
            weight: 80,
          },
          {
            name: "test-second-name",
            port: 81,
            namespace: "test-namespace",
            weight: 20,
          },
        ],
      };

      const results = synthIngress(props);
      const ingress = results.find((obj) => obj.kind === "Ingress");
      const annotations = ingress["metadata"]["annotations"];
      const serviceWeighting =
        '{"type":"forward","forwardConfig":{"targetGroups":[{"serviceName":"test-first-name-test-namespace","servicePort":80,"weight":80},{"serviceName":"test-second-name-test-namespace","servicePort":81,"weight":20}]}}';
      expect(annotations).toHaveProperty(
        "alb.ingress.kubernetes.io/actions.service-weighting",
        serviceWeighting,
      );
    });
  });
});
