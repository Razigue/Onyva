import { describe, expect, it } from 'vitest';
import { parseCuisines, parseOutdoorSeating } from '../scripts/venues/hours.ts';

// Synthetic OpenStreetMap tags, not taken from a real venue.
describe('OpenStreetMap venue tags', () => {
  it('maps cuisines to the app groups, a pizzeria counting as Italian too', () => {
    expect(parseCuisines({ cuisine: 'pizza' })).toEqual(['pizza', 'italian']);
    expect(parseCuisines({ cuisine: 'Thai; Vietnamese;sushi' })).toEqual(['asian', 'japanese']);
    expect(parseCuisines({ cuisine: 'crepe;breton' })).toEqual(['crepe']);
    expect(parseCuisines({ cuisine: 'senegalese;mexican;burger' })).toEqual(['african', 'americas', 'burger']);
  });

  it('keeps unknown cuisines as other and adds vegetarian from the diet tags', () => {
    expect(parseCuisines({ cuisine: 'fusion' })).toEqual(['other']);
    expect(parseCuisines({ cuisine: 'french', 'diet:vegan': 'yes' })).toEqual(['french', 'vegetarian']);
    expect(parseCuisines({ 'diet:vegetarian': 'limited' })).toEqual([]);
    expect(parseCuisines({})).toEqual([]);
  });

  it('reads a terrace only from a plain yes or no', () => {
    expect(parseOutdoorSeating({ outdoor_seating: 'yes' })).toBe(true);
    expect(parseOutdoorSeating({ outdoor_seating: 'No' })).toBe(false);
    expect(parseOutdoorSeating({ outdoor_seating: 'garden' })).toBeNull();
    expect(parseOutdoorSeating({})).toBeNull();
  });
});
