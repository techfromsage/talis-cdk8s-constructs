import { Quantity } from "../../imports/k8s";

/**
 * Create a container that will wait on the availability of a host and TCP port.
 * Useful as an initContainer to wait for service dependencies.
 *
 * @param name Container name suffix (name of the service it will wait for).
 * @param host Host(s) or IP(s) under test.
 * @param port TCP port under test.
 */
export function makeWaitForPortContainer(
  name: string,
  host: string | string[],
  port: number,
) {
  const hosts = typeof host === "string" ? [host] : host;
  const command =
    `echo 'waiting for ${name}'; ` +
    hosts
      .map((host) => `until nc -vz -w1 ${host} ${port}; do sleep 1; done`)
      .join(" && ");

  return {
    name: `wait-for-${name}`,
    image: "busybox:1.36.1",
    command: ["/bin/sh", "-c", command],
    resources: {
      requests: {
        cpu: Quantity.fromString("10m"),
        memory: Quantity.fromString("50Mi"),
      },
      limits: {
        memory: Quantity.fromString("50Mi"),
      },
    },
  };
}
