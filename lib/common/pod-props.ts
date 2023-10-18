export interface PodProps {
  /**
   * Whether to mark the Pod as safe (true) or unsafe (false) to evict.
   * @see https://kubernetes.io/docs/reference/labels-annotations-taints/#cluster-autoscaler-kubernetes-io-safe-to-evict
   *
   * Cluster Autoscaler won't kill the Pods marked as unsafe to evict before
   * it either completes or fails. Likewise, it will kill Pods marked as safe
   * to evict even if it otherwise wouldn't be allowed to evict them.
   * @see https://github.com/kubernetes/autoscaler/blob/master/cluster-autoscaler/FAQ.md#what-types-of-pods-can-prevent-ca-from-removing-a-node
   */
  readonly safeToEvict?: boolean;

  /**
   * Names of local storage volumes that should not prevent the Pod from being
   * evicted by Cluster Autoscaler.
   * @see https://github.com/kubernetes/autoscaler/blob/master/cluster-autoscaler/FAQ.md#what-types-of-pods-can-prevent-ca-from-removing-a-node
   */
  readonly safeToEvictLocalVolumes?: string[];
}
