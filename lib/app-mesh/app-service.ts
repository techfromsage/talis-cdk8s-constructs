import { Construct } from "constructs";
import { Chart } from "cdk8s";
import {
  GatewayRoute,
  VirtualService,
  VirtualRouter,
  VirtualRouterSpecListenersPortMappingProtocol,
} from "../../imports/appmesh.k8s.aws";
import { KubeService } from "../../imports/k8s";

// VirtualNodeTargets are specific versions of a service that the VirtualRouter can route traffic to.
export interface VirtualNodeTargets {
  /**
   * VirtualNode Name.
   */
  readonly name: string;

  /**
   * VirtualNode Namespace.
   */
  readonly namespace: string;

  /**
   * Weight for sending app traffic. Has to be an integer in between 0 and 100.
   */
  readonly weight: number;
}

export interface AppServiceProps {
  readonly name: string;
  readonly port: number;
  readonly instance: string;
  readonly hostname: string;
  readonly virtualNodeTargets: Array<VirtualNodeTargets>;
  readonly gatewayRouteLabels: Record<string, string>;
}

// AppService is a construct that creates the AppMesh configuration for an application
// Consisting of a VirtualService, VirtualRouter, GatewayRoute and a dummy service for the app service to route traffic to.
export class AppService extends Construct {
  constructor(scope: Construct, id: string, props: AppServiceProps) {
    super(scope, id);

    const namespace = Chart.of(this).namespace;
    const commonLabels = {
      app: props.name,
      instance: props.instance,
    };

    /*
     * Create a dummy service for the app service to route traffic to.
     * this is because AppMesh at present doesnot register a DNS entry for the virtual service.
     */
    const service = new KubeService(this, "service", {
      metadata: {
        name: props.name,
        labels: commonLabels,
      },
      spec: {
        ports: [
          {
            port: props.port,
            name: "http",
          },
        ],
      },
    });

    /*
     * Create a VirtualRouter for the AppService.
     * This describes how traffic should be routed to the VirtualNodeTargets.
     * The VirtualRouter is the AppMesh representation of the Kubernetes Ingress routing.
     */
    const virtualRouter = new VirtualRouter(
      this,
      `${props.name}-virtual-router`,
      {
        metadata: {
          name: `${props.name}-router`,
          labels: commonLabels,
        },
        spec: {
          listeners: [
            {
              portMapping: {
                port: props.port,
                protocol: VirtualRouterSpecListenersPortMappingProtocol.HTTP,
              },
            },
          ],
          routes: [
            {
              name: `${props.name}-route`,
              httpRoute: {
                match: {
                  prefix: "/",
                },
                action: {
                  weightedTargets: props.virtualNodeTargets.map((service) => {
                    return {
                      virtualNodeRef: {
                        name: service.name,
                        namespace: service.namespace,
                      },
                      weight: service.weight,
                    };
                  }),
                },
              },
            },
          ],
        },
      },
    );

    /*
     * Create a VirtualService for the VirtualRouter.
     * This is the service that the GatewayRoute will route traffic to.
     * The VirtualService is the AppMesh representation of the Kubernetes Service.
     */
    const virtualService = new VirtualService(
      this,
      `${props.name}-virtual-service`,
      {
        metadata: {
          name: `${props.name}-virtual-service`,
          labels: commonLabels,
        },
        spec: {
          awsName: `${service.name}.${namespace}.svc.cluster.local`,
          provider: {
            virtualRouter: {
              virtualRouterRef: {
                name: virtualRouter.name,
              },
            },
          },
        },
      },
    );

    /*
     * Create a GatewayRoute for the VirtualService.
     * This routes traffic from the IngressGateway to the VirtualService based on the hostname.
     * The GatewayRoute is the AppMesh representation of the Kubernetes Ingress routing.
     */
    new GatewayRoute(this, `${props.name}-gateway-route`, {
      metadata: {
        name: `${props.name}-gateway-route`,
        labels: { ...commonLabels, ...props.gatewayRouteLabels },
      },
      spec: {
        httpRoute: {
          match: {
            hostname: {
              exact: props.hostname,
            },
          },
          action: {
            target: {
              virtualService: {
                virtualServiceRef: {
                  name: virtualService.name,
                },
              },
            },
          },
        },
      },
    });
  }
}
