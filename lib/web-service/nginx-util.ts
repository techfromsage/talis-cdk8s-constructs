import { ApiObject } from "cdk8s";
import { Construct } from "constructs";
import * as fs from "fs";
import * as path from "path";
import { KubeConfigMap } from "../../imports/k8s";

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

function createConfigMap(
  scope: Construct,
  props: NginxConfigMapProps,
  data: { [key: string]: string } = {}
): ApiObject {
  if (props.includeDefaultConfig) {
    data["default.conf"] = getDefaultConfig(props);
  }

  if (props.includeSameSiteCookiesConfig) {
    data["samesite.conf"] = getSameSiteCookiesConfig();
  }

  const configMap = new KubeConfigMap(scope, "nginx-config", { data });
  return configMap;
}

function getDefaultConfig(
  props: Pick<NginxConfigMapProps, "applicationPort" | "nginxPort">
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

function getSameSiteCookiesConfig(): string {
  return fs.readFileSync(resolvePath("nginx/samesite.conf"), "utf8");
}

export const nginxUtil = {
  createConfigMap,
  getDefaultConfig,
  getSameSiteCookiesConfig,
};
