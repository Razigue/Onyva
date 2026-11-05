import OpeningHours from 'opening_hours';
import type { Cuisine, Venue } from '@onyva/shared';

const cuisineGroups: Record<string, Cuisine> = {
  steak_house: 'meat',
  steak: 'meat',
  barbecue: 'meat',
  burger: 'meat',
  argentinian: 'meat',
  seafood: 'seafood',
  fish: 'seafood',
  fish_and_chips: 'seafood',
  italian: 'italian',
  pizza: 'italian',
  pasta: 'italian',
  chinese: 'chinese',
  japanese: 'japanese',
  sushi: 'japanese',
  ramen: 'japanese',
  indian: 'indian',
  french: 'french',
  regional: 'french',
  lebanese: 'middleEastern',
  turkish: 'middleEastern',
  persian: 'middleEastern',
  moroccan: 'middleEastern',
  vegetarian: 'vegetarian',
  vegan: 'vegetarian',
};
export function parseCuisines(tags: Record<string, string>): Cuisine[] {
  const cuisines = (tags.cuisine ?? '').toLowerCase().split(';').map((value) => value.trim())
    .filter(Boolean).map((value) => cuisineGroups[value] ?? 'other');
  if (
    ['yes', 'only'].includes(tags['diet:vegetarian'] ?? '') ||
    ['yes', 'only'].includes(tags['diet:vegan'] ?? '')
  ) cuisines.push('vegetarian');
  return [...new Set(cuisines)];
}

export function distanceMeters(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
) {
  const radians = Math.PI / 180;
  const x = (b.longitude - a.longitude) * radians *
    Math.cos((a.latitude + b.latitude) / 2 * radians);
  const y = (b.latitude - a.latitude) * radians;
  return Math.sqrt(x * x + y * y) * 6_371_000;
}
export function openIntervals(expression: string, from: Date, to: Date): Venue['openIntervals'] {
  if (process.env.TZ !== 'Europe/Paris') throw new Error('Run the importer with TZ=Europe/Paris');
  try {
    const hours = new OpeningHours(expression, {
      lat: 48.86,
      lon: 2.35,
      address: { country_code: 'fr', state: 'Île-de-France' },
    });
    return hours.getOpenIntervals(from, to).filter(([, , unknown]) => !unknown).map((
      [start, end],
    ) => ({ start: start.getTime() / 1000, end: end.getTime() / 1000 }));
  } catch {
    return [];
  }
}
