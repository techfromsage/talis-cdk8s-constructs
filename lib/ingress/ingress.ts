import { Chart } from "cdk8s";
import { Construct } from "constructs";
import {
  IngressRule,
  IntOrString,
  KubeIngress,
  KubeService,
} from "../../imports/k8s";
import {
  convertToStringMap,
  convertToJsonContent,
  joinNameParts,
  convertToStringList,
} from "../common";
import { IngressProps } from ".";
import { ServiceSpecType } from "../k8s";

export class Ingress extends Construct {
  constructor(scope: Construct, id: string, props: IngressProps) {
    super(scope, id);
    this.validateProps(props);

    const chart = Chart.of(this);
    const environment = chart.labels.environment;
    const region = chart.labels.region;
    const service = joinNameParts([props.app, environment, region]);

    const labels: { [key: string]: string } = {
      ...chart.labels,
      ...props.labels,
      app: props.app,
      instance: props.instance,
      role: "server",
      service: service,
    };

    const externalDns: Record<string, string> = {};
    const ingressRules: IngressRule[] = [];
    const ingressListenPorts: Record<string, number>[] = [
      { HTTP: 80 },
      { HTTPS: 443 },
    ];
    const ingressTlsAnnotations: Record<string, string> = {};

    if (props.externalHostname) {
      externalDns["external-dns.alpha.kubernetes.io/hostname"] =
        props.externalHostname;
    }

    const targetGroups: Record<string, string | number>[] = [];
    for (const service of props.serviceRouting) {
      const serviceName = `${service.name}-${service.namespace}`;
      new KubeService(this, `${id}-${serviceName}-service`, {
        metadata: {
          name: serviceName,
          labels: labels,
        },
        spec: {
          type: ServiceSpecType.EXTERNAL_NAME,
          externalName: `${service.name}.${service.namespace}.svc.cluster.local`,
          ports: [
            {
              port: service.port,
              targetPort: IntOrString.fromNumber(service.port),
            },
          ],
        },
      });

      const targetGroup = {
        serviceName: serviceName,
        servicePort: service.port,
        weight: service.weight,
      };
      targetGroups.push(targetGroup);
    }

    const ingressAnnotations: { [key: string]: string } = {
      "alb.ingress.kubernetes.io/listen-ports":
        convertToJsonContent(ingressListenPorts),
      "alb.ingress.kubernetes.io/success-codes": "200,303",
      "alb.ingress.kubernetes.io/target-type": "instance",
      "alb.ingress.kubernetes.io/group.order": String(
        props.ingressClassPriority ?? 0,
      ),
      "alb.ingress.kubernetes.io/tags": convertToStringMap({
        service: labels.service,
        instance: id,
        environment: environment,
      }),
      "alb.ingress.kubernetes.io/actions.service-weighting":
        convertToJsonContent({
          type: "forward",
          forwardConfig: {
            targetGroups: targetGroups,
          },
        }),
      ...ingressTlsAnnotations,
      ...props.ingressAnnotations,
      ...externalDns,
    };

    if (props.certificateArn) {
      ingressAnnotations["alb.ingress.kubernetes.io/certificate-arn"] =
        convertToStringList(props.certificateArn);
    }

    for (const hostname of props.hostnames) {
      ingressRules.push({
        host: hostname,
        http: {
          paths: [
            {
              pathType: "Prefix",
              path: "/",
              backend: {
                service: {
                  name: "service-weighting",
                  port: {
                    name: "use-annotation",
                  },
                },
              },
            },
          ],
        },
      });
    }

    new KubeIngress(this, id, {
      metadata: {
        annotations: ingressAnnotations,
        labels: labels,
      },
      spec: {
        ingressClassName: props.ingressClassName,
        rules: ingressRules,
      },
    });
  }

  private validateProps(props: IngressProps): void {
    if (props.ingressClassPriority) {
      if (
        props.ingressClassPriority < -1000 ||
        props.ingressClassPriority > 1000
      ) {
        throw new Error(
          "Ingress class priority has to be between -1000 and 1000",
        );
      }
    }

    if (props.hostnames.length < 1) {
      throw new Error("At least one hostname has to be defined.");
    }

    if (props.serviceRouting.length < 1) {
      throw new Error("At least one service route has to be defined.");
    }

    const totalWeight = props.serviceRouting.reduce(
      (sum, serviceRoute) => sum + serviceRoute.weight,
      0,
    );
    if (totalWeight != 100) {
      throw new Error("Total service routing weigth must be 100.");
    }
  }
}
