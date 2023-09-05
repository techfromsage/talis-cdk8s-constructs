import { Testing } from "cdk8s";
import { ResqueWeb } from "../../lib";
import { IntOrString } from "../../imports/k8s";

describe("ResqueWeb", () => {
  test("Creates resque web objects", () => {
    const chart = Testing.chart();
    new ResqueWeb(chart, "resque-web", {
      externalUrl: "http://resque.example.com",
    });
    const results = Testing.synth(chart);
    expect(results).toMatchSnapshot();
  });

  test("Customizations", () => {
    const chart = Testing.chart();
    new ResqueWeb(chart, "resque-web", {
      externalUrl: "https://resque-web.example.com",
      tlsDomain: "*.example.com",
      release: "latest",
      env: [
        { name: "RAILS_ENV", value: "production" },
        { name: "RAILS_RESQUE_REDIS", value: "redis:6379" },
        {
          name: "SECRET_KEY_BASE",
          valueFrom: {
            secretKeyRef: {
              key: "SECRET_KEY_BASE",
              name: "resque-web-secrets",
            },
          },
        },
      ],
      externalHostname: "resque-web.example.com",
    });
    const results = Testing.synth(chart);
    expect(results).toMatchSnapshot();
  });

  test("selectorLabels are merged", () => {
    const chart = Testing.chart();
    new ResqueWeb(chart, "resque-web", {
      externalUrl: "http://resque.example.com",
      tlsDomain: "*.example.com",
      selectorLabels: {
        test: "true",
      },
    });
    const results = Testing.synth(chart);
    expect(results).toMatchSnapshot();
  });

  test("ingressAnnotations are merged", () => {
    const chart = Testing.chart();
    new ResqueWeb(chart, "resque-web", {
      externalUrl: "http://resque.example.com",
      tlsDomain: "*.example.com",
      ingressAnnotations: {
        "talis.io/foo": "bar",
      },
    });
    const results = Testing.synth(chart);
    expect(results).toMatchSnapshot();
  });

  test("It does not include podDisruptionBudget by default", () => {
    const chart = Testing.chart();
    new ResqueWeb(chart, "resque-web", {
      externalUrl: "http://resque.example.com",
    });
    const results = Testing.synth(chart);
    const pdbs = results.filter((obj) => obj.kind === "PodDisruptionBudget");
    expect(pdbs).toHaveLength(0);
  });

  test("Allows specifying podDisruptionBudget", () => {
    const chart = Testing.chart();
    new ResqueWeb(chart, "resque-web", {
      externalUrl: "http://resque.example.com",
      replicas: 2,
      podDisruptionBudget: {
        maxUnavailable: IntOrString.fromNumber(1),
      },
    });
    const results = Testing.synth(chart);
    const pdbs = results.filter((obj) => obj.kind === "PodDisruptionBudget");
    expect(pdbs).toHaveLength(1);
  });
});
