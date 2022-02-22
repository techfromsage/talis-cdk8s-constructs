import { Construct } from "constructs";
import { ApiObject, Chart, ChartProps } from "cdk8s";
import { KubeNamespace } from "../../imports/k8s";
import { joinNameParts } from "../common";
import { TalisShortRegion } from "./talis-region";
import { TalisDeploymentEnvironment } from "./talis-deployment-environment";

export interface TalisChartProps extends ChartProps {
  /** Name of the application this chart is for */
  readonly app?: string;
  /** Environment that this application is deployed in */
  readonly environment:TalisDeploymentEnvironment;
  /** Short region code */
  readonly region: TalisShortRegion;
  /** An identifier, will be appended to the namespace */
  readonly watermark: string;
}

/** @private */
interface TalisChartConstructorProps extends TalisChartProps {
  readonly app: string;
}

export class TalisChart extends Chart {
  /** Name of the application this chart is for */
  public readonly app: string;
  /** The namespace for all objects in this chart. */
  public readonly namespace: string;
  /** The namespace API object */
  public readonly kubeNamespace: KubeNamespace;

  constructor(scope: Construct, props: TalisChartConstructorProps) {
    const { app, environment, region, watermark } = props;
    const maybeEnvironment = environment !== TalisDeploymentEnvironment.PRODUCTION ? environment : "";
    const maybeWatermark = environment === TalisDeploymentEnvironment.ONDEMAND ? watermark : "";
    const namespace = props.namespace ?? joinNameParts([app, watermark]);
    const id = `${namespace}-${environment}-${region}`;

    super(scope, id, {
      namespace: namespace,
      labels: {
        app: app,
        environment: environment,
        region: region,
        "managed-by": "cdk8s",
        service: joinNameParts([app, maybeWatermark, maybeEnvironment, region]),
        ...props.labels,
      },
    });

    this.app = app;
    this.namespace = namespace;
    this.kubeNamespace = new KubeNamespace(this, "namespace", {
      metadata: { name: this.namespace },
    });
  }

  generateObjectName(apiObject: ApiObject): string {
    return apiObject.node.id;
  }
}
