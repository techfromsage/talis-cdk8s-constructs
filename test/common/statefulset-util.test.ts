import { Construct } from "constructs";
import { KubeService, KubeStatefulSet } from "../../imports/k8s";
import {
  DnsAwareStatefulSet,
  getDnsName,
} from "../../lib/common/statefulset-util";
import { makeChart } from "../test-util";

class MyStatefulSet extends Construct implements DnsAwareStatefulSet {
  readonly service: KubeService;
  readonly statefulSet: KubeStatefulSet;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    this.service = new KubeService(this, id, {});
    this.statefulSet = new KubeStatefulSet(this, `${id}-sts`, {});
  }

  public getDnsName(replica = 0): string {
    // We're not testing the method but the function here
    return `dummy-${replica}`;
  }
}

describe("statefulset-util", () => {
  describe("getDnsName", () => {
    test("Builds a DNS name for the first Pod by default", () => {
      const chart = makeChart();
      const statefulSet = new MyStatefulSet(chart, "sts-test");
      expect(getDnsName(statefulSet)).toBe("sts-test-sts-0.sts-test");
    });

    test("Builds a full DNS name if chart knows its namespace", () => {
      const chart = makeChart({ namespace: "test-ns" });
      const statefulSet = new MyStatefulSet(chart, "sts-test");
      expect(getDnsName(statefulSet)).toBe(
        "sts-test-sts-0.sts-test.test-ns.svc.cluster.local",
      );
    });

    const tests: [number, string][] = [
      [0, "sts-test-sts-0.sts-test"],
      [1, "sts-test-sts-1.sts-test"],
      [3, "sts-test-sts-3.sts-test"],
    ];
    tests.forEach(([replica, expected]) => {
      test("Builds a string from non-empty parts", () => {
        const chart = makeChart();
        const statefulSet = new MyStatefulSet(chart, "sts-test");
        expect(getDnsName(statefulSet, replica)).toBe(expected);
      });
    });
  });
});
