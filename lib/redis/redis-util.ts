export interface RedisConnectionDetailsInput {
  /**
   * Hostname of the Redis instance or DSN.
   */
  readonly host: string;

  /**
   * Port of the Redis instance.
   * @default 6379
   */
  readonly port?: string;

  /**
   * Database number of the Redis instance.
   * @default 0
   */
  readonly database?: string;
}

export interface RedisConnectionDetails extends RedisConnectionDetailsInput {
  readonly port: string;
  readonly database: string;
}

export function getRedisConnectionDetails(
  connection: RedisConnectionDetailsInput,
): RedisConnectionDetails {
  let { host, port, database } = connection;

  if (host.startsWith("redis://")) {
    const url = new URL(host);
    host = url.hostname;
    if (url.port) {
      port = url.port;
    }
    if (url.pathname && url.pathname.match(/^\/\d+/) !== null) {
      database = url.pathname.slice(1);
    }
  } else if (host.includes(":")) {
    const parts = host.split(":");
    host = parts[0];
    port = parts[1];
  }

  return {
    host: host,
    port: port || "6379",
    database: database || "0",
  };
}
