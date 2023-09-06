import { ApiObject } from "cdk8s";
import { IConstruct } from "constructs";
import {
  Container,
  CronJobSpec,
  DaemonSetSpec,
  DeploymentSpec,
  HorizontalPodAutoscalerSpecV2,
  KubeHorizontalPodAutoscalerV2,
  ObjectMeta,
  PodSpec,
  Quantity,
  ReplicaSetSpec,
  ResourceQuotaSpec,
  StatefulSetSpec,
} from "../../imports/k8s";
import { ScaledObject, ScaledObjectSpec } from "../../imports/keda.sh";
import { WebService } from "../web-service";
import { getValueFromIntOrPercent } from "../common";

const workloadKinds = [
  "Pod",
  "CronJob",
  "DaemonSet",
  "Deployment",
  "Job",
  "StatefulSet",
];

interface KubeObject {
  kind: string;
  metadata: ObjectMeta;
  spec: PodSpec &
    CronJobSpec &
    DaemonSetSpec &
    DeploymentSpec &
    ReplicaSetSpec &
    StatefulSetSpec &
    HorizontalPodAutoscalerSpecV2 &
    ScaledObjectSpec;
}

function cpuToMillicores(cpu: Quantity | string | number): number {
  if (cpu instanceof Quantity) {
    cpu = cpu.value as string | number;
  }

  if (typeof cpu === "string" && cpu.endsWith("m")) {
    return Number(cpu.slice(0, -1));
  }

  return Number(cpu) * 1000;
}

function millicoresToCpu(cpu: number): string {
  return `${cpu}m`;
}

function memoryToBytes(memory: Quantity | string | number): number {
  if (memory instanceof Quantity) {
    memory = memory.value as string | number;
  }

  if (typeof memory === "number") {
    return memory;
  }

  switch (true) {
    case memory.endsWith("Gi"):
      return Number(memory.slice(0, -2)) * 1024 * 1024 * 1024;

    case memory.endsWith("Mi"):
      return Number(memory.slice(0, -2)) * 1024 * 1024;

    case memory.endsWith("Ki"):
      return Number(memory.slice(0, -2)) * 1024;

    case memory.endsWith("G"):
      return Number(memory.slice(0, -1)) * 1000 * 1000 * 1000;

    case memory.endsWith("M"):
      return Number(memory.slice(0, -1)) * 1000 * 1000;

    case memory.endsWith("K"):
      return Number(memory.slice(0, -1)) * 1000;

    default:
      return Number(memory);
  }
}

function bytesToMemory(bytes: number): string {
  return `${Math.ceil(bytes / (1024 * 1024))}Mi`;
}

function makeIdentifier(object: KubeObject): string {
  return `${object.kind}/${object.metadata.name}`;
}

function getContainers(workload: KubeObject): Container[] {
  if (workload.spec?.template?.spec?.containers) {
    return workload.spec.template.spec.containers;
  }
  if (workload.spec?.jobTemplate?.spec?.template?.spec?.containers) {
    return workload.spec.jobTemplate.spec.template.spec.containers;
  }
  if (workload.spec?.containers) {
    return workload.spec.containers;
  }
  throw new Error(`Could not find containers in ${makeIdentifier(workload)}`);
}

function getResourceRequest(
  workload: KubeObject,
  container: Container,
  resource: string,
) {
  if (container?.resources?.requests?.[resource]) {
    return container.resources.requests[resource];
  }
  if (container?.resources?.limits?.[resource]) {
    return container.resources.limits[resource];
  }

  throw new Error(
    `No ${resource} requests found in ${makeIdentifier(workload)}`,
  );
}

function getPodMaxSurge(workload: KubeObject, replicas: number) {
  if (workload.kind === "Pod") {
    return 0;
  }

  const maxSurge = workload.spec?.strategy?.rollingUpdate?.maxSurge ?? "25%";

  return getValueFromIntOrPercent(maxSurge, replicas);
}

export function calculateResourceQuota(
  objects: IConstruct[],
): ResourceQuotaSpec {
  const workloads = new Map<string, KubeObject>();
  const maxReplicas: Record<string, number> = {};

  function addWorkload(object: ApiObject) {
    const kubeObject = object.toJson() as KubeObject;
    const key = makeIdentifier(kubeObject);
    workloads.set(key, kubeObject);
  }

  function addHpaMaxReplicas(object: KubeHorizontalPodAutoscalerV2) {
    const hpa = object.toJson() as KubeObject;
    const target = hpa.spec.scaleTargetRef;
    const key = target.kind + "/" + target.name;
    maxReplicas[key] = hpa?.spec?.maxReplicas ?? 1;
  }

  function addScaledObjectMaxReplicas(object: ScaledObject) {
    const obj = object.toJson() as KubeObject;
    const target = obj.spec.scaleTargetRef;
    const key = target.kind + "/" + target.name;
    maxReplicas[key] = obj?.spec?.maxReplicaCount ?? 1;
  }

  for (const object of objects) {
    // Collect Kube* objects depending on their kind
    if (object instanceof ApiObject) {
      if (workloadKinds.includes(object.kind)) {
        addWorkload(object);
      } else if (object.kind === "HorizontalPodAutoscaler") {
        addHpaMaxReplicas(object);
      } else if (object.kind === "ScaledObject") {
        addScaledObjectMaxReplicas(object);
      }
    }

    // Special case for WebService - where canary deployments are enabled,
    // the Deployment and HorizontalPodAutoscaler may not be included in
    // the list of objects, but the construct holds their references.
    if (object instanceof WebService) {
      addWorkload(object.deployment);
      if (object.hpa) {
        addHpaMaxReplicas(object.hpa);
      }
    }
  }

  let totalPods = 0;
  let totalCpu = 0;
  let totalMemory = 0;

  for (const [key, workload] of workloads) {
    const containers = getContainers(workload);
    const replicas = maxReplicas[key] ?? workload.spec?.replicas ?? 1;
    const surge = getPodMaxSurge(workload, replicas);
    const workloadReplicas = replicas + surge;

    let workloadCpu = 0;
    let workloadMemory = 0;

    for (const container of containers) {
      const cpuRequest = getResourceRequest(workload, container, "cpu");
      const memoryRequest = getResourceRequest(workload, container, "memory");
      workloadCpu += cpuToMillicores(cpuRequest);
      workloadMemory += memoryToBytes(memoryRequest);
    }

    totalPods += workloadReplicas;
    totalCpu += workloadCpu * workloadReplicas;
    totalMemory += workloadMemory * workloadReplicas;
  }

  return {
    hard: {
      cpu: Quantity.fromString(millicoresToCpu(totalCpu)),
      memory: Quantity.fromString(bytesToMemory(totalMemory)),
      pods: Quantity.fromNumber(totalPods),
    },
  };
}
