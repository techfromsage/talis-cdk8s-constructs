import { Construct } from "constructs";
import { Memcached, TalisChart, TalisChartProps } from "../../lib";

export class MemcachedChart extends TalisChart {
  constructor(scope: Construct, props: TalisChartProps) {
    super(scope, { app: "example-memcached-app", ...props });

    new Memcached(this, "memcached-example", {
      release: "1.5.20",
    });
  }
}
