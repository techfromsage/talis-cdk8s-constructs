import { CanaryStage, canaryStages } from ".";

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
