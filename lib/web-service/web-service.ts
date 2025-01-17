import { Chart } from "cdk8s";
import { Construct } from "constructs";
import {
  Container,
  IngressRule,
  IngressTls,
  IntOrString,
  KubeDeployment,
  KubeHorizontalPodAutoscalerV2,
  KubeIngress,
  KubePodDisruptionBudget,
  KubeService,
  MetricSpecV2,
  Quantity,
  Volume,
} from "../../imports/k8s";
import {
  HttpRoute,
  HttpRouteSpecRules,
  HttpRouteSpecRulesMatchesPathType,
} from "../../imports/gateway.networking.k8s.io";
import {
  HorizontalPodAutoscalerProps,
  NginxContainerProps,
  PodDisruptionBudgetProps,
  WebServiceProps,
} from ".";
import {
  defaultAffinity,
  makeLoadBalancerName,
  ensureArray,
  getValueFromIntOrPercent,
  convertToJsonContent,
  convertToStringMap,
} from "../common";
import { supportsTls } from "./tls-util";
import {
  ContainerImagePullPolicy,
  PortProtocol,
  ServiceSpecType,
} from "../k8s";

export class WebService extends Construct {
  readonly service!: KubeService;
  readonly canaryService?: KubeService;
  readonly ingress!: KubeIngress;
  readonly canaryIngress?: KubeIngress;
  readonly deployment!: KubeDeployment;
  readonly canaryDeployment?: KubeDeployment;
  readonly hpa?: KubeHorizontalPodAutoscalerV2;
  readonly httpRoute?: HttpRoute;

