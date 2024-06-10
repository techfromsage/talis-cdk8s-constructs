import { Construct } from "constructs";
import {
  VirtualGateway,
  VirtualGatewaySpecListenersPortMappingProtocol,
} from "../../imports/appmesh.k8s.aws";
import {
  IntOrString,
  KubeDeployment,
  KubeHorizontalPodAutoscaler,
  KubeService,
  KubeServiceAccount,
} from "../../imports/k8s";

export interface IngressGatewayNlbProps {
  readonly gatewayName: string;
  readonly tlsCertificateArn: string;
  readonly ingressRoleArn: string;
  readonly public?: boolean;
  readonly gatewayMinReplicas?: number;
  readonly gatewayMaxReplicas?: number;
  readonly gatewayHpaAverageCpuUtilization?: number;
  readonly envoyRepository?: string;
  readonly envoyVersion?: string;
}

export class IngressGatewayNlb extends Construct {
  gatewayName: string;

  constructor(scope: Construct, id: string, props: IngressGatewayNlbProps) {
    super(scope, id);

    this.gatewayName = props.gatewayName;

    this.validateProps(props);

    const envoyRepository =
      props.envoyRepository ?? "public.ecr.aws/appmesh/aws-appmesh-envoy";
    const envoyVersion = props.envoyVersion ?? "v1.29.4.0-prod";

    // Create a service account for the gateway
    const serviceAccount = new KubeServiceAccount(
      this,
      "ingress-gateway-service-account",
      {
        metadata: {
          name: "ingress-gateway-" + props.gatewayName,
          annotations: {
            "eks.amazonaws.com/role-arn": props.ingressRoleArn,
          },
        },
      },
    );

    // Create a VirtualGateway to route traffic to gateway pods
    new VirtualGateway(this, "ingress-gateway-virtual-gateway", {
      metadata: {
        name: "ingress-gateway-" + props.gatewayName,
      },
      spec: {
        // Only allow gateway routes to be defined in namespaces with this label
        namespaceSelector: {
          matchLabels: {
            "aws.tfs.engineering/appMeshIngress": "enabled",
          },
        },
        // Pods with this label will be considered as gateways
        podSelector: {
          matchLabels: this.getPodSelectorLabels(),
        },
        // Gateway routes with this label will be associated to this gateway
        gatewayRouteSelector: {
          matchLabels: this.getGatewayRouteSelectorLabels(),
        },
        // Gateway pods listen on port 8088
        listeners: [
          {
            portMapping: {
              port: 8088,
              protocol: VirtualGatewaySpecListenersPortMappingProtocol.HTTP,
            },
          },
        ],
      },
    });

    const ingressGatewayHttpAdminPort = 9901;
    const ingressGatewayHttpPort = 8088;

    // Create a deployment for the gateway
    const deployment = new KubeDeployment(this, "ingress-gateway-deployment", {
      metadata: {
        name: "ingress-gateway-" + props.gatewayName,
      },
      spec: {
        strategy: {
          type: "RollingUpdate",
          rollingUpdate: {
            maxUnavailable: IntOrString.fromString("25%"),
          },
        },
        selector: {
          matchLabels: this.getPodSelectorLabels(),
        },
        template: {
          metadata: {
            labels: this.getPodSelectorLabels(),
          },
          spec: {
            serviceAccountName: serviceAccount.name,
            terminationGracePeriodSeconds: 30,
            affinity: {
              podAntiAffinity: {
                preferredDuringSchedulingIgnoredDuringExecution: [
                  {
                    weight: 100,
                    podAffinityTerm: {
                      labelSelector: {
                        matchLabels: this.getPodSelectorLabels(),
                      },
                      topologyKey: "kubernetes.io/hostname",
                    },
                  },
                ],
              },
            },
            containers: [
              {
                name: "envoy",
                image: `${envoyRepository}:${envoyVersion}`,
                imagePullPolicy: "Always",
                ports: [
                  {
                    containerPort: ingressGatewayHttpPort,
                    name: "http",
                    protocol: "TCP",
                  },
                  {
                    containerPort: ingressGatewayHttpAdminPort,
                    name: "http-admin",
                    protocol: "TCP",
                  },
                ],
                livenessProbe: {
                  exec: {
                    command: [
                      "sh",
                      "-c",
                      `curl -s http://localhost:${ingressGatewayHttpAdminPort}/server_info | grep state | grep -q LIVE`,
                    ],
                  },
                },
                readinessProbe: {
                  initialDelaySeconds: 5,
                  tcpSocket: {
                    port: IntOrString.fromNumber(ingressGatewayHttpAdminPort),
                  },
                },
                resources: {
                  requests: {
                    cpu: IntOrString.fromString("100m"),
                    memory: IntOrString.fromString("64Mi"),
                  },
                  limits: {
                    cpu: IntOrString.fromString("1000m"),
                    memory: IntOrString.fromString("1Gi"),
                  },
                },
              },
            ],
          },
        },
      },
    });

    // Create HPA for the gateway deployment
    new KubeHorizontalPodAutoscaler(this, "ingress-gateway-hpa", {
      metadata: {
        name: "ingress-gateway-" + props.gatewayName,
      },
      spec: {
        scaleTargetRef: {
          apiVersion: deployment.apiVersion,
          kind: deployment.kind,
          name: deployment.name,
        },
        minReplicas: props.gatewayMinReplicas ?? 2,
        maxReplicas: props.gatewayMaxReplicas ?? 10,
        targetCpuUtilizationPercentage:
          props.gatewayHpaAverageCpuUtilization ?? 80,
      },
    });

    // Create a service of type LoadBalancer to expose the gateway
    // This is useful when the gateway is deployed in a private subnet
    // and needs to be accessed from outside the cluster
    // AWS LoadBalancer Controller will discover it
    // and create a corresponding AWS NLB
    new KubeService(this, "ingress-gateway-service", {
      metadata: {
        name: "ingress-gateway-" + props.gatewayName,
        labels: {
          "aws.tfs.engineering/appMeshGateway": this.gatewayName,
        },
        annotations: {
          "service.beta.kubernetes.io/aws-load-balancer-type": "nlb",
          "service.beta.kubernetes.io/aws-load-balancer-scheme": props.public
            ? "internet-facing"
            : "internal",
          "service.beta.kubernetes.io/aws-load-balancer-cross-zone-load-balancing-enabled":
            "true",
          "service.beta.kubernetes.io/aws-load-balancer-ssl-cert":
            props.tlsCertificateArn,
          "service.beta.kubernetes.io/aws-load-balancer-ssl-ports": "https",
        },
      },
      spec: {
        type: "LoadBalancer",
        externalTrafficPolicy: "Local",
        selector: this.getPodSelectorLabels(),
        ports: [
          {
            port: 80,
            targetPort: IntOrString.fromNumber(ingressGatewayHttpPort),
            name: "http",
          },
          {
            port: 443,
            targetPort: IntOrString.fromNumber(ingressGatewayHttpAdminPort),
            name: "https",
          },
        ],
      },
    });
  }

  // These labels are used to identify gateway pods
  private getPodSelectorLabels(): Record<string, string> {
    return {
      "aws.tfs.engineering/appMeshGateway": this.gatewayName,
    };
  }

  // These labels are used to associate gateway routes to this gateway
  public getGatewayRouteSelectorLabels(): Record<string, string> {
    return {
      "aws.tfs.engineering/appMeshGateway": this.gatewayName,
    };
  }

  private validateProps(props: IngressGatewayNlbProps) {
    if (
      props.gatewayMinReplicas !== undefined &&
      props.gatewayMinReplicas < 2
    ) {
      throw new Error("gatewayMinReplicas must be at least 2");
    }
    if (
      props.gatewayMaxReplicas !== undefined &&
      props.gatewayMaxReplicas < 2
    ) {
      throw new Error("gatewayMaxReplicas must be at least 2");
    }
    if (
      props.gatewayMinReplicas !== undefined &&
      props.gatewayMaxReplicas !== undefined &&
      props.gatewayMinReplicas > props.gatewayMaxReplicas
    ) {
      throw new Error(
        "gatewayMinReplicas must be less than gatewayMaxReplicas",
      );
    }
  }
}
