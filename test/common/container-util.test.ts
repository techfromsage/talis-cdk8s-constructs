import { makeWaitForPortContainer } from "../../lib";

describe("container-util", () => {
  describe("makeWaitForPortContainer", () => {
    test("Creates a container that waits for a single host and port", () => {
      expect(makeWaitForPortContainer("single", "test.example.com", 4321))
        .toMatchInlineSnapshot(`
        {
          "command": [
            "/bin/sh",
            "-c",
            "echo 'waiting for single'; until nc -vz -w1 test.example.com 4321; do sleep 1; done",
          ],
          "image": "busybox:1.36.1",
          "name": "wait-for-single",
          "resources": {
            "limits": {
              "memory": Quantity {
                "value": "50Mi",
              },
            },
            "requests": {
              "cpu": Quantity {
                "value": "10m",
              },
              "memory": Quantity {
                "value": "50Mi",
              },
            },
          },
        }
      `);
    });

    test("Creates a container that waits for a multiple hosts", () => {
      expect(makeWaitForPortContainer("multi", ["host1", "host2"], 5678))
        .toMatchInlineSnapshot(`
        {
          "command": [
            "/bin/sh",
            "-c",
            "echo 'waiting for multi'; until nc -vz -w1 host1 5678; do sleep 1; done && until nc -vz -w1 host2 5678; do sleep 1; done",
          ],
          "image": "busybox:1.36.1",
          "name": "wait-for-multi",
          "resources": {
            "limits": {
              "memory": Quantity {
                "value": "50Mi",
              },
            },
            "requests": {
              "cpu": Quantity {
                "value": "10m",
              },
              "memory": Quantity {
                "value": "50Mi",
              },
            },
          },
        }
      `);
    });
  });
});
