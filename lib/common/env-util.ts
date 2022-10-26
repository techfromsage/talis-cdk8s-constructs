import { TalisDeploymentEnvironment } from "../talis-chart/talis-deployment-environment";
import { CanaryStage, canaryStages } from "../web-service";

export function getWatermark({
  envVarName = "WATERMARK",
  defaultValue = undefined,
}: { envVarName?: string; defaultValue?: string } = {}): string {
  const watermark = process.env[envVarName] || defaultValue;
  const watermarkRegex = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;

  if (!watermark) {
    throw new Error(`Watermark variable ${envVarName} is not set`);
  }

  if (watermark.length > 63) {
    throw new Error("Watermark must not exceed 63 characters");
  }

  if (!watermarkRegex.test(watermark)) {
    throw new Error(
      "Watermark is not valid, must contain only lowercase alphanumeric characters or '-', and must start and end with an alphanumeric character."
    );
  }

  return watermark;
}

export function getTtlTimestamp({ envVarName = "TTL" } = {}):
  | number
  | undefined {
  const ttl = process.env[envVarName];

  if (!ttl) {
    return undefined;
  }

  if (!/^\d{10,}$/.test(ttl)) {
    throw new Error(`Invalid TTL: ${ttl}`);
  }

  return Number(ttl);
}

export function getDockerTag(
  envVarName: string,
  environment: TalisDeploymentEnvironment,
  defaultTag = "latest"
): string {
  const tag = process.env[envVarName] ?? defaultTag;

  if (!tag) {
    throw new Error(`Docker tag variable ${envVarName} is not set`);
  }

  if (
    [
      TalisDeploymentEnvironment.PRODUCTION,
      TalisDeploymentEnvironment.STAGING,
    ].includes(environment) &&
    ["latest", "stable", "release"].includes(tag)
  ) {
    throw new Error(
      `"${tag}" is not a valid Docker tag for ${environment}, please set ${envVarName} to a valid tag`
    );
  }

  return tag;
}

export function getCanaryStage(
  envVarName = "CANARY_STAGE",
  defaultStage?: CanaryStage
): CanaryStage {
  const stage = (process.env[envVarName] as CanaryStage) || defaultStage;

  if (!stage) {
    throw new Error(`Stage environment variable ${envVarName} is not set`);
  }

  if (!canaryStages.includes(stage)) {
    throw new Error(
      `Invalid canary stage: ${stage}. Allowed values are ${canaryStages.join(
        ", "
      )}`
    );
  }

  return stage;
}
