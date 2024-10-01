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

  /**
   * Whether to include a config that patches Set-Cookies header to include `Partitioned`
   * For further details on partitioned cookies visit:
   *
   * https://developer.mozilla.org/en-US/docs/Web/Privacy/Privacy_sandbox/Partitioned_cookies
   * @default undefined
   */
  readonly usePartionedCookiesLocations?: string[];
}

/**
 * Create a config map with Nginx configuration.
 */
function createConfigMap(
  scope: Construct,
  props: NginxConfigMapProps,
  data: { [key: string]: string } = {},
): ConfigMap {
  const usePartitionedCookies =
    props.usePartionedCookiesLocations &&
    props.usePartionedCookiesLocations.length > 0;

  if (props.includeDefaultConfig || usePartitionedCookies) {
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
  props: Pick<
    NginxConfigMapProps,
    "applicationPort" | "nginxPort" | "usePartionedCookiesLocations"
  >,
): string {
  const { applicationPort, nginxPort } = props;

  if (!applicationPort || !nginxPort) {
    throw new Error("Application and nginx ports must be set");
  }

  if (applicationPort === nginxPort) {
    throw new Error("Application and nginx ports must be different");
  }

  const defaultRouteLocation = createProxyRouteConfig(
    "/",
    "http://application",
  );

  const partitionedCookieLocations = getPartitionedCookiesConfig(
    props.usePartionedCookiesLocations,
  );

  return fs
    .readFileSync(resolvePath("nginx/default.conf"), "utf8")
    .replaceAll("{{applicationPort}}", applicationPort.toString())
    .replaceAll("{{nginxPort}}", nginxPort.toString())
    .replaceAll("{{defaultRouteLocation}}", defaultRouteLocation)
    .replaceAll("{{partitionedCookieLocations}}", partitionedCookieLocations);
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

function getPartitionedCookiesConfig(locations?: string[]): string {
  if (!locations) {
    return "";
  }

  return locations
    .map((location) =>
      createProxyRouteConfig(location, `http://application${location}`, [
        `proxy_cookie_path / "/; Partitioned";`,
      ]),
    )
    .join("\n\n");
}

function createProxyRouteConfig(
  location: string,
  proxyPath: string,
  additionalSettings?: string[],
): string {
  const additional = additionalSettings ? additionalSettings.join("\n") : "";

  return `location ${location} {
    proxy_pass ${proxyPath};
    proxy_http_version 1.1;

    proxy_set_header Connection $connection_upgrade;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

    ${additional}
  }`;
}

export const nginxUtil = {
  createConfigMap,
  getDefaultConfig,
  getSameSiteCookiesConfig,
};