  constructor(scope: Construct, id: string, props: WebServiceProps) {
    super(scope, id);
    this.validateProps(props);

    const hasProp = (key: string) =>
      Object.prototype.hasOwnProperty.call(props, key);
    const podDisruptionBudget = hasProp("podDisruptionBudget")
      ? props.podDisruptionBudget
      : { minAvailable: IntOrString.fromNumber(1) };
    if (podDisruptionBudget) {
      this.validatePodDisruptionBudget(podDisruptionBudget, props);
    }
    const chart = Chart.of(this);
    const namespace = chart.namespace;
    const internal = props.internal ?? false;
    const enableCanary = props.canary ?? false;
    const includeIngress = props.includeIngress ?? true;
    const stage = props.stage ?? "base";
    const ingressTargetType = props.ingressTargetType ?? "instance";
    const chartLabels = chart.labels;
    const app = chartLabels.app ?? props.selectorLabels?.app;
    const environment = chartLabels.environment;
    const labels = {
      ...chartLabels,
      release: props.release,
    };
    const affinityFunc = props.makeAffinity ?? defaultAffinity;

    const canaryReplicas = 1;

    const { applicationPort, servicePort, nginxPort } = this.findPorts(props);

    const includeHttpRoute = props.includeHttpRoute ?? false;
    const httpGateway = props.httpGateway ?? {
      name: "default-http-gateway",
      namespace: "app-ingress",
      sectionName: "http",
    };

    const containers: Container[] = [
      {
        name: props.containerName ?? app ?? "app",
        image: props.image,
        imagePullPolicy:
          props.imagePullPolicy ?? ContainerImagePullPolicy.IF_NOT_PRESENT,
        workingDir: props.workingDir,
        command: props.command,
        args: props.args,
        resources: props.resources,
        ports: [
          {
            containerPort: applicationPort,
            protocol: PortProtocol.TCP,
          },
        ],
        securityContext: props.securityContext,
        env: props.env,
        envFrom: props.envFrom,
        lifecycle: props.lifecycle,
        startupProbe: props.startupProbe,
        livenessProbe: props.livenessProbe,
        readinessProbe: props.readinessProbe,
        volumeMounts: props.volumeMounts,
      },
      ...(props.containers ?? []),
    ];

    const volumes: Volume[] = props.volumes ?? [];

    if (props.nginx && nginxPort) {
      const [container, volume] = this.createNginx(props.nginx, nginxPort);
      containers.push(container);
      volumes.push(volume);
    }

    // When canary releases are enabled, we will create two sets of deployments,
    // one for the canary and one for the live version.
    const instances = enableCanary ? ["", "-canary"] : [""];
    for (const instanceSuffix of instances) {
      const isCanaryInstance = instanceSuffix === "-canary";
      const selectorLabels: { [key: string]: string } = {
        app: app,
        role: "server",
        instance: id,
        ...props.selectorLabels,
      };
      const serviceLabels = { ...selectorLabels };

      // Include canary label if canary releases are enabled.
      if (enableCanary) {
        const canary = isCanaryInstance ? "true" : "false";
        selectorLabels.canary = canary;

        // Don't include it on live service during post-canary and full stage so that it serves both versions.
        if (isCanaryInstance || !["post-canary", "full"].includes(stage)) {
          serviceLabels.canary = canary;
        }
      }

      const instanceLabels: { [key: string]: string } = {
        ...labels,
        ...selectorLabels,
      };

      const service = new KubeService(this, `${id}${instanceSuffix}-service`, {
        metadata: {
          annotations: {
            "talis.io/chat": props.chatUrl,
            "talis.io/description": props.description,
            "talis.io/graphs": props.graphsUrl,
            "talis.io/issues": props.issuesUrl,
            "talis.io/logs": props.logsUrl,
            "talis.io/repository": props.repositoryUrl,
            "talis.io/runbook": props.runbookUrl,
            "talis.io/uptime": props.uptimeUrl,
            "talis.io/url": props.externalUrl,
          },
          labels: instanceLabels,
        },
        spec: {
          type:
            ingressTargetType === "instance"
              ? ServiceSpecType.NODE_PORT
              : ServiceSpecType.CLUSTER_IP,
          ports: [
            {
              port: servicePort,
              targetPort: IntOrString.fromNumber(servicePort),
              protocol: PortProtocol.TCP,
            },
          ],
          selector: serviceLabels,
        },
      });

      if (isCanaryInstance) {
        this.canaryService = service;
      } else {
        this.service = service;
      }

      if (includeIngress) {
        const externalDns: Record<string, string> = {};
        const ingressRules: IngressRule[] = [];
        const ingressTls: IngressTls[] = [];
        const ingressListenPorts: Record<string, number>[] = [{ HTTP: 80 }];
        const ingressTlsAnnotations: Record<string, string> = {};
        if (supportsTls(props)) {
          if (props.tlsDomain) {
            ingressTls.push({
              hosts: ensureArray(props.tlsDomain),
            });
          }
          ingressListenPorts.push({ HTTPS: 443 });
          ingressTlsAnnotations["alb.ingress.kubernetes.io/ssl-policy"] =
            "ELBSecurityPolicy-TLS-1-2-2017-01";
        }

        if (!isCanaryInstance) {
          if (props.externalHostname) {
            externalDns["external-dns.alpha.kubernetes.io/hostname"] =
              props.externalHostname;
          }

          for (const hostname of props.additionalExternalHostnames ?? []) {
            ingressRules.push({
              host: hostname,
              http: {
                paths: [
                  {
                    pathType: "Prefix",
                    path: "/",
                    backend: {
                      service: {
                        name: service.name,
                        port: {
                          number: servicePort,
                        },
                      },
                    },
                  },
                ],
              },
            });
          }
        }

        const loadBalancerNameFunc =
          props.makeLoadBalancerName ?? makeLoadBalancerName;
        const loadBalancerLabels = props.loadBalancerLabels ?? {};
        const ingressAnnotations = {
          "alb.ingress.kubernetes.io/load-balancer-name": loadBalancerNameFunc(
            namespace,
            { ...instanceLabels, ...loadBalancerLabels },
          ),
          "alb.ingress.kubernetes.io/load-balancer-attributes":
            convertToStringMap({
              "idle_timeout.timeout_seconds": "60",
            }),
          "alb.ingress.kubernetes.io/listen-ports":
            convertToJsonContent(ingressListenPorts),
          "alb.ingress.kubernetes.io/success-codes": "200,303",
          "alb.ingress.kubernetes.io/target-type": ingressTargetType,
          "alb.ingress.kubernetes.io/tags": convertToStringMap({
            service: instanceLabels.service ?? app,
            instance: id,
            environment: environment,
          }),
          "alb.ingress.kubernetes.io/actions.server-status-rule":
            convertToJsonContent({
              type: "fixed-response",
              fixedResponseConfig: {
                statusCode: "404",
                contentType: "text/plain",
                messageBody: "404: Not Found",
              },
            }),
          ...ingressTlsAnnotations,
          ...props.ingressAnnotations, // Allow overriding of annotations.
          ...externalDns,
        };
        this.validateLoadBalancerName(
          ingressAnnotations["alb.ingress.kubernetes.io/load-balancer-name"],
        );

        ingressRules.push({
          http: {
            paths: [
              {
                pathType: "Prefix",
                path: "/server-status",
                backend: {
                  service: {
                    name: "server-status-rule",
                    port: {
                      name: "use-annotation",
                    },
                  },
                },
              },
            ],
          },
        });

        const ingress = new KubeIngress(
          this,
          `${id}${instanceSuffix}-ingress`,
          {
            metadata: {
              annotations: ingressAnnotations,
              labels: instanceLabels,
            },
            spec: {
              ingressClassName: internal
                ? "aws-load-balancer-internal"
                : "aws-load-balancer-internet-facing",
              tls: ingressTls.length > 0 ? ingressTls : undefined,
              defaultBackend: {
                service: {
                  name: service.name,
                  port: {
                    number: servicePort,
                  },
                },
              },
              rules: ingressRules.length > 0 ? ingressRules : undefined,
            },
          },
        );

        if (isCanaryInstance) {
          this.canaryIngress = ingress;
        } else {
          this.ingress = ingress;
        }
      }

      if (includeHttpRoute) {
        let hostnames: Array<string> = [];

        if (props.externalHostname) {
          hostnames.push(props.externalHostname);
        }

        if (props.additionalExternalHostnames) {
          hostnames = hostnames.concat(props.additionalExternalHostnames);
        }

        const defaultServiceBackend = {
          group: "", // Empty string means the core kubernetes API group
          kind: "Service", // Service is only supported backend kind
          name: service.name,
          namespace: namespace,
          port: servicePort,
          // weight is a percentage of traffic to send to the backend service
          // this is calculated by adding up all the weights and dividing by the individual weight
          weight: 1,
        };

        const defaultTrafficRule: HttpRouteSpecRules = {
          backendRefs: [defaultServiceBackend],
          matches: [
            {
              // Match all paths and redirect to the backend services
              path: {
                type: HttpRouteSpecRulesMatchesPathType.PATH_PREFIX,
                value: "/",
              },
            },
          ],
          timeouts: {
            request: "30s",
          },
        };

        const rules: HttpRouteSpecRules[] = [defaultTrafficRule];

        this.httpRoute = new HttpRoute(this, `http-route-${id}-http`, {
          metadata: {
            name: `http-route-${id}-http`,
            labels: instanceLabels,
          },
          spec: {
            parentRefs: [
              {
                name: httpGateway.name,
                namespace: httpGateway.namespace,
                sectionName: httpGateway.sectionName ?? "http",
              },
            ],
            hostnames: hostnames,
            rules: rules,
          },
        });
      }

      const deployment = new KubeDeployment(this, `${id}${instanceSuffix}`, {
        metadata: {
          labels: instanceLabels,
        },
        spec: {
          replicas: isCanaryInstance ? canaryReplicas : props.replicas,
          revisionHistoryLimit: props.revisionHistoryLimit ?? 1,
          selector: {
            matchLabels: selectorLabels,
          },
          template: {
            metadata: {
              labels: {
                ...labels, // chart labels are not applied to the Pod so we need to add them here
                ...selectorLabels,
              },
            },
            spec: {
              affinity: hasProp("affinity")
                ? props.affinity
                : affinityFunc(selectorLabels),
              automountServiceAccountToken:
                props.automountServiceAccountToken ?? false,
              dnsConfig: props.dnsConfig,
              dnsPolicy: props.dnsPolicy,
              enableServiceLinks: props.enableServiceLinks,
              hostAliases: props.hostAliases,
              imagePullSecrets: props.imagePullSecrets,
              preemptionPolicy: props.preemptionPolicy,
              priorityClassName: props.priorityClassName ?? "web",
              serviceAccountName: props.serviceAccountName,
              setHostnameAsFqdn: props.setHostnameAsFqdn,
              shareProcessNamespace: props.shareProcessNamespace,
              subdomain: props.subdomain,
              terminationGracePeriodSeconds:
                props.terminationGracePeriodSeconds,
              tolerations: props.tolerations,
              volumes: volumes.length > 0 ? volumes : undefined,
              securityContext: props.podSecurityContext,
              initContainers: props.initContainers,
              containers: containers,
            },
          },
        },
      });

      if (isCanaryInstance) {
        this.canaryDeployment = deployment;
      } else {
        this.deployment = deployment;
      }

      // Don't include the live deployment during canary stages.
      const skipLiveDeployment =
        !isCanaryInstance && ["canary", "post-canary"].includes(stage);

      if (skipLiveDeployment) {
        this.node.tryRemoveChild(deployment.node.id);
      }

      if (!isCanaryInstance && props.horizontalPodAutoscaler) {
        this.hpa = this.addHorizontalPodAutoscaler(
          deployment,
          props.horizontalPodAutoscaler,
          selectorLabels,
        );
        if (skipLiveDeployment) {
          this.node.tryRemoveChild(this.hpa.node.id);
        }
      }

      if (!isCanaryInstance && podDisruptionBudget) {
        this.addPodDisruptionBudget(
          deployment,
          podDisruptionBudget,
          selectorLabels,
        );
      }
    }
  }

