import { App } from "cdk8s";
import { PostgresChart } from "./chart";
import { TalisShortRegion, TalisDeploymentEnvironment } from "../../lib";

const app = new App();
new PostgresChart(app, {
  environment: TalisDeploymentEnvironment.DEVELOPMENT,
  region: TalisShortRegion.LOCAL,
  watermark: "example",
});
app.synth();
