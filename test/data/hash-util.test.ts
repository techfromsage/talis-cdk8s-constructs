import { hashObject } from "../../lib/data/hash-util";

describe("hash-util", () => {
  describe("hashObject", () => {
    test("Empty", () => {
      const hash = hashObject({});
      expect(hash).toBe("44hk6fmk55");
    });

    test("Hash length", () => {
      const hash = hashObject({});
      expect(hash).toHaveLength(10);
    });

    [
      { aaa: "bbb" }, // sha256:a38adcf124cd0be76ebe34eccdec97ef81012a634aea2b891a03251cc2180883
      { foo: "bar" }, // sha256:7a38bf81f383f69433ad6e900d35b3e2385593f76a7b7ab5d4355b8ba41ee24b
      { xxx: "zzz" }, // sha256:577a8a86407078408b9d77e2df34073b6126be0b66321dbcc3db6462042785ba
    ].forEach((object) => {
      test("Hash never includes vowel-like characters", () => {
        const hash = hashObject(object);
        expect(hash).toMatch(/^[^013ae]+$/);
      });
    });

    test("Same hash regardless of key order", () => {
      const object1 = {
        kind: "Thing",
        name: "Test",
      };
      const object2 = {
        name: "Test",
        kind: "Thing",
      };
      // Objects have the same content but different JSON string
      expect(JSON.stringify(object1)).not.toEqual(JSON.stringify(object2));
      // Object should have the same hash
      expect(hashObject(object1)).toStrictEqual(hashObject(object2));
    });

    test("Same hash regardless of nested key order", () => {
      const object1 = {
        kind: "Thing",
        name: "Test",
        data: { foo: "bar", fizz: "buzz" },
      };
      const object2 = {
        kind: "Thing",
        name: "Test",
        data: { fizz: "buzz", foo: "bar" },
      };
      // Objects have the same content but different JSON string
      expect(JSON.stringify(object1)).not.toEqual(JSON.stringify(object2));
      // Object should have the same hash
      expect(hashObject(object1)).toStrictEqual(hashObject(object2));
    });
  });
});
