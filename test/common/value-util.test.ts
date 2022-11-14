import { ensureArray } from "../../lib";

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
});
