import { Testing } from "cdk8s";
import { createDockerHubSecretFromEnv, createImagePullSecret } from "../../lib";

describe("factory", () => {
  describe("createImagePullSecret", () => {
    test("Creates config with Docker Hub credentials by default", () => {
      const chart = Testing.chart();
      createImagePullSecret(chart, { auth: "user:test" });
      const results = Testing.synth(chart);
      expect(results).toMatchSnapshot();
    });

    test("Creates config with custom registry", () => {
      const chart = Testing.chart();
      createImagePullSecret(chart, {
        auth: "username:password",
        registry: "https://registry.example.io/",
      });
      const results = Testing.synth(chart);
      expect(results).toMatchSnapshot();
    });

    test("Creates config with auth as-is", () => {
      const chart = Testing.chart();
      createImagePullSecret(chart, {
        auth: "QVdTOnNvbWUtc2VjcmV0LUVDUi1rZXk=",
        encode: false,
        registry: "123456789000.dkr.ecr.eu-west-1.amazonaws.com",
      });
      const results = Testing.synth(chart);
      expect(results).toMatchSnapshot();
    });

    test("Lets specify node id", () => {
      const chart = Testing.chart();
      const secret = createImagePullSecret(chart, {
        id: "my-secret",
        auth: "user:test",
      });
      expect(secret.node.id).toBe("my-secret");
    });
  });

  describe("createDockerHubSecretFromEnv", () => {
    const PROCESS_ENV = process.env;

    beforeEach(() => {
      jest.resetModules();
      process.env = { ...PROCESS_ENV };
    });

    afterEach(() => {
      process.env = PROCESS_ENV;
    });

    test("Creates config with Docker Hub credentials from env vars", () => {
      process.env.DOCKER_USERNAME = "someuser";
      process.env.DOCKER_PASSWORD = "secret123";
      const chart = Testing.chart();
      createDockerHubSecretFromEnv(chart);
      const results = Testing.synth(chart);
      expect(results).toMatchSnapshot();
    });

    test("Throws if Docker credentials env vars are not set", () => {
      expect(() => {
        createDockerHubSecretFromEnv(Testing.chart());
      }).toThrowErrorMatchingSnapshot();
    });
  });
});
