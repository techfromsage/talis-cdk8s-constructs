import { createHash } from "crypto";

/**
 * Convert an object to a JSON string with sorted keys.
 * @param object Object to convert
 * @returns Sorted JSON string
 */
function toSortedJson(object: object): string {
  return JSON.stringify(object, (_, value) => {
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      const keys = Object.keys(value).sort();
      const clone: Record<string, unknown> = {};

      for (let i = 0, l = keys.length; i < l; i++) {
        const key = keys[i];

        clone[key] = value[key];
      }

      return clone;
    }

    return value;
  });
}

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
export function hashObject(object: Record<string, unknown>): string {
  const serialised = toSortedJson(object);
  const hash = createHash("sha256").update(serialised, "utf8").digest("hex");

  return encodeHash(hash);
}
