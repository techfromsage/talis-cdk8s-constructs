/* istanbul ignore file */
import { App } from "cdk8s";
import { AdvancedWebServiceChart } from "./chart";

const app = new App();
new AdvancedWebServiceChart(app, {
  environment: "development",
  region: "local",
  watermark: "example",
});
app.synth();
