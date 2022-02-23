/* istanbul ignore file */
import { App } from "cdk8s";
import { AdvancedWebServiceChart } from "./chart";
import { TalisShortRegion, TalisDeploymentEnvironment } from "../../lib";

const app = new App();
new AdvancedWebServiceChart(app, {
  environment: TalisDeploymentEnvironment.DEVELOPMENT,
  region: TalisShortRegion.LOCAL,
  watermark: "example",
});
app.synth();
