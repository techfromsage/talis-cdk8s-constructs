import { BackgroundWorkerChart } from "./chart";
import { Testing } from "cdk8s";

describe("BackgroundWorker example", () => {
  const PROCESS_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...PROCESS_ENV };
    process.env.DOCKER_USERNAME = "someuser";
    process.env.DOCKER_PASSWORD = "secret123";
  });

  afterEach(() => {
    process.env = PROCESS_ENV;
  });

  test("Snapshot", () => {
    const app = Testing.app();
    const chart = new BackgroundWorkerChart(app, "test", {
      labels: {
        app: "example",
        environment: "development",
        region: "local",
      },
    });
    const results = Testing.synth(chart);
    expect(results).toMatchSnapshot();
  });

  test("Change release version", () => {
    process.env.RELEASE = "v2.2";
    const app = Testing.app();
    const chart = new BackgroundWorkerChart(app, "test");
    const results = Testing.synth(chart);
    expect(results).toMatchSnapshot();
  });
});
