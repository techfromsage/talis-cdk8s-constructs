import { App } from "cdk8s";
import { MemcachedChart } from "./chart";
import { TalisShortRegion, TalisDeploymentEnvironment } from "../../lib";

const app = new App();
new MemcachedChart(app, {
  environment: TalisDeploymentEnvironment.DEVELOPMENT,
  region: TalisShortRegion.LOCAL,
  watermark: "example",
});
app.synth();
