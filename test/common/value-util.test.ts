import { IntOrString } from "../../imports/k8s";
import { ensureArray, getValueFromIntOrPercent } from "../../lib";

describe("value-util", () => {
  describe("ensureArray", () => {
    test("returns an array from a string", () => {
      expect(ensureArray("foo")).toEqual(["foo"]);
    });

    test("returns an array from an array of strings", () => {
      expect(ensureArray(["foo", "bar"])).toEqual(["foo", "bar"]);
    });

    test("returns an array from a number", () => {
      expect(ensureArray(1)).toEqual([1]);
    });

    test("returns an array from an array of numbers", () => {
      expect(ensureArray([1, 2])).toEqual([1, 2]);
    });
  });

  describe("getValueFromIntOrPercent", () => {
    test.each([
      [IntOrString.fromNumber(1), 99, 1],
      [IntOrString.fromNumber(2), 99, 2],
    ])("returns a number from a number %o", (intOrStr, reference, expected) => {
      expect(getValueFromIntOrPercent(intOrStr, reference)).toEqual(expected);
    });

    test.each([
      [IntOrString.fromString("1%"), 2, 1],
      [IntOrString.fromString("33%"), 3, 1],
      [IntOrString.fromString("34%"), 3, 2],
      [IntOrString.fromString("50%"), 5, 3],
    ])(
      "returns a number from a percentage string %o, rounded up",
      (value, total, expected) => {
        expect(getValueFromIntOrPercent(value, total)).toEqual(expected);
      },
    );

    test.each([
      [IntOrString.fromString("1%"), 2, 0],
      [IntOrString.fromString("33%"), 3, 0],
      [IntOrString.fromString("34%"), 3, 1],
      [IntOrString.fromString("50%"), 5, 2],
    ])(
      "returns a number from a percentage string %o, rounded down",
      (value, total, expected) => {
        expect(getValueFromIntOrPercent(value, total, false)).toEqual(expected);
      },
    );

    test("throws if string does not have % suffic", () => {
      expect(() => {
        getValueFromIntOrPercent(IntOrString.fromString("42"), 42);
      }).toThrowErrorMatchingSnapshot();
    });

    test("throws if string is not a percentage number", () => {
      expect(() => {
        getValueFromIntOrPercent(IntOrString.fromString("foo%"), 42);
      }).toThrowErrorMatchingSnapshot();
    });
  });
});
