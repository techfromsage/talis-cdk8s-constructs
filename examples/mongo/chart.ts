import { Construct } from "constructs";
import { Mongo, TalisChart, TalisChartProps } from "../../lib";

export class MongoChart extends TalisChart {
  constructor(scope: Construct, props: TalisChartProps) {
    super(scope, { app: "example-mongo-app", release: "test", ...props });

    new Mongo(this, "redis-example", {
      release: "3.2.8",
    });
  }
}
