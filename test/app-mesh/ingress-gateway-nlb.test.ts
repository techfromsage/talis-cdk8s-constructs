import { Chart, Testing } from "cdk8s";
import { IngressGatewayNlb, IngressGatewayNlbProps } from "../../lib";

const requiredProps: IngressGatewayNlbProps = {
  gatewayName: "mygateway",
  tlsCertificateArn:
    "arn:aws:acm:us-west-2:123456789012:certificate/abcdef01-1234-5678-9012-abcdef0123456",
  ingressRoleArn: "arn:aws:iam::123456789012:role/ingress-role",
  nlbAccessLogBucket: "mybucket",
  nlbAccessLogPrefix: "mylogs/1234/nlb",
};

function synthIngressGatewayNlb(
  props: IngressGatewayNlbProps,
  chart: Chart = Testing.chart(),
) {
  new IngressGatewayNlb(chart, "ingress-gateway-nlb-test", props);
  return Testing.synth(chart);
}

describe("IngressGatewayNlb", () => {
  describe("Props", () => {
    test("Required props", () => {
      const results = synthIngressGatewayNlb(requiredProps);
      expect(results).toMatchSnapshot();
    });

    test("Public Gateway", () => {
      const results = synthIngressGatewayNlb({
        ...requiredProps,
        public: true,
      });
      expect(results).toMatchSnapshot();
    });

    test("Override Gateway Min Replicas", () => {
      const results = synthIngressGatewayNlb({
        ...requiredProps,
        gatewayMinReplicas: 2,
      });
      expect(results).toMatchSnapshot();
    });

    test("Override Gateway Max Replicas", () => {
      const results = synthIngressGatewayNlb({
        ...requiredProps,
        gatewayMaxReplicas: 10,
      });
      expect(results).toMatchSnapshot();
    });

    test("Override Gateway HPA Average CPU Utilization", () => {
      const results = synthIngressGatewayNlb({
        ...requiredProps,
        gatewayHpaAverageCpuUtilization: 50,
      });
      expect(results).toMatchSnapshot();
    });

    test("Override Envoy Repository", () => {
      const results = synthIngressGatewayNlb({
        ...requiredProps,
        envoyRepository: "public.ecr.aws/myrepo/envoy",
      });
      expect(results).toMatchSnapshot();
    });

    test("Override Envoy Version", () => {
      const results = synthIngressGatewayNlb({
        ...requiredProps,
        envoyVersion: "v1.30.4.0-prod",
      });
      expect(results).toMatchSnapshot();
    });
  });

  describe("Props Validation", () => {
    test("throws error when gatewayMinReplicas is less than 2", () => {
      const props: IngressGatewayNlbProps = {
        ...requiredProps,
        gatewayMinReplicas: 1,
      };
      expect(() => synthIngressGatewayNlb(props)).toThrowError();
    });
    test("throws error when gatewayMinReplicas is 0", () => {
      const props: IngressGatewayNlbProps = {
        ...requiredProps,
        gatewayMinReplicas: 0,
      };
      expect(() => synthIngressGatewayNlb(props)).toThrowError();
    });
    test("throws error when gatewayMaxReplicas is less than gatewayMinReplicas", () => {
      const props: IngressGatewayNlbProps = {
        ...requiredProps,
        gatewayMinReplicas: 4,
        gatewayMaxReplicas: 3,
      };
      expect(() => synthIngressGatewayNlb(props)).toThrowError();
    });
  });
});
