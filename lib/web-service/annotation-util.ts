function resolveEnvironmentRegionUrlPart(
  environment: string,
  region: string
): string {
  switch (`${environment}-${region}`) {
    case "production-ca":
      return ".ca";
    case "production-eu":
      return "-eu";
    default:
      return "-staging-eu";
  }
}

function getServiceUrl(
  service: string,
  environment: string,
  region: string
): string {
  const envRegionPart = resolveEnvironmentRegionUrlPart(environment, region);
  return `https://${service}-eks${envRegionPart}.talisaspire.com`;
}

/**
 * Returns the URL for the Kubernetes Dashboard for the given namespace.
 */
export function getEksDashboardUrl(
  environment: string,
  region: string,
  namespace: string
): string {
  const dashboardUrl = getServiceUrl("dashboard", environment, region);
  return `${dashboardUrl}/#/overview?namespace=${namespace}`;
}

/**
 * Returns the URL for the Grafana workloads dashboard for the given namespace.
 */
export function getGraphsUrl(
  environment: string,
  region: string,
  namespace: string
): string {
  const grafanaUrl = getServiceUrl("grafana", environment, region);
  // https://github.com/talis/infra/blob/d1e36a872691dcea052c28c27bd04e5273b2462f/kubernetes/monitoring/base-grafana/grafana/dashboards/k8s-resources-workloads-namespace.json#L1962
  return `${grafanaUrl}/d/a87fb0d919ec0ea5f6543124e16c42a5/kubernetes-compute-resources-namespace-workloads?var-namespace=${namespace}`;
}

/**
 * Returns the URL for the Loki logs dashboard for the given app.
 */
export function getLogsUrl(
  environment: string,
  region: string,
  app: string
): string {
  const grafanaUrl = getServiceUrl("grafana", environment, region);
  // https://github.com/talis/infra/blob/a09e3d9a29a333b987e612f41242f372929b668f/kubernetes/monitoring/base-grafana/grafana/dashboards/loki-logs.json#L187
  return `${grafanaUrl}/d/lokiR6qB0/loki-logs?var-apps=${app}`;
}

/**
 * Stringify given list as stringList: `s1,s2,s3`, as used in annotations
 * supported by AWS Load Balancer Controller.
 * @see https://kubernetes-sigs.github.io/aws-load-balancer-controller/v2.3/guide/ingress/annotations/
 */
export function convertToStringList(list: string[]): string {
  return list.filter((value) => value).join(",");
}

/**
 * Stringify given object as stringMap: `k1=v1,k2=v2`, as used in annotations
 * supported by AWS Load Balancer Controller.
 * @see https://kubernetes-sigs.github.io/aws-load-balancer-controller/v2.3/guide/ingress/annotations/
 */
export function convertToStringMap(map: { [key: string]: string }): string {
  return Object.entries(map)
    .filter(([, value]) => value)
    .map(([key, value]) => `${key}=${value}`)
    .join(",");
}

/**
 * Stringify given object as JSON: `{"k1":"v1","k2":"v2"}`, as used in annotations
 * supported by AWS Load Balancer Controller.
 * @see https://kubernetes-sigs.github.io/aws-load-balancer-controller/v2.3/guide/ingress/annotations/
 */
export function convertToJsonContent(obj: unknown): string {
  return JSON.stringify(obj);
}
