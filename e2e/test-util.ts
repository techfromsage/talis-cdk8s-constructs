import { getWatermark } from "../lib";

export function getBuildWatermark() {
  return getWatermark({
    envVarName: "CIRCLE_BUILD_NUM",
    defaultValue: "local",
  });
}

export function makeTtlTimestamp(hours = 1) {
  const nowTs = Math.floor(+new Date() / 1000);
  return nowTs + hours * 60 * 60;
}
