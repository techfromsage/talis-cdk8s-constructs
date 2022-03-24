import { Chart, ChartProps, Testing } from "cdk8s";

export function makeChart(props?: ChartProps) {
  const app = Testing.app();
  const chart = new Chart(app, "test", props);
  // Just output node's id as the object's name
  chart.generateObjectName = (obj) => {
    return obj.node.id;
  };
  return chart;
}
