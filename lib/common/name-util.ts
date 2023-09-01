import { TalisShortRegion } from "../talis-chart/talis-region";
import { TalisDeploymentEnvironment } from "../talis-chart/talis-deployment-environment";

/**
 * Join an array of strings with a separator, omitting empty ones.
 */
export function joinNameParts(parts: (string | undefined)[]): string {
  return parts.filter(Boolean).join("-");
}

/**
 * Abbreviate name of the environment.
 */
function abbreviateEnvironment(
  environment: TalisDeploymentEnvironment,
): string {
  switch (environment) {
    case TalisDeploymentEnvironment.PRODUCTION:
      return "prod";

    case TalisDeploymentEnvironment.BUILD:
    case TalisDeploymentEnvironment.ONDEMAND:
    case TalisDeploymentEnvironment.PREVIEW:
      // Omit, because namespace should include watermark.
      return "";

    case TalisDeploymentEnvironment.DEVELOPMENT:
      // We want it to be the same as or longer than "production".
      // Also it's the same length (7) as "staging".
      return "develop";

    default:
      return environment;
  }
}

/**
 * Abbreviate name of the region.
 */
function abbreviateRegion(region: TalisShortRegion): string {
  switch (region) {
    case TalisShortRegion.LOCAL:
      // Omit
      return "";

    default:
      return region;
  }
}

/**
 * Make a name for the load balancer.
 */
export function makeLoadBalancerName(
  namespace: string | undefined,
  instanceLabels: {
    instance?: string;
    canary?: string;
    environment?: TalisDeploymentEnvironment;
    region?: TalisShortRegion;
  },
): string {
  const { instance, canary, environment, region } = instanceLabels;
  const canarySuffix = canary && canary === "true" ? "c" : undefined;
  const envShort = abbreviateEnvironment(
    environment ?? TalisDeploymentEnvironment.DEVELOPMENT,
  );
  const regShort = abbreviateRegion(region ?? TalisShortRegion.LOCAL);

  return joinNameParts([namespace, instance, canarySuffix, envShort, regShort]);
}
