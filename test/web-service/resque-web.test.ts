import { Testing } from "cdk8s";
import { ResqueWeb } from "../../lib";

describe("ResqueWeb", () => {
  test("Creates resque web objects", () => {
    const chart = Testing.chart();
    new ResqueWeb(chart, "resque-web", {
      externalUrl: "https://resque.example.com",
    });
    const results = Testing.synth(chart);
    expect(results).toMatchSnapshot();
  });

  test("Customizations", () => {
    const chart = Testing.chart();
    new ResqueWeb(chart, "resque-web", {
      externalUrl: "https://resque-web.example.com",
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
    });
    const results = Testing.synth(chart);
    expect(results).toMatchSnapshot();
  });
});
