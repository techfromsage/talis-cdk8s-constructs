import { Chart } from "cdk8s";
import { Construct } from "constructs";
import {
  Container,
  IntOrString,
  KubeDeployment,
  KubeHorizontalPodAutoscalerV2Beta2,
  KubeIngress,
  KubeService,
  Quantity,
  Volume,
} from "../../imports/k8s";
import {
  HorizontalPodAutoscalerProps,
  WebServiceProps,
  NginxContainerProps,
} from ".";

export class WebService extends Construct {
  constructor(scope: Construct, id: string, props: WebServiceProps) {
    super(scope, id);
    this.validateProps(props);

    const chart = Chart.of(this);
    const app = chart.labels.app;
    const environment = chart.labels.environment;
    const internal = props.internal ?? false;
    const enableCanary = props.canary ?? false;
    const stage = props.stage ?? "base";
    const ingressTargetType = props.ingressTargetType ?? "instance";
    const chartLabels: { app?: string; environment?: string; region?: string } =
      chart.labels;
    const labels = {
      ...chartLabels,
      release: props.release,
    };

    const { applicationPort, servicePort, nginxPort } = this.findPorts(props);

    const containers: Container[] = [
      {
        name: app,
        image: props.image,
        imagePullPolicy: "IfNotPresent",
        workingDir: props.workingDir,
        command: props.command,
        args: props.args,
        resources: props.resources,
        ports: [{ containerPort: applicationPort, protocol: "TCP" }],
        env: props.env,
        envFrom: props.envFrom,
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
        app,
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

      const instanceLabels = { ...labels, ...selectorLabels };

      const service = new KubeService(this, `service${instanceSuffix}`, {
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

      const ingressTls = [];
      if (props.tslDomain) {
        ingressTls.push({
          hosts: [props.tslDomain],
        });
      }

      new KubeIngress(this, `ingress${instanceSuffix}`, {
        metadata: {
          annotations: {
            "alb.ingress.kubernetes.io/load-balancer-name":
              this.makeLoadBalancerName(id, isCanaryInstance, labels),
            "alb.ingress.kubernetes.io/load-balancer-attributes":
              "idle_timeout.timeout_seconds=60",
            "alb.ingress.kubernetes.io/listen-ports": JSON.stringify([
              { HTTP: 80 },
              { HTTPS: 443 },
            ]),
            "alb.ingress.kubernetes.io/ssl-policy":
              "ELBSecurityPolicy-TLS-1-2-2017-01",
            "alb.ingress.kubernetes.io/success-codes": "200,303",
            "alb.ingress.kubernetes.io/target-type": ingressTargetType,
            "alb.ingress.kubernetes.io/tags": this.toKeyValueString({
              service: app,
              instance: id,
              environment: environment,
            }),
            ...props.ingressAnnotations, // Allow overriding of annotations.
          },
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
        },
      });

      // Don't include the live deployment during canary stages.
      if (!isCanaryInstance && ["canary", "post-canary"].includes(stage)) {
        continue;
      }

      const deployment = new KubeDeployment(
        this,
        `deployment${instanceSuffix}`,
        {
          metadata: {
            labels: instanceLabels,
          },
          spec: {
            replicas: isCanaryInstance ? 1 : props.replicas,
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
                affinity: props.affinity ?? {
                  podAntiAffinity: {
                    preferredDuringSchedulingIgnoredDuringExecution: [
                      {
                        podAffinityTerm: {
                          labelSelector: {
                            matchLabels: selectorLabels,
                          },
                          topologyKey: "topology.kubernetes.io/zone",
                        },
                        weight: 100,
                      },
                    ],
                  },
                },
                automountServiceAccountToken:
                  props.automountServiceAccountToken ?? false,
                imagePullSecrets: props.imagePullSecrets,
                priorityClassName: props.priorityClassName ?? "web",
                containers,
                volumes: volumes.length > 0 ? volumes : undefined,
              },
            },
          },
        }
      );

      if (!isCanaryInstance && props.horizontalPodAutoscaler) {
        this.addHorizontalPodAutoscaler(
          deployment,
          props.horizontalPodAutoscaler,
          selectorLabels
        );
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

  makeLoadBalancerName(
    id: string,
    isCanaryInstance: boolean,
    labels: { app?: string; environment?: string; region?: string }
  ): string {
    const { app, environment, region } = labels;
    const canary = isCanaryInstance ? "c" : null;
    const name = [app, id, canary, environment, region]
      .filter(Boolean)
      .join("-");

    if (name.length > 32) {
      throw new Error(
        `Load balancer name must not exceed 32 characters. Given: ${name}`
      );
    }

    return name;
  }

  toKeyValueString(obj: { [key: string]: string }): string {
    return Object.entries(obj)
      .filter(([, value]) => value)
      .map(([key, value]) => `${key}=${value}`)
      .join(",");
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
      imagePullPolicy: "IfNotPresent",
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
  ): void {
    new KubeHorizontalPodAutoscalerV2Beta2(this, "hpa", {
      metadata: {
        labels,
      },
      spec: {
        scaleTargetRef: {
          apiVersion: deployment.apiGroup + "/" + deployment.apiVersion,
          kind: deployment.kind,
          name: deployment.name,
        },
        minReplicas: props.minReplicas,
        maxReplicas: props.maxReplicas,
        metrics: [
          {
            type: "Resource",
            resource: {
              name: "cpu",
              target: {
                type: "Utilization",
                averageUtilization: props.cpuTargetUtilization,
              },
            },
          },
        ],
      },
    });
  }
}
