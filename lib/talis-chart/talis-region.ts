export enum TalisRegion {
  CANADA = "ca-central-1",
  EU = "eu-west-1",
  LOCAL = "local",
}

export enum TalisShortRegion {
  CANADA = "ca",
  EU = "eu",
  LOCAL = "local",
}

export function mapTalisRegionToShort(region: TalisRegion): string {
  const match = Object.entries(TalisRegion).find(
    ([, value]) => value === region,
  );

  if (!match) {
    throw new Error(`Unsupported AWS region ${region}`);
  }

  const key = match[0] as keyof typeof TalisShortRegion;

  return TalisShortRegion[key];
}

export function mapTalisShortRegionToAws(region: TalisShortRegion): string {
  const match = Object.entries(TalisShortRegion).find(
    ([, value]) => value === region,
  );

  if (!match) {
    throw new Error(`Unsupported short region ${region}`);
  }

  const key = match[0] as keyof typeof TalisRegion;

  return TalisRegion[key];
}
