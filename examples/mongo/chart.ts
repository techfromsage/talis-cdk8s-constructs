import { Construct } from "constructs";
import { Mongo, TalisChart, TalisChartProps } from "../../lib";

export class MongoChart extends TalisChart {
  constructor(scope: Construct, props: TalisChartProps) {
    super(scope, { app: "example-mongo-app", ...props });

    new Mongo(this, "redis-example", {
      release: "v1.0",
    });
  }
}
