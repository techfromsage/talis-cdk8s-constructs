import {
  ApiObject,
  ApiObjectMetadata,
  ApiObjectMetadataDefinition,
  Lazy,
} from "cdk8s";
import { Construct } from "constructs";
import { parse } from "dotenv";
import { readFileSync } from "fs";
import { basename } from "path";
import { KubeSecret } from "../../imports/k8s";
import { hashObject } from "./hash-util";

export interface SecretProps {
  /**
   * Metadata that all persisted resources must have, which includes all objects
   * users must create.
   */
  readonly metadata?: ApiObjectMetadata;

  /**
   * Immutable, if set to true, ensures that data stored in the Secret cannot be updated (only object metadata can be modified).
   */
  readonly immutable?: boolean;

  /**
   * Map of key/value pairs of binary data e.g. 'env-var' = 'value', 'filename' = 'contents'.
   *
   * You can also set data using `secret.setData()`.
   */
  readonly data?: { [key: string]: string };

  /**
   * Map of key/value pairs of non-binary data e.g. 'env-var' = 'value'.
   *
   * You can also set non-binary data using `secret.setStringData()`.
   */
  readonly stringData?: { [key: string]: string };

  /**
   * Optional type associated with the secret. Used to facilitate programmatic
   * handling of secret data by various controllers.
   */
  readonly type?: string;

  /**
   * Array of .env files to load into the secret's data.
   *
   * You can also set data using `secret.setFromEnvFile()`.
   */
  readonly envFiles?: string[];

  /**
   * Whether to not include the content-based suffix hash in the name.
   * Mimics the behavior of a generator from `kustomize`.
   * @see https://kubectl.docs.kubernetes.io/references/kustomize/kustomization/generatoroptions/
   * @default false
   */
  readonly disableNameSuffixHash?: boolean;
}

export class Secret extends Construct {
  public readonly disableNameSuffixHash: boolean;

  protected readonly apiObject: ApiObject;

  private readonly _stringData: { [key: string]: string } = {};
  private readonly _data: { [key: string]: string } = {};
  private _hash?: string;

  public constructor(scope: Construct, id: string, props: SecretProps = {}) {
    super(scope, id);

    this.disableNameSuffixHash = props.disableNameSuffixHash ?? false;

    const labels: { [x: string]: string } = {};
    if (!this.disableNameSuffixHash) {
      labels.prunable = "true";
    }

    this.apiObject = new KubeSecret(this, id, {
      metadata: {
        ...props?.metadata,
        labels: {
          ...props?.metadata?.labels,
          ...labels,
        },
        // we need lazy here to compute name based on contents
        name: Lazy.any({
          produce: () => this.computeName(props?.metadata?.name),
        }),
      },
      immutable: props.immutable,
      type: props.type,
      // we need lazy here because we filter empty
      data: Lazy.any({ produce: () => this.synthesizeData() }),
      stringData: Lazy.any({
        produce: () => this.synthesizeStringData(),
      }),
    });

    for (const [key, value] of Object.entries(props.data ?? {})) {
      this.setData(key, value);
    }

    for (const [key, value] of Object.entries(props.stringData ?? {})) {
      this.setStringData(key, value);
    }

    for (const envFile of props.envFiles ?? []) {
      this.setFromEnvFile(envFile);
    }
  }

  /**
   * The name of this Secret.
   */
  public get name(): string {
    return this.apiObject.name;
  }

  /**
   * The metadata of this ConfigMap.
   */
  public get metadata(): ApiObjectMetadataDefinition {
    return this.apiObject.metadata;
  }

  /**
   * Sets a data entry. The value will be base64 encoded, so data can contain
   * byte sequences that are not in the UTF-8 range.
   * @param key The key
   * @param value The value
   * @param encode Whether to base64 encode the value
   */
  public setData(key: string, value: string, encode = true): void {
    this.invalidateHash();

    if (key in this.stringData) {
      throw new Error(
        `Secret data key "${key}" is already used in stringData, which takes precedence`,
      );
    }

    if (encode) {
      value = Buffer.from(value).toString("base64");
    }

    if (process.env.CDK8S_REDACT_SECRET_DATA) {
      value = value.replace(/./g, "*");
    }

    this._data[key] = value;
  }

  /**
   * The data associated with this secret.
   *
   * Returns an copy. To set data records, use `setData()` or `setStringData()`.
   */
  public get data(): Record<string, string> {
    return { ...this._data };
  }

  /**
   * Allows specifying non-binary secret data in string form. It is provided as
   * a write-only input field for convenience. All keys and values are merged
   * into the data field on write, overwriting any existing values.
   * The stringData field is never output when reading from the API.
   * @param key The key
   * @param value The value
   */
  public setStringData(key: string, value: string): void {
    this.invalidateHash();

    this._stringData[key] = value;
  }

  /**
   * The binary data associated with this secret.
   *
   * Returns a copy. To set data records, use `setStringData()` or `setData()`.
   */
  public get stringData(): Record<string, string> {
    return { ...this._stringData };
  }

  /**
   * Sets an entry with a file's contents.
   * @param localFile The path to the local file
   * @param key The Secret key (default to the file name).
   */
  public setFile(localFile: string, key?: string): void {
    key = key ?? basename(localFile);
    const value = readFileSync(localFile, "utf-8");

    this.setData(key, value);
  }

  /**
   * Sets data entries from a .env file.
   * @param localFile The path to the .env file.
   */
  public setFromEnvFile(localFile: string): void {
    const parsed = parse(readFileSync(localFile, "utf-8"));

    for (const [key, value] of Object.entries(parsed)) {
      this.setData(key, value);
    }
  }

  /**
   * Invalidate the hash so that it will be recomputed.
   */
  private invalidateHash(): void {
    this._hash = undefined;
  }

  private synthesizeData(): { [key: string]: string } | undefined {
    if (Object.keys(this._data).length === 0) {
      return undefined;
    }

    return this._data;
  }

  private synthesizeStringData(): { [key: string]: string } | undefined {
    if (Object.keys(this._stringData).length === 0) {
      return undefined;
    }

    return this._stringData;
  }

  /**
   * Compute the name of the secret, including the hash.
   * @param basename The base name of the secret.
   */
  private computeName(basename?: string): string {
    const name =
      basename ?? this.apiObject.chart.generateObjectName(this.apiObject);

    if (this.disableNameSuffixHash) {
      return name;
    }

    if (!this._hash) {
      this._hash = this.computeHash(name);
    }

    return `${name}-${this._hash}`;
  }

  /**
   * Compute hash of the object itself.
   * @param name The name of the secret.
   */
  private computeHash(name: string): string {
    const object: Record<string, string | Record<string, string>> = {
      kind: this.apiObject.kind,
      name,
      data: this.data,
    };
    if (Object.keys(this.stringData).length > 0) {
      object.stringData = this.stringData;
    }

    return hashObject(object);
  }
}
