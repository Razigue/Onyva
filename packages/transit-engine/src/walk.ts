// Walk from a station to a venue. Estimate only, same factors as the PostGIS candidate search:
// straight-line distance x 1.5 detour, at 1.2 m/s. A pedestrian graph can replace it later.
export interface Point { latitude: number; longitude: number }
export interface PedestrianRouter { readonly estimated: boolean; walkSeconds(from: Point, to: Point): number | null }
export const walkingModel = { detourFactor: 1.5, metersPerSecond: 1.2 } as const;

export function distanceMeters(a: Point, b: Point): number {
  const r = Math.PI / 180, dLat = (b.latitude - a.latitude) * r, dLon = (b.longitude - a.longitude) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * r) * Math.cos(b.latitude * r) * Math.sin(dLon / 2) ** 2;
  return 6_371_000 * 2 * Math.asin(Math.sqrt(h));
}

export const estimatedWalk: PedestrianRouter = {
  estimated: true,
  walkSeconds: (from, to) => Math.ceil(distanceMeters(from, to) * walkingModel.detourFactor / walkingModel.metersPerSecond),
};
