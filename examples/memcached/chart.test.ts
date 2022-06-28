import { MemcachedChart } from "./chart";
import { Testing } from "cdk8s";
import { TalisShortRegion, TalisDeploymentEnvironment } from "../../lib";

describe("Memcached example", () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test("Snapshot", () => {
    const app = Testing.app();
    const chart = new MemcachedChart(app, {
      environment: TalisDeploymentEnvironment.DEVELOPMENT,
      region: TalisShortRegion.LOCAL,
      watermark: "test",
    });
    const results = Testing.synth(chart);
    expect(results).toMatchSnapshot();
  });
});
