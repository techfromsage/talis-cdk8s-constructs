import { Construct } from "constructs";
import { KubeSecret } from "../../imports/k8s";

function base64Encode(value: string): string {
  return Buffer.from(value).toString("base64");
}

interface ImagePullSecretFactoryProps {
  /**
   * The id of the construct (will form the name of the secret).
   * @default "image-pull-secret"
   */
  readonly id?: string;

  /**
   * Container image registry this secret is for.
   * @default Docker Hub
   */
  readonly registry?: string;

  /**
   * Authentication secret to use for pulling the image,
   * typically base64-encoded `<username>:<password>`.
   */
  readonly auth: string;

  /**
   * Whether to encode the auth as a base64 string.
   * @default true
   */
  readonly encode?: boolean;
}

/**
 * Create a secret with auth credentials for pulling images from a private registry.
 * @see https://kubernetes.io/docs/tasks/configure-pod-container/pull-image-private-registry/
 */
export function createImagePullSecret(
  scope: Construct,
  {
    id = "image-pull-secret",
    registry = "https://index.docker.io/v1/",
    auth,
    encode = true,
  }: ImagePullSecretFactoryProps
): KubeSecret {
  if (encode) {
    auth = base64Encode(auth);
  }

  const secret = new KubeSecret(scope, id, {
    type: "kubernetes.io/dockerconfigjson",
    data: {
      ".dockerconfigjson": base64Encode(
        JSON.stringify({ auths: { [registry]: { auth } } })
      ),
    },
  });

  return secret;
}

/**
 * Create a secret with auth credentials for pulling images from Docker Hub.
 */
export function createDockerHubSecretFromEnv(scope: Construct) {
  const { DOCKER_USERNAME, DOCKER_PASSWORD } = process.env;

  if (!DOCKER_USERNAME || !DOCKER_PASSWORD) {
    throw new Error(
      "DOCKER_USERNAME and DOCKER_PASSWORD must be set in the environment"
    );
  }

  const dockerHubSecret = createImagePullSecret(scope, {
    id: "docker-hub-cred",
    auth: `${DOCKER_USERNAME}:${DOCKER_PASSWORD}`,
  });

  return dockerHubSecret;
}
