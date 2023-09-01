import { Chart } from "cdk8s";
import { IConstruct } from "constructs";
import { KubeService, KubeStatefulSet } from "../../imports/k8s";

export interface DnsAwareStatefulSet extends IConstruct {
  readonly service: KubeService;
  readonly statefulSet: KubeStatefulSet;

  /**
   * Get the DNS name of the instance.
   * @param replica Number of the Pod replica to get address for
   */
  getDnsName(replica: number): string;
}

/**
 * Get the DNS name of the instance.
 * Each pod in a StatefulSet backed by a headless Service will have a stable DNS
 * name. The template follows this format: <pod-name>.<service-name>.
 * Since Pod replicas in StatefulSets are numbered, we can use the index of the
 * Pod to get the DNS name. If the chart knows its namespace, this function will
 * return a fully qualified DNS name.
 *
 * @param construct Construct to get DNS name for
 * @param replica Number of the Pod replica to get address for
 */
export function getDnsName(
  construct: DnsAwareStatefulSet,
  replica = 0,
): string {
  const dnsName = `${construct.statefulSet.name}-${replica}.${construct.service.name}`;
  const chart = Chart.of(construct);

  if (chart.namespace) {
    return `${dnsName}.${chart.namespace}.svc.cluster.local`;
  }

  return dnsName;
}
