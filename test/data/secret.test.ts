import mockFs from "mock-fs";
import { Lazy, Testing } from "cdk8s";
import { Secret } from "../../lib";
import { KubePod } from "../../imports/k8s";

function makeChart() {
  const chart = Testing.chart();
  // Just output node's id as the object's name
  chart.generateObjectName = (obj) => {
    return obj.node.id;
  };
  return chart;
}

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
          bin: "hello",
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
      expect(secret.metadata).toMatchSnapshot();
    });

    test("Data getter", () => {
      const chart = Testing.chart();
      const secret = new Secret(chart, "test", { data: { foo: "bar" } });
      expect(secret.data).toEqual({ foo: "bar" });
    });

    test("Binary data getter", () => {
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
      expect(results[0].metadata.name).toBe("test-cggk7gg52t");
      expect(results[0].metadata.name).toBe(
        results[1].spec.containers[0].envFrom[0].secretRef.name
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
        results[1].spec.containers[0].envFrom[0].secretRef.name
      );
    });
  });

  describe("Loading files", () => {
    afterEach(() => {
      mockFs.restore();
    });

    test("Setting value from file's contents", () => {
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

    test("Setting value from file's contents with custom key", () => {
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

    test("Setting value from string file's contents", () => {
      mockFs({
        "path/to/file.txt": "hello",
      });
      const chart = Testing.chart();
      const secret = new Secret(chart, "test");
      secret.setStringFile("path/to/file.txt");
      const results = Testing.synth(chart);
      mockFs.restore();
      expect(results).toMatchSnapshot();
    });

    test("Setting value from binary file's contents with custom key", () => {
      mockFs({
        "path/to/file.txt": "hello",
      });
      const chart = Testing.chart();
      const secret = new Secret(chart, "test");
      secret.setStringFile("path/to/file.txt", "greeting.txt");
      const results = Testing.synth(chart);
      mockFs.restore();
      expect(results).toMatchSnapshot();
    });

    test("Loading data key/values from .env file", () => {
      mockFs({
        "values.env": [
          "FOO=bar",
          "# a comment = ignore",
          "VAR_WITH_SPECIAL_CHARS=#%/!*;:@&=+$,#",
          "SIGNLE_QUOTED='yes it is'",
          'DOUBLE_QUOTED="this too"',
        ].join("\n"),
      });
      const chart = Testing.chart();
      const secret = new Secret(chart, "test");
      secret.setFromEnvFile("values.env");
      expect(secret.data).toEqual({
        DOUBLE_QUOTED: "this too",
        FOO: "bar",
        SIGNLE_QUOTED: "yes it is",
        VAR_WITH_SPECIAL_CHARS: "#%/!*;:@&=+$,#",
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
        BAR: "bar",
        FOO: "foo",
      });
    });
  });
});
