import { getEksDashboardUrl, getGraphsUrl, getLogsUrl } from "../../lib";

describe("url-util", () => {
  describe("eksDashboardUrl, graphsUrl, logsUrl", () => {
    [
      {
        environment: "staging",
        region: "eu",
        app: "test1",
        expected: {
          eksDashboardUrl:
            "https://dashboard-eks-staging-eu.talisaspire.com/#/overview?namespace=test1",
          graphsUrl:
            "https://grafana-eks-staging-eu.talisaspire.com/d/a87fb0d919ec0ea5f6543124e16c42a5/kubernetes-compute-resources-namespace-workloads?var-namespace=test1",
          logsUrl:
            "https://grafana-eks-staging-eu.talisaspire.com/d/lokiR6qB0/loki-logs?var-apps=test1",
        },
      },
      {
        environment: "production",
        region: "eu",
        app: "test2",
        expected: {
          eksDashboardUrl:
            "https://dashboard-eks-eu.talisaspire.com/#/overview?namespace=test2",
          graphsUrl:
            "https://grafana-eks-eu.talisaspire.com/d/a87fb0d919ec0ea5f6543124e16c42a5/kubernetes-compute-resources-namespace-workloads?var-namespace=test2",
          logsUrl:
            "https://grafana-eks-eu.talisaspire.com/d/lokiR6qB0/loki-logs?var-apps=test2",
        },
      },
      {
        environment: "production",
        region: "ca",
        app: "test3",
        expected: {
          eksDashboardUrl:
            "https://dashboard-eks.ca.talisaspire.com/#/overview?namespace=test3",
          graphsUrl:
            "https://grafana-eks.ca.talisaspire.com/d/a87fb0d919ec0ea5f6543124e16c42a5/kubernetes-compute-resources-namespace-workloads?var-namespace=test3",
          logsUrl:
            "https://grafana-eks.ca.talisaspire.com/d/lokiR6qB0/loki-logs?var-apps=test3",
        },
      },
      {
        environment: "ondemand",
        region: "eu",
        app: "test4",
        expected: {
          eksDashboardUrl:
            "https://dashboard-eks-staging-eu.talisaspire.com/#/overview?namespace=test4",
          graphsUrl:
            "https://grafana-eks-staging-eu.talisaspire.com/d/a87fb0d919ec0ea5f6543124e16c42a5/kubernetes-compute-resources-namespace-workloads?var-namespace=test4",
          logsUrl:
            "https://grafana-eks-staging-eu.talisaspire.com/d/lokiR6qB0/loki-logs?var-apps=test4",
        },
      },
    ].forEach(({ environment, region, app, expected }) => {
      test(`Creates Kubernetes dashboard URL for ${environment}-${region}`, () => {
        const urls = {
          eksDashboardUrl: getEksDashboardUrl(environment, region, app),
          graphsUrl: getGraphsUrl(environment, region, app),
          logsUrl: getLogsUrl(environment, region, app),
        };
        expect(urls).toEqual(expected);
      });
    });
  });
});
