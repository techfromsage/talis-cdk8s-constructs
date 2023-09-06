import { IntOrString } from "../../imports/k8s";

/**
 * Ensure an array of values even if only a single value is passed.
 */
export function ensureArray<T>(value: T | T[]): T[] {
  return Array.isArray(value) ? value : [value];
}

/**
 * Returns a scaled value from an IntOrString type.
 *
 * If the IntOrString is a percentage string value it's treated as a percentage
 * and scaled appropriately in accordance to the total, if it's an int value it
 * is treated as a simple value and if it is a string value which is either
 * non-numeric or numeric but lacking a trailing '%' it returns an error.
 *
 * @see https://github.com/kubernetes/kubernetes/blob/v1.28.0/staging/src/k8s.io/apimachinery/pkg/util/intstr/intstr.go#L155
 *
 * @param intOrString Given IntOrString
 * @param total Total value for percentage calculations
 * @returns Number value
 */
export function getValueFromIntOrPercent(
  intOrString: IntOrString | string | number,
  total: number,
  roundUp = true,
): number {
  const value =
    intOrString instanceof IntOrString ? intOrString.value : intOrString;

  if (typeof value === "string") {
    if (!value.endsWith("%")) {
      throw new Error(`Invalid type: ${value} is not a percentage`);
    }

    const percentage = Number(value.slice(0, -1));
    if (Number.isNaN(percentage)) {
      throw new Error(`Invalid value: ${value} is not a number`);
    }

    if (roundUp) {
      return Math.ceil((percentage / 100) * total);
    }

    return Math.floor((percentage / 100) * total);
  }

  return value;
}
