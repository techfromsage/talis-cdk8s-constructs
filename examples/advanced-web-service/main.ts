/* istanbul ignore file */
import { App } from "cdk8s";
import { AdvancedWebServiceChart } from "./chart";

const app = new App();
new AdvancedWebServiceChart(app, "app", {
  labels: {
    app: "example",
    environment: "development",
    region: "local",
  },
});
app.synth();
