import { TalisChart } from "../talis-chart";
import { KubeServiceAccount } from "../../imports/k8s";

import { Construct } from "constructs";
import { Chart } from "cdk8s";
import {
  VirtualNode,
  VirtualNodeSpecListenersPortMappingProtocol,
  VirtualNodeSpecServiceDiscoveryDnsResponseType,
} from "../../imports/appmesh.k8s.aws";

// Add the appmesh.k8s.aws/sidecarInjectorWebhook=enabled label to the namespace
// This is used to enable the App Mesh sidecar injector webhook
export function addAwsAppMeshInjectionLabels(chart: TalisChart): void {
  chart.kubeNamespace.metadata.addLabel(
    "appmesh.k8s.aws/sidecarInjectorWebhook",
    "enabled",
  );
}

// Add the aws.tfs.engineering/appMeshIngress=enabled label to the namespace
// This is used to identify namespaces where ingress gateways should be deployed
export function addAppMeshAllowIngressLabels(chart: TalisChart): void {
  chart.kubeNamespace.metadata.addLabel(
    "aws.tfs.engineering/appMeshIngress",
    "enabled",
  );
}

// Add the aws.tfs.engineering/appMesh label to the namespace
// This is used to identify the App Mesh associated with the namespace
export function addAppMeshIdentityLabels(
  chart: TalisChart,
  meshName: string,
): void {
  chart.kubeNamespace.metadata.addLabel(
    "aws.tfs.engineering/appMesh",
    meshName,
  );
}

// Add the eks.amazonaws.com/role-arn annotation to the default service account
// This is used to associate the App Mesh role with the default service account
export function addAppMeshRoleToDefaultServiceAccount(
  chart: TalisChart,
  roleArn: string,
) {
  new KubeServiceAccount(chart, "default", {
    metadata: {
      name: "default",
      annotations: {
        "eks.amazonaws.com/role-arn": roleArn,
      },
    },
  });
}

// This function creates a VirtualNode for a service with the given configuration
// upstreamServices: Array<{ name: string; namespace: string }>
// upstreamServices are the services which pods running this service will communicate with
export function createVirtualNodeForService(
  scope: Construct,
  serviceName: string,
  servicePort: number,
  servicePodSelectorLabels: Record<string, string>,
  upstreamServices: Array<{ name: string; namespace: string }>,
): VirtualNode {
  const namespace = Chart.of(scope).namespace;
  return new VirtualNode(scope, `${serviceName}-virtualNode`, {
    metadata: {
      name: serviceName,
    },
    spec: {
      podSelector: {
        matchLabels: servicePodSelectorLabels,
      },
      listeners: [
        {
          portMapping: {
            port: servicePort,
            protocol: VirtualNodeSpecListenersPortMappingProtocol.HTTP,
          },
        },
      ],
      serviceDiscovery: {
        dns: {
          hostname: `${serviceName}.${namespace}.svc.cluster.local`,
          responseType:
            VirtualNodeSpecServiceDiscoveryDnsResponseType.LOADBALANCER,
        },
      },
      backends: upstreamServices.map((upstream) => {
        return {
          virtualService: {
            virtualServiceRef: {
              name: upstream.name,
              namespace: upstream.namespace,
            },
          },
        };
      }),
    },
  });
}
