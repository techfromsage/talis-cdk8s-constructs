import { Lazy, Testing } from "cdk8s";
import { vol } from "memfs";
import { KubePod } from "../../imports/k8s";
import { ConfigMap } from "../../lib";
import { makeChart } from "../test-util";

vi.mock("fs");

describe("ConfigMap", () => {
  beforeEach(() => {
    vol.reset();
  });

  describe("Props", () => {
    test("Empty ConfigMap", () => {
      const chart = Testing.chart();
      new ConfigMap(chart, "test");
      const results = Testing.synth(chart);
      expect(results).toMatchSnapshot();
    });

    test("ConfigMap from props", () => {
      const chart = Testing.chart();
      new ConfigMap(chart, "test", {
        data: {
          foo: "bar",
        },
        binaryData: {
          bin: "010101",
        },
        immutable: true,
        disableNameSuffixHash: false,
        metadata: {
          annotations: {
            annotation: "test",
          },
          labels: {
            label: "test",
          },
        },
      });
      const results = Testing.synth(chart);
      expect(results).toMatchSnapshot();
    });
  });

  describe("Accessors", () => {
    test("Name property is a lazy producer", () => {
      const chart = Testing.chart();
      const configMap = new ConfigMap(chart, "test");
      expect(configMap.name).toBeInstanceOf(Lazy);
    });

    test("Metadata getter", () => {
      const chart = Testing.chart();
      const configMap = new ConfigMap(chart, "test", {
        metadata: {
          labels: { test: "true" },
        },
      });
      expect(configMap.metadata.toJson()).toMatchSnapshot();
    });

    test("Data getter", () => {
      const chart = Testing.chart();
      const configMap = new ConfigMap(chart, "test", { data: { foo: "bar" } });
      expect(configMap.data).toEqual({ foo: "bar" });
    });

    test("Binary data getter", () => {
      const chart = Testing.chart();
      const configMap = new ConfigMap(chart, "test", {
        binaryData: { foo: "bar" },
      });
      expect(configMap.binaryData).toEqual({ foo: "bar" });
    });

    test("Throws when trying to set data key on binaryData", () => {
      const chart = Testing.chart();
      const configMap = new ConfigMap(chart, "test");
      configMap.setData("test", "foo");
      expect(() => {
        configMap.setBinaryData("test", "bar");
      }).toThrowErrorMatchingSnapshot();
    });

    test("Throws when trying to set binaryData key on data", () => {
      const chart = Testing.chart();
      const configMap = new ConfigMap(chart, "test");
      configMap.setBinaryData("test", "foo");
      expect(() => {
        configMap.setData("test", "bar");
      }).toThrowErrorMatchingSnapshot();
    });

    test("Overriding keys", () => {
      const chart = Testing.chart();
      const configMap = new ConfigMap(chart, "test", {
        data: {
          UNTOUCHED: "yes",
          OVERRIDDEN: "maybe?",
        },
      });
      configMap.setData("OVERRIDDEN", "once");
      vol.fromJSON({
        ".env": "OVERRIDDEN=from file",
      });
      configMap.setFromEnvFile(".env");
      configMap.setData("OVERRIDDEN", "final");
      expect(configMap.data).toEqual({
        UNTOUCHED: "yes",
        OVERRIDDEN: "final",
      });
    });
  });

  describe("Name suffix hash", () => {
    test("It includes suffix hash by default", () => {
      const chart = makeChart();
      new ConfigMap(chart, "test");
      const results = Testing.synth(chart);
      expect(results[0].metadata.name).toBe("test-4t7k5tctth");
    });

    test("Suffix hash can be disabled", () => {
      const chart = makeChart();
      new ConfigMap(chart, "no-suffix", {
        disableNameSuffixHash: true,
      });
      const results = Testing.synth(chart);
      expect(results[0].metadata.name).toBe("no-suffix");
    });

    test("It includes prunable label with suffix hash enabled", () => {
      const chart = makeChart();
      new ConfigMap(chart, "test", { disableNameSuffixHash: false });
      const results = Testing.synth(chart);
      expect(results[0].metadata.labels).toHaveProperty("prunable");
      expect(results[0].metadata.labels.prunable).toBe("true");
    });

    test("It does not include prunable label with suffix hash disabled", () => {
      const chart = makeChart();
      new ConfigMap(chart, "test", {
        metadata: { labels: { test: "true" } },
        disableNameSuffixHash: true,
      });
      const results = Testing.synth(chart);
      expect(results[0].metadata.labels).not.toHaveProperty("prunable");
    });

    test("Can be referenced in other objects", () => {
      const chart = makeChart();
      const configMap = new ConfigMap(chart, "test", { data: { FOO: "foo" } });
      new KubePod(chart, "pod", {
        spec: {
          containers: [
            {
              name: "test",
              envFrom: [{ configMapRef: { name: configMap.name } }],
            },
          ],
        },
      });
      const results = Testing.synth(chart);
      expect(results[0].metadata.name).toBe("test-9g94h95f62");
      expect(results[0].metadata.name).toBe(
        results[1].spec.containers[0].envFrom[0].configMapRef.name,
      );
    });

    test("Can be referenced in other objects with suffix disabled", () => {
      const chart = makeChart();
      const configMap = new ConfigMap(chart, "no-suffix", {
        disableNameSuffixHash: true,
        data: { FOO: "foo" },
      });
      new KubePod(chart, "pod", {
        spec: {
          containers: [
            {
              name: "test",
              envFrom: [{ configMapRef: { name: configMap.name } }],
            },
          ],
        },
      });
      const results = Testing.synth(chart);
      expect(results[0].metadata.name).toBe("no-suffix");
      expect(results[0].metadata.name).toBe(
        results[1].spec.containers[0].envFrom[0].configMapRef.name,
      );
    });
  });

  describe("Loading files", () => {
    test("Setting value from file's contents", () => {
      vol.fromJSON({
        "path/to/file.txt": "hello world!",
      });
      const chart = Testing.chart();
      const configMap = new ConfigMap(chart, "test");
      configMap.setFile("path/to/file.txt");
      const results = Testing.synth(chart);
      expect(results).toMatchSnapshot();
    });

    test("Setting value from file's contents with custom key", () => {
      vol.fromJSON({
        "path/to/file.txt": "hello world!",
      });
      const chart = Testing.chart();
      const configMap = new ConfigMap(chart, "test");
      configMap.setFile("path/to/file.txt", "greeting.txt");
      const results = Testing.synth(chart);
      expect(results).toMatchSnapshot();
    });

    test("Setting value from binary file's contents", () => {
      vol.fromJSON({
        "path/to/file.bin": "0101010",
      });
      const chart = Testing.chart();
      const configMap = new ConfigMap(chart, "test");
      configMap.setBinaryFile("path/to/file.bin");
      const results = Testing.synth(chart);
      expect(results).toMatchSnapshot();
    });

    test("Setting value from binary file's contents with custom key", () => {
      vol.fromJSON({
        "path/to/file.bin": "0101010",
      });
      const chart = Testing.chart();
      const configMap = new ConfigMap(chart, "test");
      configMap.setBinaryFile("path/to/file.bin", "greeting.bin");
      const results = Testing.synth(chart);
      expect(results).toMatchSnapshot();
    });

    test("Loading data key/values from .env file", () => {
      vol.fromJSON({
        "values.env": [
          "FOO=bar",
          "# a comment = ignore",
          "VAR_WITH_SPECIAL_CHARS=space slash/other@#1!=",
        ].join("\n"),
      });
      const chart = Testing.chart();
      const configMap = new ConfigMap(chart, "test");
      configMap.setFromEnvFile("values.env");
      expect(configMap.data).toEqual({
        FOO: "bar",
        VAR_WITH_SPECIAL_CHARS: "space slash/other@#1!=",
      });
    });

    test("Special characters from .env file are left intact", () => {
      vol.fromJSON({
        "values.env": [
          `AN_EMAIL=support@example.com`,
          `COMMENT_VALUE=/* nothing here */`,
          `DOUBLE_QUOTED="this too #and this"`,
          `JSON=[{"foo":"bar","baz":"qux"}]`,
          `LEADING_EQUALS==foo`,
          `SINGLE_QUOTED='yes it is'`,
          `TRAILING_EQUALS=bar=`,
          `TWO_WORDS=one two`,
        ].join("\n"),
      });
      const chart = Testing.chart();
      const configMap = new ConfigMap(chart, "test");
      configMap.setFromEnvFile("values.env");
      expect(configMap.data).toEqual({
        AN_EMAIL: "support@example.com",
        COMMENT_VALUE: "/* nothing here */",
        DOUBLE_QUOTED: "this too #and this",
        JSON: `[{"foo":"bar","baz":"qux"}]`,
        LEADING_EQUALS: "=foo",
        SINGLE_QUOTED: "yes it is",
        TRAILING_EQUALS: "bar=",
        TWO_WORDS: "one two",
      });
    });

    test("Loading empty .env file", () => {
      vol.fromJSON({
        "values.env": ["# a comment = ignore"].join("\n"),
      });
      const chart = Testing.chart();
      const configMap = new ConfigMap(chart, "test");
      configMap.setFromEnvFile("values.env");
      expect(configMap.data).toEqual({});
    });

    test("Loading .env files from props", () => {
      vol.fromJSON({
        "bar.env": "BAR=bar",
        "foo.env": "FOO=foo",
      });
      const chart = Testing.chart();
      const configMap = new ConfigMap(chart, "test", {
        envFiles: ["bar.env", "foo.env"],
      });
      expect(configMap.data).toEqual({
        BAR: "bar",
        FOO: "foo",
      });
    });
  });
});
