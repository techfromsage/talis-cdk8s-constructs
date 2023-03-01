import { Construct } from "constructs";
import { Redis, TalisChart, TalisChartProps } from "../../lib";

export class RedisChart extends TalisChart {
  constructor(scope: Construct, props: TalisChartProps) {
    super(scope, { app: "example-redis-app", release: "test", ...props });

    new Redis(this, "redis-example", {
      release: "5.0.7",
    });
  }
}
