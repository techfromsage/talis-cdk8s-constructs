/* istanbul ignore file */
import { App } from "cdk8s";
import { BackgroundWorkerChart } from "./chart";

const app = new App();
new BackgroundWorkerChart(app, {
  environment: "development",
  region: "local",
  watermark: "example",
});
app.synth();
