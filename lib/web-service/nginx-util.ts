import { Construct } from "constructs";
import * as fs from "node:fs";
import * as path from "node:path";
import { ConfigMap } from "..";

function resolvePath(filePath: string): string {
  return path.resolve(__dirname, filePath);
}

interface NginxConfigMapProps {
  /**
   * Whether to include default config
   * @default false
   */
  readonly includeDefaultConfig?: boolean;

  /**
   * Port on which the application container will listen.
   */
  readonly applicationPort?: number;

  /**
   * Port on which the nginx container will listen.
   */
  readonly nginxPort?: number;

  /**
   * Whether to include a config that patches Set-Cookies header to include `SameSite=None` and `Secure`
   * @default false
   */
  readonly includeSameSiteCookiesConfig?: boolean;
}

/**
 * Create a config map with Nginx configuration.
 */
function createConfigMap(
  scope: Construct,
  props: NginxConfigMapProps,
  data: { [key: string]: string } = {},
): ConfigMap {
  if (props.includeDefaultConfig) {
    data["default.conf"] = getDefaultConfig(props);
  }

  if (props.includeSameSiteCookiesConfig) {
    data["samesite.conf"] = getSameSiteCookiesConfig();
  }

  const configMap = new ConfigMap(scope, "nginx-config", { data });
  return configMap;
}

/**
 * Returns the contents of an Nginx configuration file that:
 * - exposes the application on the specified port,
 * - adds a health check endpoint `/livez`,
 * - enables `/nginx_status` endpoint from private IPs for monitoring.
 *
 * The output of this function is used with `createConfigMap` with `includeDefaultConfig` enabled.
 */
function getDefaultConfig(
  props: Pick<NginxConfigMapProps, "applicationPort" | "nginxPort">,
): string {
  const { applicationPort, nginxPort } = props;

  if (!applicationPort || !nginxPort) {
    throw new Error("Application and nginx ports must be set");
  }

  if (applicationPort === nginxPort) {
    throw new Error("Application and nginx ports must be different");
  }

  return fs
    .readFileSync(resolvePath("nginx/default.conf"), "utf8")
    .replaceAll("{{applicationPort}}", applicationPort.toString())
    .replaceAll("{{nginxPort}}", nginxPort.toString());
}

/**
 * Return the contents of an Nginx configuration file that patches
 * `Set-Cookie` headers to use the `SameSite` attribute.
 *
 * The output of this function is used with `createConfigMap` with `includeSameSiteCookiesConfig` enabled.
 */
function getSameSiteCookiesConfig(): string {
  return fs.readFileSync(resolvePath("nginx/samesite.conf"), "utf8");
}

export const nginxUtil = {
  createConfigMap,
  getDefaultConfig,
  getSameSiteCookiesConfig,
};
