import mockFs from "mock-fs";
import { Lazy, Testing } from "cdk8s";
import { Secret } from "../../lib";
import { KubePod } from "../../imports/k8s";
import { makeChart } from "../test-util";

const encode = (value: string) => Buffer.from(value).toString("base64");

describe("Secret", () => {
  describe("Props", () => {
    test("Empty Secret", () => {
      const chart = Testing.chart();
      new Secret(chart, "test");
      const results = Testing.synth(chart);
      expect(results).toMatchSnapshot();
    });

    test("Secret from props", () => {
      const chart = Testing.chart();
      new Secret(chart, "test", {
        data: {
          foo: "secret#!23",
        },
        stringData: {
          bar: "hello",
        },
        immutable: true,
        type: "Opaque",
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
      const secret = new Secret(chart, "test");
      expect(secret.name).toBeInstanceOf(Lazy);
    });

    test("Metadata getter", () => {
      const chart = Testing.chart();
      const secret = new Secret(chart, "test", {
        metadata: {
          labels: { test: "true" },
        },
      });
      expect(secret.metadata.toJson()).toMatchSnapshot();
    });

    test("Setting data encodes the value", () => {
      const chart = Testing.chart();
      const secret = new Secret(chart, "test");
      secret.setData("test", "this will be encoded");
      expect(secret.data).toEqual({ test: "dGhpcyB3aWxsIGJlIGVuY29kZWQ=" });
    });

    test("Allows setting already encoded data value", () => {
      const chart = Testing.chart();
      const secret = new Secret(chart, "test");
      secret.setData("test", "dGhpcyBpcyBlbmNvZGVk", false);
      expect(secret.data).toEqual({ test: "dGhpcyBpcyBlbmNvZGVk" });
    });

    test("Data getter", () => {
      const chart = Testing.chart();
      const secret = new Secret(chart, "test", { data: { foo: "bar" } });
      expect(secret.data).toEqual({ foo: "YmFy" });
    });

    test("String data getter", () => {
      const chart = Testing.chart();
      const secret = new Secret(chart, "test", {
        stringData: { foo: "bar" },
      });
      expect(secret.stringData).toEqual({ foo: "bar" });
    });

    test("Allows to set data key on stringData", () => {
      const chart = Testing.chart();
      const secret = new Secret(chart, "test");
      secret.setData("test", "foo");
      secret.setStringData("test", "bar");
      const results = Testing.synth(chart);
      expect(results).toMatchSnapshot();
    });

    test("Throws when trying to set stringData key on data", () => {
      const chart = Testing.chart();
      const configMap = new Secret(chart, "test");
      configMap.setStringData("test", "foo");
      expect(() => {
        configMap.setData("test", "bar");
      }).toThrowErrorMatchingSnapshot();
    });
  });

  describe("Name suffix hash", () => {
    test("It includes suffix hash by default", () => {
      const chart = makeChart();
      new Secret(chart, "test");
      const results = Testing.synth(chart);
      expect(results[0].metadata.name).toBe("test-2c7fh268c4");
    });

    test("Suffix hash can be disabled", () => {
      const chart = makeChart();
      new Secret(chart, "no-suffix", {
        disableNameSuffixHash: true,
      });
      const results = Testing.synth(chart);
      expect(results[0].metadata.name).toBe("no-suffix");
    });

    test("It includes prunable label with suffix hash enabled", () => {
      const chart = makeChart();
      new Secret(chart, "test", { disableNameSuffixHash: false });
      const results = Testing.synth(chart);
      expect(results[0].metadata.labels).toHaveProperty("prunable");
      expect(results[0].metadata.labels.prunable).toBe("true");
    });

    test("It does not include prunable label with suffix hash disabled", () => {
      const chart = makeChart();
      new Secret(chart, "test", {
        metadata: { labels: { test: "true" } },
        disableNameSuffixHash: true,
      });
      const results = Testing.synth(chart);
      expect(results[0].metadata.labels).not.toHaveProperty("prunable");
    });

    test("Can be referenced in other objects", () => {
      const chart = makeChart();
      const secret = new Secret(chart, "test", { data: { FOO: "foo" } });
      new KubePod(chart, "pod", {
        spec: {
          containers: [
            {
              name: "test",
              envFrom: [{ secretRef: { name: secret.name } }],
            },
          ],
        },
      });
      const results = Testing.synth(chart);
      expect(results[0].metadata.name).toBe("test-mbk947c92t");
      expect(results[0].metadata.name).toBe(
        results[1].spec.containers[0].envFrom[0].secretRef.name,
      );
    });

    test("Can be referenced in other objects with suffix disabled", () => {
      const chart = makeChart();
      const secret = new Secret(chart, "no-suffix", {
        disableNameSuffixHash: true,
        data: { FOO: "foo" },
      });
      new KubePod(chart, "pod", {
        spec: {
          containers: [
            {
              name: "test",
              envFrom: [{ secretRef: { name: secret.name } }],
            },
          ],
        },
      });
      const results = Testing.synth(chart);
      expect(results[0].metadata.name).toBe("no-suffix");
      expect(results[0].metadata.name).toBe(
        results[1].spec.containers[0].envFrom[0].secretRef.name,
      );
    });
  });

  describe("Loading files", () => {
    afterEach(() => {
      mockFs.restore();
    });

    test("Encoding data value from file's contents", () => {
      mockFs({
        "path/to/file.enc": "secret#!23",
      });
      const chart = Testing.chart();
      const secret = new Secret(chart, "test");
      secret.setFile("path/to/file.enc");
      const results = Testing.synth(chart);
      mockFs.restore();
      expect(results).toMatchSnapshot();
    });

    test("Encoding data value from file's contents with custom key", () => {
      mockFs({
        "path/to/file.enc": "secret#!23",
      });
      const chart = Testing.chart();
      const secret = new Secret(chart, "test");
      secret.setFile("path/to/file.enc", "greeting.enc");
      const results = Testing.synth(chart);
      mockFs.restore();
      expect(results).toMatchSnapshot();
    });

    test("Encoding data from .env file", () => {
      mockFs({
        "values.env": [
          "FOO=bar",
          "# a comment = ignore",
          "VAR_WITH_SPECIAL_CHARS=#%/!*;:@&=+$,#",
        ].join("\n"),
      });
      const chart = Testing.chart();
      const secret = new Secret(chart, "test");
      secret.setFromEnvFile("values.env");
      expect(secret.data).toEqual({
        FOO: encode("bar"),
        VAR_WITH_SPECIAL_CHARS: encode("#%/!*;:@&=+$,#"),
      });
    });

    test("Special characters from .env file are left intact", () => {
      mockFs({
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
      const configMap = new Secret(chart, "test");
      configMap.setFromEnvFile("values.env");
      expect(configMap.data).toEqual({
        AN_EMAIL: encode("support@example.com"),
        COMMENT_VALUE: encode("/* nothing here */"),
        DOUBLE_QUOTED: encode("this too #and this"),
        JSON: encode(`[{"foo":"bar","baz":"qux"}]`),
        LEADING_EQUALS: encode("=foo"),
        SINGLE_QUOTED: encode("yes it is"),
        TRAILING_EQUALS: encode("bar="),
        TWO_WORDS: encode("one two"),
      });
    });

    test("Loading empty .env file", () => {
      mockFs({
        "values.env": ["# a comment = ignore"].join("\n"),
      });
      const chart = Testing.chart();
      const secret = new Secret(chart, "test");
      secret.setFromEnvFile("values.env");
      expect(secret.data).toEqual({});
    });

    test("Loading .env files from props", () => {
      mockFs({
        "bar.env": "BAR=bar",
        "foo.env": "FOO=foo",
      });
      const chart = Testing.chart();
      const secret = new Secret(chart, "test", {
        envFiles: ["bar.env", "foo.env"],
      });
      expect(secret.data).toEqual({
        BAR: "YmFy",
        FOO: "Zm9v",
      });
    });
  });
  describe("when CDK8S_REDACT_SECRET_DATA is set to true", () => {
    const PROCESS_ENV = process.env;

    beforeEach(() => {
      vi.resetModules();
      process.env = { ...PROCESS_ENV };
      process.env.CDK8S_REDACT_SECRET_DATA = "true";
    });

    afterEach(() => {
      process.env = PROCESS_ENV;
    });

    test("secrets are redacted", () => {
      const chart = Testing.chart();
      const secret = new Secret(chart, "test");
      secret.setData("test", "this will be redacted");
      expect(secret.data).toEqual({ test: "****************************" });
    });
  });
});