  private validateProps(props: WebServiceProps): void {
    if (!props.horizontalPodAutoscaler && !props.replicas) {
      throw new Error(
        "Either horizontalPodAutoscaler or replicas must be specified",
      );
    }

    if (props.horizontalPodAutoscaler && props.replicas) {
      throw new Error(
        "Either horizontalPodAutoscaler or replicas can be specified, not both",
      );
    }

    if (props.canary && !props.stage) {
      throw new Error(
        "Release stage must be specified when canary deployments are enabled",
      );
    }

    if (
      props.horizontalPodAutoscaler &&
      !(
        props.horizontalPodAutoscaler.cpuTargetUtilization ||
        props.horizontalPodAutoscaler.memoryTargetUtilization
      )
    ) {
      throw new Error(
        "Either cpuTargetUtilization or memoryTargetUtilization must be specified to use a horizontalPodAutoscaler",
      );
    }

    if (props.includeHttpRoute && !props.httpGateway) {
      throw new Error(
        "Http Gateway must be specified when includeHttpRoute is enabled",
      );
    }
  }

  private validatePodDisruptionBudget(
    podDisruptionBudget: PodDisruptionBudgetProps,
    props: WebServiceProps,
  ): void {
    const { minAvailable, maxUnavailable } = podDisruptionBudget;

    if (!minAvailable && !maxUnavailable) {
      throw new Error(
        "Either minAvailable or maxUnavailable must be specified",
      );
    }

    if (minAvailable && maxUnavailable) {
      throw new Error(
        "Either minAvailable or maxUnavailable can be specified, not both",
      );
    }

    const minReplicas =
      props.horizontalPodAutoscaler?.minReplicas ?? (props.replicas as number);

    if (minReplicas < 2) {
      throw new Error(
        `Minimum number of replicas to use PodDisruptionBudget must be 2 or more. Given: ${minReplicas}`,
      );
    }

    if (minAvailable) {
      const min = getValueFromIntOrPercent(minAvailable, minReplicas);
      if (min <= 0) {
        throw new Error(
          `podDisruptionBudget.minAvailable (${min}) must be greater than 0 to prevent downtime`,
        );
      }
      if (min >= minReplicas) {
        throw new Error(
          `podDisruptionBudget.minAvailable (${min}) must be lower than minimum number of desired replicas (${minReplicas}) to allow voluntary evictions`,
        );
      }
    }

    if (maxUnavailable) {
      const max = getValueFromIntOrPercent(maxUnavailable, minReplicas);
      if (max <= 0) {
        throw new Error(
          `podDisruptionBudget.maxUnavailable (${max}) must be greater than 0 to allow voluntary evictions`,
        );
      }
      if (max >= minReplicas) {
        throw new Error(
          `podDisruptionBudget.maxUnavailable (${max}) must be lower than minimum number of desired replicas (${minReplicas}) to prevent downtime`,
        );
      }
    }
  }

