import { Chart } from "cdk8s";
import { Construct } from "constructs";
import {
  Container,
  IngressRule,
  IntOrString,
  KubeDeployment,
  KubeHorizontalPodAutoscalerV2Beta2,
  KubeIngress,
  KubeService,
  MetricSpecV2Beta2,
  Quantity,
  Volume,
} from "../../imports/k8s";
import {
  convertToJsonContent,
  convertToStringMap,
  HorizontalPodAutoscalerProps,
  NginxContainerProps,
  WebServiceProps,
} from ".";
import { defaultAffinity, makeLoadBalancerName } from "../common";
import { supportsTls } from "./tls-util";

export class WebService extends Construct {
  readonly service!: KubeService;
  readonly canaryService?: KubeService;
  readonly deployment!: KubeDeployment;
  readonly canaryDeployment?: KubeDeployment;
  readonly hpa?: KubeHorizontalPodAutoscalerV2Beta2;

  constructor(scope: Construct, id: string, props: WebServiceProps) {
    super(scope, id);
    this.validateProps(props);

    const hasProp = (key: string) =>
      Object.prototype.hasOwnProperty.call(props, key);
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

    const containers: Container[] = [
      {
        name: props.containerName ?? app ?? "app",
        image: props.image,
        imagePullPolicy: props.imagePullPolicy ?? "IfNotPresent",
        workingDir: props.workingDir,
        command: props.command,
        args: props.args,
        resources: props.resources,
        ports: [{ containerPort: applicationPort, protocol: "TCP" }],
        securityContext: props.securityContext,
        env: props.env,
        envFrom: props.envFrom,
        lifecycle: props.lifecycle,
        startupProbe: props.startupProbe,
        livenessProbe: props.livenessProbe,
        readinessProbe: props.readinessProbe,
        volumeMounts: props.volumeMounts,
      },
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
            "talis.io/eks-dashboard": props.eksDashboardUrl,
            "talis.io/graphs": props.graphsUrl,
            "talis.io/incidents": props.incidentsUrl,
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
          type: ingressTargetType === "instance" ? "NodePort" : "ClusterIP",
          ports: [
            {
              port: servicePort,
              targetPort: IntOrString.fromNumber(applicationPort),
              protocol: "TCP",
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

      const externalDns: Record<string, string> = {};
      const ingressRules: IngressRule[] = [];

      if (includeIngress) {
        const ingressTls = [];
        const ingressListenPorts: { [key: string]: number }[] = [{ HTTP: 80 }];
        const ingressTlsAnnotations: { [key: string]: string } = {};
        if (supportsTls(props)) {
          if (props.tlsDomain) {
            ingressTls.push({
              hosts: [props.tlsDomain],
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
            { ...instanceLabels, ...loadBalancerLabels }
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
          ...ingressTlsAnnotations,
          ...props.ingressAnnotations, // Allow overriding of annotations.
          ...externalDns,
        };
        this.validateLoadBalancerName(
          ingressAnnotations["alb.ingress.kubernetes.io/load-balancer-name"]
        );
        new KubeIngress(this, `${id}${instanceSuffix}-ingress`, {
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
              imagePullSecrets: props.imagePullSecrets,
              priorityClassName: props.priorityClassName ?? "web",
              terminationGracePeriodSeconds:
                props.terminationGracePeriodSeconds,
              initContainers: props.initContainers,
              containers: containers,
              hostAliases: props.hostAliases,
              volumes: volumes.length > 0 ? volumes : undefined,
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
          selectorLabels
        );
        if (skipLiveDeployment) {
          this.node.tryRemoveChild(this.hpa.node.id);
        }
      }
    }
  }

  validateProps(props: WebServiceProps): void {
    if (!props.horizontalPodAutoscaler && !props.replicas) {
      throw new Error(
        "Either horizontalPodAutoscaler or replicas must be specified"
      );
    }

    if (props.horizontalPodAutoscaler && props.replicas) {
      throw new Error(
        "Either horizontalPodAutoscaler or replicas can be specified, not both"
      );
    }

    if (props.canary && !props.stage) {
      throw new Error(
        "Release stage must be specified when canary deployments are enabled"
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
        "Either cpuTargetUtilization or memoryTargetUtilization must be specified to use a horizontalPodAutoscaler"
      );
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
        `Load balancer name must not exceed 32 characters. Given: ${name}`
      );
    }
  }

  createNginx(
    nginx: NginxContainerProps,
    nginxPort: number
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
      imagePullPolicy: nginx.imagePullPolicy ?? "IfNotPresent",
      resources: nginx.resources ?? {
        requests: {
          cpu: Quantity.fromString("50m"),
          memory: Quantity.fromString("32Mi"),
        },
        limits: {
          memory: Quantity.fromString("128Mi"),
        },
      },
      ports: [{ containerPort: nginxPort, protocol: "TCP" }],
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
    labels: { [key: string]: string }
  ) {
    const metrics: Array<MetricSpecV2Beta2> = [];

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

    return new KubeHorizontalPodAutoscalerV2Beta2(
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
      }
    );
  }
}
