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
  readonly appName: string;
  readonly appPort: number;
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

    /*
     * Create a dummy service for the app service to route traffic to.
     * this is because AppMesh at present doesnot register a DNS entry for the virtual service.
     */
    const service = new KubeService(this, "service", {
      metadata: {
        name: props.appName,
      },
      spec: {
        ports: [
          {
            port: props.appPort,
            name: "http",
          },
        ],
      },
    });

    const virtualRouter = new VirtualRouter(this, "virtual-router", {
      metadata: {
        name: `${props.appName}-router`,
      },
      spec: {
        listeners: [
          {
            portMapping: {
              port: props.appPort,
              protocol: VirtualRouterSpecListenersPortMappingProtocol.HTTP,
            },
          },
        ],
        routes: [
          {
            name: `${props.appName}-route`,
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
    });

    const virtualService = new VirtualService(this, "virtual-service", {
      metadata: {
        name: `${props.appName}-virtual-service`,
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
    });

    new GatewayRoute(this, "gateway-route", {
      metadata: {
        name: `${props.appName}-gateway-route`,
        labels: props.gatewayRouteLabels,
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
