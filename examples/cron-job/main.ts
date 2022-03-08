import { App } from "cdk8s";
import { CronJobChart } from "./chart";
import { TalisShortRegion, TalisDeploymentEnvironment } from "../../lib";

const app = new App();
new CronJobChart(app, {
  environment: TalisDeploymentEnvironment.DEVELOPMENT,
  region: TalisShortRegion.LOCAL,
  watermark: "example",
});
app.synth();