  findPorts(props: WebServiceProps): {
    applicationPort: number;
    servicePort: number;
    nginxPort?: number;
  } {
    const applicationPort = props.port ?? 3000;
    let nginxPort = props.nginx?.port;
    let servicePort = applicationPort;

    // If nginx is enabled but port isn't set, set the default
    if (props.nginx && !nginxPort) {
      nginxPort = 80;
    }

    // Application and nginx ports must be different
    if (applicationPort === nginxPort) {
      throw new Error("Application and nginx ports must be different");
    }

    // If nginx is enabled then the service must listen on the nginx port
    if (nginxPort) {
      servicePort = nginxPort;
    }

    return { applicationPort, servicePort, nginxPort };
  }

  validateLoadBalancerName(name: string): void {
    if (name.length < 1) {
      throw new Error("Load balancer name must not be empty");
    }
    if (name.length > 32) {
      throw new Error(
        `Load balancer name must not exceed 32 characters. Given: ${name}`,
      );
    }
  }

  createNginx(
    nginx: NginxContainerProps,
    nginxPort: number,
  ): [Container, Volume] {
    const volume: Volume = {
      name: "nginx-config",
      configMap: {
        name: nginx.configMap,
        defaultMode: parseInt("0444", 8),
      },
    };

    const container: Container = {
      name: "nginx",
      image: nginx.image ?? "public.ecr.aws/nginx/nginx:1.21.5",
      imagePullPolicy:
        nginx.imagePullPolicy ?? ContainerImagePullPolicy.IF_NOT_PRESENT,
      resources: nginx.resources ?? {
        requests: {
          cpu: Quantity.fromString("50m"),
          memory: Quantity.fromString("32Mi"),
        },
        limits: {
          memory: Quantity.fromString("128Mi"),
        },
      },
      ports: [
        {
          containerPort: nginxPort,
          protocol: PortProtocol.TCP,
        },
      ],
      startupProbe: nginx.startupProbe,
      livenessProbe: nginx.livenessProbe ?? {
        failureThreshold: 3,
        httpGet: {
          path: "/livez",
          port: IntOrString.fromNumber(nginxPort),
        },
        initialDelaySeconds: 0,
        periodSeconds: 10,
        successThreshold: 1,
        timeoutSeconds: 2,
      },
      readinessProbe: nginx.readinessProbe ?? {
        failureThreshold: 2,
        httpGet: {
          path: "/livez",
          port: IntOrString.fromNumber(nginxPort),
        },
        initialDelaySeconds: 0,
        periodSeconds: 30,
        successThreshold: 1,
        timeoutSeconds: 10,
      },
      volumeMounts: [
        {
          mountPath: "/etc/nginx/conf.d",
          name: "nginx-config",
          readOnly: true,
        },
      ],
    };

    return [container, volume];
  }

