import { Construct } from "constructs";
import { App, Chart, ChartProps } from "cdk8s";

import { WebService } from "../../lib";
import { Quantity } from "../../imports/k8s";

export class SimpleWebServiceChart extends Chart {
  constructor(scope: Construct, id: string, props: ChartProps = {}) {
    super(scope, id, props);

    new WebService(this, "web", {
      // Service annotations
      description: "Simple web service",
      chatUrl: "https://example.slack.com/archives/ABCDEF123",
      eksDashboardUrl: "https://example.io/dashboard",
      externalUrl: "https://api.example.com/",
      graphsUrl: "https://example.io/grafana",
      incidentsUrl: "https://example.io/incidents",
      issuesUrl: "https://github.com/talis/talis-cdk8s-constructs/issues",
      logsUrl: "https://example.io/loki",
      repositoryUrl: "https://github.com/talis/talis-cdk8s-constructs",
      runbookUrl: "https://example.io/wiki/runbook",
      uptimeUrl: "https://example.io/uptime",

      // Pod details
      image: "docker.io/bitnami/node-example:0.0.1",
      release: "0.0.1",
      replicas: 1,
      resources: {
        requests: {
          cpu: Quantity.fromString("50m"),
          memory: Quantity.fromString("100Mi"),
        },
      },
    });
  }
}

const app = new App();
new SimpleWebServiceChart(app, "app", {
  labels: {
    app: "example",
    environment: "development",
    region: "local",
  },
});
app.synth();
