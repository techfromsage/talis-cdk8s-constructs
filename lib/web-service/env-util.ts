import { CanaryStage, canaryStages } from ".";

export function getDockerTag(
  envVarName: string,
  environment: string,
  defaultTag = "latest"
): string {
  const tag = process.env[envVarName] ?? defaultTag;

  if (!tag) {
    throw new Error(`Docker tag variable ${envVarName} is not set`);
  }

  if (
    ["production", "staging"].includes(environment) &&
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