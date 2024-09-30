import { Testing } from "cdk8s";
import { ConfigMap, nginxUtil } from "../../lib";

describe("nginx-util", () => {
  describe("createConfigMap", () => {
    test("Empty", () => {
      const chart = Testing.chart();
      nginxUtil.createConfigMap(chart, {});
      const results = Testing.synth(chart);
      expect(results).toMatchSnapshot();
    });

    test("Instance of ConfigMap", () => {
      const chart = Testing.chart();
      const configMap = nginxUtil.createConfigMap(chart, {});
      expect(configMap).toBeInstanceOf(ConfigMap);
    });

    test("Default config", () => {
      const chart = Testing.chart();
      nginxUtil.createConfigMap(chart, {
        includeDefaultConfig: true,
        applicationPort: 8080,
        nginxPort: 80,
      });
      const results = Testing.synth(chart);
      expect(results).toMatchSnapshot();
    });

    test("Default config requires specifying application port", () => {
      expect(() => {
        const chart = Testing.chart();
        nginxUtil.createConfigMap(chart, {
          includeDefaultConfig: true,
        });
      }).toThrowErrorMatchingSnapshot();
    });

    test("Default config requires specifying nginx port", () => {
      expect(() => {
        const chart = Testing.chart();
        nginxUtil.createConfigMap(chart, {
          includeDefaultConfig: true,
          applicationPort: 3000,
        });
      }).toThrowErrorMatchingSnapshot();
    });

    test("Application port and nginx port must be different", () => {
      expect(() => {
        const chart = Testing.chart();
        nginxUtil.createConfigMap(chart, {
          includeDefaultConfig: true,
          applicationPort: 80,
          nginxPort: 80,
        });
      }).toThrowErrorMatchingSnapshot();
    });

    test("Same site cookies config", () => {
      const chart = Testing.chart();
      nginxUtil.createConfigMap(chart, {
        includeSameSiteCookiesConfig: true,
      });
      const results = Testing.synth(chart);
      expect(results).toMatchSnapshot();
    });

    test("Custom data", () => {
      const chart = Testing.chart();
      nginxUtil.createConfigMap(
        chart,
        {},
        {
          "custom.conf": "# custom config",
        },
      );
      const results = Testing.synth(chart);
      expect(results).toMatchSnapshot();
    });

    test("Custom data with default config", () => {
      const chart = Testing.chart();
      nginxUtil.createConfigMap(
        chart,
        {
          includeDefaultConfig: true,
          applicationPort: 8080,
          nginxPort: 80,
        },
        {
          "custom.conf": "# custom config",
        },
      );
      const results = Testing.synth(chart);
      expect(results).toMatchSnapshot();
    });

    test("Partitioned cookies config", () => {
      const chart = Testing.chart();
      nginxUtil.createConfigMap(chart, {
        usePartionedCookiesLocations: ["/api/oidclogin"],
      });
      const results = Testing.synth(chart);
      expect(results).toMatchSnapshot();
    });

    test("Partitioned cookies config with multiple locations", () => {
      const chart = Testing.chart();
      nginxUtil.createConfigMap(chart, {
        usePartionedCookiesLocations: ["/api/oidclogin", "/api/auth/login"],
      });
      const results = Testing.synth(chart);
      expect(results).toMatchSnapshot();
    });
  });
});
