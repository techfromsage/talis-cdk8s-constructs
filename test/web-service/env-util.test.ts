import {
  getCanaryStage,
  getDockerTag,
  TalisDeploymentEnvironment,
} from "../../lib";

describe("env-util", () => {
  const PROCESS_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...PROCESS_ENV };
  });

  afterEach(() => {
    process.env = PROCESS_ENV;
  });

  describe("getDockerTag", () => {
    test("Gets a Docker tag from named env var", () => {
      process.env.APP_DOCKER_TAG = "v1";
      expect(
        getDockerTag("APP_DOCKER_TAG", TalisDeploymentEnvironment.DEVELOPMENT)
      ).toBe("v1");
    });

    test("Gets the default Docker tag if env var is not set", () => {
      expect(
        getDockerTag("APP_DOCKER_TAG", TalisDeploymentEnvironment.DEVELOPMENT)
      ).toBe("latest");
    });

    test("Gets the custom default Docker tag if env var is not set", () => {
      expect(
        getDockerTag(
          "APP_DOCKER_TAG",
          TalisDeploymentEnvironment.DEVELOPMENT,
          "release"
        )
      ).toBe("release");
    });

    test("Throws if env var is empty", () => {
      process.env.APP_DOCKER_TAG = "";
      expect(() =>
        getDockerTag("APP_DOCKER_TAG", TalisDeploymentEnvironment.DEVELOPMENT)
      ).toThrowErrorMatchingSnapshot();
    });

    test("Throws if tag is not valid for the environment", () => {
      process.env.APP_DOCKER_TAG = "stable";
      expect(() =>
        getDockerTag("APP_DOCKER_TAG", TalisDeploymentEnvironment.PRODUCTION)
      ).toThrowErrorMatchingSnapshot();
    });
  });

  describe("getCanaryStage", () => {
    test("Gets name of the stage from CANARY_STAGE env var", () => {
      process.env.CANARY_STAGE = "canary";
      expect(getCanaryStage()).toBe("canary");
    });

    test("Gets name of the stage from a custom env var", () => {
      process.env.MY_STAGE = "base";
      expect(getCanaryStage("MY_STAGE")).toBe("base");
    });

    test("Throws if env var is not set", () => {
      expect(() => getCanaryStage()).toThrowErrorMatchingSnapshot();
    });

    test("Throws if env var is empty", () => {
      process.env.CANARY_STAGE = "";
      expect(() => getCanaryStage()).toThrowErrorMatchingSnapshot();
    });

    test("Throws if stage name is not valid", () => {
      process.env.CANARY_STAGE = "blue";
      expect(() => getCanaryStage()).toThrowErrorMatchingSnapshot();
    });

    test("Gets default stage if env var is not set", () => {
      expect(getCanaryStage("NOT_SET", "base")).toBe("base");
    });

    test("Gets default stage if env var is empty", () => {
      process.env.EMPTY = "";
      expect(getCanaryStage("EMPTY", "full")).toBe("full");
    });
  });
});
