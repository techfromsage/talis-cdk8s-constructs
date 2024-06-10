import { Chart, Testing } from "cdk8s";
import { AppService, AppServiceProps } from "../../lib";

const requiredProps: AppServiceProps = {
  app: "myapp",
  port: 5000,
  instance: "server",
  hostname: "myapp.example.com",
  virtualNodeTargets: [
    {
      name: "myapp",
      namespace: "default",
      weight: 100,
    },
  ],
  gatewayRouteLabels: {
    "aws.tfs.engineering/appMeshGateway": "12345",
  },
};

function synthAppService(
  props: AppServiceProps,
  chart: Chart = Testing.chart(),
) {
  new AppService(chart, "app-service-test", props);
  return Testing.synth(chart);
}

describe("AppService", () => {
  describe("Props", () => {
    test("Required props", () => {
      const results = synthAppService(requiredProps);
      expect(results).toMatchSnapshot();
    });
  });

  describe("Props Validation", () => {
    test("throws error when weight sum is greater than 100", () => {
      const props: AppServiceProps = {
        ...requiredProps,
        virtualNodeTargets: [
          {
            name: "myapp",
            namespace: "default",
            weight: 80,
          },
          {
            name: "myapp",
            namespace: "newnamespace",
            weight: 40,
          },
        ],
      };
      expect(() => synthAppService(props)).toThrowError();
    });
  });
});
