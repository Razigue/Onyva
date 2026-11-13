import OpeningHours from 'opening_hours';
import type { Cuisine, Venue } from '@onyva/shared';

/** OpenStreetMap `cuisine` values to the groups shown in the app. A pizzeria also counts as Italian. */
const cuisineGroups: Record<string, Cuisine[]> = {
  steak_house: ['meat'], steak: ['meat'], barbecue: ['meat'], argentinian: ['meat'], grill: ['meat'], chicken: ['meat'],
  seafood: ['seafood'], fish: ['seafood'], fish_and_chips: ['seafood'],
  italian: ['italian'], pasta: ['italian'], italian_pizza: ['italian', 'pizza'], pizza: ['pizza', 'italian'],
  chinese: ['chinese'], cantonese: ['chinese'], sichuan: ['chinese'], dumpling: ['chinese'],
  japanese: ['japanese'], sushi: ['japanese'], ramen: ['japanese'],
  asian: ['asian'], thai: ['asian'], vietnamese: ['asian'], korean: ['asian'], cambodian: ['asian'], laotian: ['asian'], malaysian: ['asian'], indonesian: ['asian'], filipino: ['asian'], noodle: ['asian'],
  indian: ['indian'], pakistani: ['indian'], sri_lankan: ['indian'], nepalese: ['indian'],
  french: ['french'], regional: ['french'], brasserie: ['french'], bistro: ['french'],
  crepe: ['crepe'], pancake: ['crepe'], breton: ['crepe'],
  lebanese: ['middleEastern'], turkish: ['middleEastern'], persian: ['middleEastern'], moroccan: ['middleEastern'], kebab: ['middleEastern'], couscous: ['middleEastern'], algerian: ['middleEastern'], tunisian: ['middleEastern'], syrian: ['middleEastern'],
  african: ['african'], senegalese: ['african'], ethiopian: ['african'], ivorian: ['african'], cameroonian: ['african'], west_african: ['african'], congolese: ['african'],
  burger: ['burger'],
  american: ['americas'], mexican: ['americas'], tex_mex: ['americas'], brazilian: ['americas'], peruvian: ['americas'], latin_american: ['americas'], caribbean: ['americas'], colombian: ['americas'],
  vegetarian: ['vegetarian'], vegan: ['vegetarian'],
};
export function parseCuisines(tags: Record<string, string>): Cuisine[] {
  const cuisines = (tags.cuisine ?? '').toLowerCase().split(';').map((value) => value.trim())
    .filter(Boolean).flatMap((value) => cuisineGroups[value] ?? ['other' as const]);
  if (
    ['yes', 'only'].includes(tags['diet:vegetarian'] ?? '') ||
    ['yes', 'only'].includes(tags['diet:vegan'] ?? '')
  ) cuisines.push('vegetarian');
  return [...new Set(cuisines)];
}
/** OpenStreetMap `outdoor_seating`: null when the tag is missing or not a plain answer. */
export function parseOutdoorSeating(tags: Record<string, string>): boolean | null {
  const value = tags.outdoor_seating?.toLowerCase();
  return value === 'yes' ? true : value === 'no' ? false : null;
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
