import { readFile, writeFile } from 'node:fs/promises';
import { previewCatalogSchema, previewSourceSchema } from '@onyva/shared';
import { openIntervals } from './venues/hours';
const source = previewSourceSchema.parse(
  JSON.parse(await readFile('packages/shared/src/catalog/preview-source.json', 'utf8')),
);
const from = new Date();
from.setHours(0, 0, 0, 0);
const to = new Date(from);
to.setDate(to.getDate() + 9);
const catalog = previewCatalogSchema.parse({
  ...source,
  generatedAt: new Date().toISOString(),
  validFrom: from.getTime() / 1000,
  validUntil: to.getTime() / 1000,
  venues: source.venues.map((item) => ({
    ...item.venue,
    openIntervals: openIntervals(item.openingHours, from, to),
  })).filter((venue) => venue.openIntervals.length),
});
await writeFile('apps/mobile/src/catalog/venues.json', JSON.stringify(catalog) + '\n');
console.info(`Catalogue local : ${catalog.venues.length} lieux OSM réels. Trajets simulés.`);
