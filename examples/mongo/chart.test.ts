import { MongoChart } from "./chart";
import { Testing } from "cdk8s";
import { TalisShortRegion, TalisDeploymentEnvironment } from "../../lib";

describe("Mongo example", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  test("Snapshot", () => {
    const app = Testing.app();
    const chart = new MongoChart(app, {
      environment: TalisDeploymentEnvironment.DEVELOPMENT,
      region: TalisShortRegion.LOCAL,
      watermark: "test",
    });
    const results = Testing.synth(chart);
    expect(results).toMatchSnapshot();
  });
});
