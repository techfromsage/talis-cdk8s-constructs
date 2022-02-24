import { TalisShortRegion } from "../../lib";
import { joinNameParts, makeLoadBalancerName } from "../../lib/common";
import { TalisDeploymentEnvironment } from "../../lib/talis-chart/talis-deployment-environment";

describe("name-util", () => {
  describe("joinNameParts", () => {
    [
      { parts: [], expected: "" },
      { parts: ["app"], expected: "app" },
      { parts: ["app", ""], expected: "app" },
      { parts: ["app", "", "foo"], expected: "app-foo" },
      { parts: ["app", undefined, "foo"], expected: "app-foo" },
      { parts: ["", "app", undefined, "foo", undefined], expected: "app-foo" },
    ].forEach(({ parts, expected }) => {
      test("Builds a string from non-empty parts", () => {
        expect(joinNameParts(parts)).toBe(expected);
      });
    });
  });

  describe("makeLoadBalancerName", () => {
    [
      {
        // empty
        namespace: "",
        labels: {},
        expected: "develop",
      },
      {
        // local development
        namespace: "my-app",
        labels: {
          instance: "api",
          environment: TalisDeploymentEnvironment.DEVELOPMENT,
          region: TalisShortRegion.LOCAL,
        },
        expected: "my-app-api-develop",
      },
      {
        // staging app
        namespace: "my-app",
        labels: {
          instance: "api",
          environment: TalisDeploymentEnvironment.STAGING,
          region: TalisShortRegion.EU,
        },
        expected: "my-app-api-staging-eu",
      },
      {
        // production app
        namespace: "my-app",
        labels: {
          instance: "api",
          environment: TalisDeploymentEnvironment.PRODUCTION,
          region: TalisShortRegion.CANADA,
        },
        expected: "my-app-api-prod-ca",
      },
      {
        // production app live instance
        namespace: "my-app",
        labels: {
          instance: "api",
          canary: "false",
          environment: TalisDeploymentEnvironment.PRODUCTION,
          region: TalisShortRegion.EU,
        },
        expected: "my-app-api-prod-eu",
      },
      {
        // production app canary instance
        namespace: "my-app",
        labels: {
          instance: "api",
          canary: "true",
          environment: TalisDeploymentEnvironment.PRODUCTION,
          region: TalisShortRegion.EU,
        },
        expected: "my-app-api-c-prod-eu",
      },
      {
        // on-demand app with watermarked namespace
        namespace: "my-app-repo-1234",
        labels: {
          instance: "api",
          canary: "true",
          environment: TalisDeploymentEnvironment.ONDEMAND,
          region: TalisShortRegion.EU,
        },
        expected: "my-app-repo-1234-api-c-eu",
      },
    ].forEach(({ namespace, labels, expected }) => {
      test("Builds a load balancer name", () => {
        expect(makeLoadBalancerName(namespace, labels)).toBe(expected);
      });
    });
  });
});
