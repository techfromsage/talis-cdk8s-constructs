import { WebServiceProps } from ".";

/**
 * Whether this web service should support TLS.
 */
export function supportsTls(props: Partial<WebServiceProps>): boolean {
  return (
    !!props.tlsDomain ||
    !!props.ingressAnnotations?.["alb.ingress.kubernetes.io/certificate-arn"]
  );
}
