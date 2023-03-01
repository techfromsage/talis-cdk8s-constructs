import { Construct } from "constructs";
import { ConfigMap, Postgres, TalisChart, TalisChartProps } from "../../lib";

export class PostgresChart extends TalisChart {
  constructor(scope: Construct, props: TalisChartProps) {
    super(scope, { app: "example-postgres-app", release: "test", ...props });

    const initConfig = new ConfigMap(this, "postgres-init", {
      data: {
        "create-schema.sql": `CREATE TABLE sample(
          id uuid,
          name varchar(64),
          creation_date date
        );`,
      },
    });

    new Postgres(this, "postgres-example", {
      release: "9.5",
      env: [
        {
          name: "POSTGRES_PASSWORD",
          value: "secret",
        },
        {
          name: "POSTGRES_USER",
          value: "appuser",
        },
        {
          name: "POSTGRES_DB",
          value: "mypostgresdb",
        },
      ],
      volumes: [
        {
          name: "initdb",
          configMap: {
            name: initConfig.name,
          },
        },
      ],
      volumeMounts: [
        {
          name: "initdb",
          mountPath: "/docker-entrypoint-initdb.d",
        },
      ],
    });
  }
}
