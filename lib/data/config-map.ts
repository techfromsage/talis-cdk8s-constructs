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
import { KubeConfigMap } from "../../imports/k8s";
import { hashObject } from "./hash-util";

export interface ConfigMapProps {
  /**
   * Metadata that all persisted resources must have, which includes all objects
   * users must create.
   */
  readonly metadata?: ApiObjectMetadata;

  /**
   * Immutable, if set to true, ensures that data stored in the ConfigMap cannot be updated (only object metadata can be modified).
   */
  readonly immutable?: boolean;

  /**
   * Map of key/value pairs of configuration data e.g. 'env-var' = 'value', 'filename' = 'contents'.
   *
   * You can also set data using `configMap.setData()`.
   */
  readonly data?: { [key: string]: string };

  /**
   * Map of key/value pairs of binary data e.g. 'filename' = 'contents'.
   *
   * You can also set binary data using `configMap.setBinaryData()`.
   */
  readonly binaryData?: { [key: string]: string };

  /**
   * Array of .env files to load into the config map's data.
   *
   * You can also set data using `configMap.setFromEnvFile()`.
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

export class ConfigMap extends Construct {
  public readonly disableNameSuffixHash: boolean;
  private readonly apiObject: ApiObject;
  private readonly _binaryData: { [key: string]: string } = {};
  private readonly _data: { [key: string]: string } = {};
  private _hash?: string;

  public constructor(scope: Construct, id: string, props: ConfigMapProps = {}) {
    super(scope, id);

    this.disableNameSuffixHash = props.disableNameSuffixHash ?? false;

    const labels: { [x: string]: string } = {};
    if (!this.disableNameSuffixHash) {
      labels.prunable = "true";
    }

    this.apiObject = new KubeConfigMap(this, id, {
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
      // we need lazy here because we filter empty
      data: Lazy.any({ produce: () => this.synthesizeData() }),
      binaryData: Lazy.any({
        produce: () => this.synthesizeBinaryData(),
      }),
    });

    for (const [key, value] of Object.entries(props.data ?? {})) {
      this.setData(key, value);
    }

    for (const [key, value] of Object.entries(props.binaryData ?? {})) {
      this.setBinaryData(key, value);
    }

    for (const envFile of props.envFiles ?? []) {
      this.setFromEnvFile(envFile);
    }
  }

  /**
   * The name of this ConfigMap.
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
   * Sets a data entry.
   * @param key The key
   * @param value The value
   *
   * @throws if there is a `binaryData` entry with the same key
   */
  public setData(key: string, value: string): void {
    this.verifyKeyAvailable(key, "_binaryData");
    this.invalidateHash();

    this._data[key] = value;
  }

  /**
   * The data associated with this config map.
   *
   * Returns an copy. To set data records, use `setData()` or `setBinaryData()`.
   */
  public get data(): Record<string, string> {
    return { ...this._data };
  }

  /**
   * Sets a binary data entry. BinaryData can contain byte
   * sequences that are not in the UTF-8 range.
   * @param key The key
   * @param value The value
   *
   * @throws if there is a `data` entry with the same key
   */
  public setBinaryData(key: string, value: string): void {
    this.verifyKeyAvailable(key, "_data");
    this.invalidateHash();

    this._binaryData[key] = value;
  }

  /**
   * The binary data associated with this config map.
   *
   * Returns a copy. To set data records, use `setBinaryData()` or `setData()`.
   */
  public get binaryData(): Record<string, string> {
    return { ...this._binaryData };
  }

  /**
   * Sets an entry with a file's contents.
   * @param localFile The path to the local file
   * @param key The ConfigMap key (default to the file name).
   */
  public setFile(localFile: string, key?: string): void {
    key = key ?? basename(localFile);
    const value = readFileSync(localFile, "utf-8");

    this.setData(key, value);
  }

  /**
   * Sets an entry with a binary file's contents.
   * @param localFile The path to the local file
   * @param key The ConfigMap key (default to the file name).
   */
  public setBinaryFile(localFile: string, key?: string): void {
    key = key ?? basename(localFile);
    const value = readFileSync(localFile, "utf-8");

    this.setBinaryData(key, value);
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

  /**
   * Verify we're not setting the same key in both `data` and `binaryData`.
   * @param key The key to verify
   * @param where Where the key _shouldn't_ be already used
   */
  private verifyKeyAvailable(
    key: string,
    where: "_data" | "_binaryData",
  ): void {
    if (key in this[where]) {
      throw new Error(
        `ConfigMap key "${key}" is already used in ${where.substring(1)}`,
      );
    }
  }

  private synthesizeData(): { [key: string]: string } | undefined {
    if (Object.keys(this._data).length === 0) {
      return undefined;
    }

    return this._data;
  }

  private synthesizeBinaryData(): { [key: string]: string } | undefined {
    if (Object.keys(this._binaryData).length === 0) {
      return undefined;
    }

    return this._binaryData;
  }

  /**
   * Compute the name of the config map, including the hash.
   * @param basename The base name of the config map.
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
   * @param name The name of the config map.
   */
  private computeHash(name: string): string {
    const object: Record<string, string | Record<string, string>> = {
      kind: this.apiObject.kind,
      name,
      data: this.data,
    };
    if (Object.keys(this.binaryData).length > 0) {
      object.binaryData = this.binaryData;
    }

    return hashObject(object);
  }
}
