import { previewCatalogSchema } from '@onyva/shared';
import { demoStations } from '@onyva/shared/demo';
import type { Venue } from '@onyva/shared';
import data from '../catalog/venues.json';

export const previewCatalog = previewCatalogSchema.parse(data);
export const previewStations = demoStations.map(station => previewCatalog.stations.find(candidate => candidate.id === station.id) ?? station);

export function previewData(startsAt: number, endsAt: number, kind: Venue['kind']) {
  if (startsAt < previewCatalog.validFrom || endsAt > previewCatalog.validUntil) throw new Error('Les horaires des lieux ne sont pas disponibles pour cette date. Essaie une date plus proche.');
  return { venues: previewCatalog.venues.filter(venue => venue.kind === kind) };
}
