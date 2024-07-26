import { Construct } from "constructs";
import { Mongo, TalisChart, TalisChartProps } from "../../lib";
import { Quantity } from "../../imports/k8s";

export class MongoChart extends TalisChart {
  constructor(scope: Construct, props: TalisChartProps) {
    super(scope, { app: "example-mongo-app", release: "test", ...props });

    new Mongo(this, "mongo-example", {
      release: "4.4.29",
      storageEngine: "wiredTiger",
      storageSize: Quantity.fromString("2Gi"),
    });
  }
}