  addHorizontalPodAutoscaler(
    deployment: KubeDeployment,
    props: HorizontalPodAutoscalerProps,
    labels: { [key: string]: string },
  ) {
    const metrics: Array<MetricSpecV2> = [];

    if (props.cpuTargetUtilization) {
      metrics.push({
        type: "Resource",
        resource: {
          name: "cpu",
          target: {
            type: "Utilization",
            averageUtilization: props.cpuTargetUtilization,
          },
        },
      });
    }

    if (props.memoryTargetUtilization) {
      metrics.push({
        type: "Resource",
        resource: {
          name: "memory",
          target: {
            type: "Utilization",
            averageUtilization: props.memoryTargetUtilization,
          },
        },
      });
    }

    return new KubeHorizontalPodAutoscalerV2(
      this,
      `${deployment.node.id}-hpa`,
      {
        metadata: {
          labels,
        },
        spec: {
          scaleTargetRef: {
            apiVersion: deployment.apiVersion,
            kind: deployment.kind,
            name: deployment.name,
          },
          minReplicas: props.minReplicas,
          maxReplicas: props.maxReplicas,
          metrics: metrics,
        },
      },
    );
  }

  addPodDisruptionBudget(
    deployment: KubeDeployment,
    props: PodDisruptionBudgetProps,
    labels: { [key: string]: string },
  ) {
    new KubePodDisruptionBudget(this, `${deployment.node.id}-pdb`, {
      metadata: {
        labels,
      },
      spec: {
        minAvailable: props.minAvailable,
        maxUnavailable: props.maxUnavailable,
        selector: {
          matchLabels: labels,
        },
      },
    });
  }
}
