import { ApiObject, JsonPatch } from "cdk8s";
import { SafeToEvictPodProps } from "./pod-props";

const workloadsWithPodTemplateKinds = [
  "DaemonSet",
  "Deployment",
  "Job",
  "StatefulSet",
];

/**
 * Sets given labels to API objects, and also to their pod templates.
 * @param apiObjects Array of API objects, e.g. from Helm, Include, etc.
 * @param labels Labels to set
 */
export function addLabels(
  apiObjects: ApiObject[],
  labels: Record<string, string>,
): void {
  const labelEntries = Object.entries(labels);

  apiObjects.forEach((object) => {
    labelEntries.forEach(([key, value]) => {
      object.metadata.addLabel(key, value);
    });

    if (workloadsWithPodTemplateKinds.includes(object.kind)) {
      const workload = object.toJson();
      const selector =
        (workload?.spec?.selector?.matchLabels as Record<string, string>) ?? {};

      labelEntries.forEach(([key, value]) => {
        if (key in selector && selector[key] !== value) {
          throw new Error(`Setting ${key} label would overwrite selector`);
        }
        object.addJsonPatch(
          JsonPatch.add(`/spec/template/metadata/labels/${key}`, value),
        );
      });
    }

    if (object.kind === "CronJob") {
      labelEntries.forEach(([key, value]) => {
        object.addJsonPatch(
          JsonPatch.add(`/spec/jobTemplate/metadata/labels/${key}`, value),
          JsonPatch.add(
            `/spec/jobTemplate/spec/template/metadata/labels/${key}`,
            value,
          ),
        );
      });
    }
  });
}

/**
 * Create an object with Cluster Autoscaler safe-to-evict annotations.
 * @param props Pod properties
 * @returns Annotations object or undefined if no annotations are needed
 */
export function makeSafeToEvictAnnotations(
  props: SafeToEvictPodProps,
): Record<string, string> | undefined {
  const annotations: Record<string, string> = {};

  if ("safeToEvict" in props && props.safeToEvict !== undefined) {
    annotations["cluster-autoscaler.kubernetes.io/safe-to-evict"] =
      props.safeToEvict.toString();
  }

  if (
    "safeToEvictLocalVolumes" in props &&
    props.safeToEvictLocalVolumes !== undefined
  ) {
    annotations[
      "cluster-autoscaler.kubernetes.io/safe-to-evict-local-volumes"
    ] = props.safeToEvictLocalVolumes.join(",");
  }

  if (Object.keys(annotations).length === 0) {
    return undefined;
  }

  return annotations;
}
