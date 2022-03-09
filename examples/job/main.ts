import { App } from "cdk8s";
import { JobChart } from "./chart";
import { TalisShortRegion, TalisDeploymentEnvironment } from "../../lib";

const app = new App();
new JobChart(app, {
  environment: TalisDeploymentEnvironment.DEVELOPMENT,
  region: TalisShortRegion.LOCAL,
  watermark: "example",
});
app.synth();
