import { getCanaryStage } from "../../lib";

describe("stage-util", () => {
  describe("getCanaryStage", () => {
    const PROCESS_ENV = process.env;

    beforeEach(() => {
      jest.resetModules();
      process.env = { ...PROCESS_ENV };
    });

    afterEach(() => {
      process.env = PROCESS_ENV;
    });

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
