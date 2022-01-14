import { SimpleWebServiceChart } from "./main";
import { Testing } from "cdk8s";

describe("Simple WebService example", () => {
  test("Snapshot", () => {
    const app = Testing.app();
    const chart = new SimpleWebServiceChart(app, "test");
    const results = Testing.synth(chart);
    expect(results).toMatchSnapshot();
  });
});
