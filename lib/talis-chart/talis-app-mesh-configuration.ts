export interface TalisAppMeshConfiguration {
  /*
   * Whether to enable App Mesh for this chart.
   * @default false
   */
  readonly enabled: boolean;
  /*
   * The name of the App Mesh to associate with this chart.
   */
  readonly meshName: string;
  /*
   * The ARN of the IAM role that the appMesh sidecar should assume.
   */
  readonly serviceRoleArn?: string;
  /*
   * Whether to add the appMesh role to the default service account.
   * Permissions are required for the appMesh sidecar to communicate with the appMesh control plane.
   * @default false
   */
  readonly addToDefaultServiceAccount?: boolean;
  /*
   * Whether to inject the appMesh sidecar into pods in this namespace.
   * @default false
   */
  readonly injectSidecar?: boolean;
}
