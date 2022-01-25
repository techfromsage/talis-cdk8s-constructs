import { createHash } from "crypto";
import sortKeys from "sort-keys";

/**
 * Shorten a hash and prevent bad words from being formed.
 * Copied from https://github.com/kubernetes/kubernetes/blob/v1.22.4/staging/src/k8s.io/kubectl/pkg/util/hash/hash.go#L97-L125
 * @param hex Hash to encode
 */
function encodeHash(hex: string): string {
  const encoded = hex
    .substring(0, 10)
    .split("")
    .map((character) => {
      switch (character) {
        case "0":
          return "g";
        case "1":
          return "h";
        case "3":
          return "k";
        case "a":
          return "m";
        case "e":
          return "t";
        default:
          return character;
      }
    })
    .join("");
  return encoded;
}

/**
 * Compute the hash of API object.
 * Copied from https://github.com/kubernetes/kubernetes/blob/v1.22.4/staging/src/k8s.io/kubectl/pkg/util/hash/hash.go#L55-L75
 * @param object Object to hash
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function hashObject(object: Record<string, any>): string {
  const serialised = JSON.stringify(sortKeys(object, { deep: true }));
  const hash = createHash("sha256").update(serialised, "utf8").digest("hex");

  return encodeHash(hash);
}
