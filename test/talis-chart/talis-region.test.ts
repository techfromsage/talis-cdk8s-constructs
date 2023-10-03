import {
  TalisRegion,
  TalisShortRegion,
  mapTalisRegionToShort,
  mapTalisShortRegionToAws,
} from "../../lib";

describe("talis-region", () => {
  describe("mapTalisRegionToShort", () => {
    test("maps TalisRegion.CANADA to TalisShortRegion.CANADA", () => {
      expect(mapTalisRegionToShort(TalisRegion.CANADA)).toEqual(
        TalisShortRegion.CANADA,
      );
    });

    test("maps TalisRegion.EU to TalisShortRegion.EU", () => {
      expect(mapTalisRegionToShort(TalisRegion.EU)).toEqual(
        TalisShortRegion.EU,
      );
    });

    test("maps TalisRegion.LOCAL to TalisShortRegion.LOCAL", () => {
      expect(mapTalisRegionToShort(TalisRegion.LOCAL)).toEqual(
        TalisShortRegion.LOCAL,
      );
    });

    test("throws an error when given an unsupported region", () => {
      expect(() => mapTalisRegionToShort("unsupported" as TalisRegion)).toThrow(
        "Unsupported AWS region unsupported",
      );
    });
  });

  describe("mapTalisShortRegionToAws", () => {
    test("maps TalisShortRegion.CANADA to TalisRegion.CANADA", () => {
      expect(mapTalisShortRegionToAws(TalisShortRegion.CANADA)).toEqual(
        TalisRegion.CANADA,
      );
    });

    test("maps TalisShortRegion.EU to TalisRegion.EU", () => {
      expect(mapTalisShortRegionToAws(TalisShortRegion.EU)).toEqual(
        TalisRegion.EU,
      );
    });

    test("maps TalisShortRegion.LOCAL to TalisRegion.LOCAL", () => {
      expect(mapTalisShortRegionToAws(TalisShortRegion.LOCAL)).toEqual(
        TalisRegion.LOCAL,
      );
    });

    test("throws an error when given an unsupported region", () => {
      expect(() =>
        mapTalisShortRegionToAws("unsupported" as TalisShortRegion),
      ).toThrow("Unsupported short region unsupported");
    });
  });
});
