/**
 * Join an array of strings with a separator, omitting empty ones.
 */
export function joinNameParts(parts: (string | undefined)[]): string {
  return parts.filter(Boolean).join("-");
}

/**
 * Abbreviate name of the environment.
 */
function abbreviateEnvironment(environment: string): string {
  switch (environment) {
    case "production":
      return "prod";

    case "ondemand":
      // Omit, because namespace should include watermark.
      return "";

    case "development":
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
function abbreviateRegion(region: string): string {
  switch (region) {
    case "local":
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
    environment?: string;
    region?: string;
  }
): string {
  const { instance, canary, environment, region } = instanceLabels;
  const canarySuffix = canary && canary === "true" ? "c" : undefined;
  const envShort = abbreviateEnvironment(environment ?? "");
  const regShort = abbreviateRegion(region ?? "");

  return joinNameParts([namespace, instance, canarySuffix, envShort, regShort]);
}
