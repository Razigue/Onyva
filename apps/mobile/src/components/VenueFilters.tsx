import { View } from 'react-native';
import { cuisineLabels, cuisineSchema } from '@onyva/shared';
import type { Cuisine, Outing, VenueFilter } from '@onyva/shared';
import { Body, Caption, Chip, Label } from './ui';

/** Cuisines most often documented in OpenStreetMap first; « Autres cuisines » is not a useful search criterion. */
const choices = cuisineSchema.options.filter((value): value is Exclude<Cuisine, 'other'> => value !== 'other');

/** Search filters of the organizer. Cuisines only for a restaurant, the terrace for every venue. */
export function VenueFilters({ activity, value, onChange }: { activity: Outing['activity']; value: VenueFilter; onChange: (value: VenueFilter) => void }) {
  if (activity === 'other') return null;
  const toggle = (cuisine: Cuisine) => onChange({ ...value, cuisines: value.cuisines.includes(cuisine) ? value.cuisines.filter(c => c !== cuisine) : [...value.cuisines, cuisine] });
  return <View className="gap-3">
    {activity === 'dinner' && <>
      <Label>Envies de cuisine</Label>
      <View className="flex-row flex-wrap gap-2">
        <Chip selected={!value.cuisines.length} onPress={() => onChange({ ...value, cuisines: [] })}>Tous les restos</Chip>
        {choices.map(cuisine => <Chip key={cuisine} selected={value.cuisines.includes(cuisine)} onPress={() => toggle(cuisine)}>{cuisineLabels[cuisine]}</Chip>)}
      </View>
    </>}
    <Label>Sur place</Label>
    <View className="flex-row flex-wrap gap-2">
      <Chip selected={value.outdoorSeating} onPress={() => onChange({ ...value, outdoorSeating: !value.outdoorSeating })}>Avec terrasse</Chip>
    </View>
    {(value.outdoorSeating || (activity === 'dinner' && value.cuisines.length > 0)) && <Caption>Seuls les lieux dont la cuisine ou la terrasse est renseignée dans OpenStreetMap restent proposés. Plus tu filtres, moins il y a de choix équilibrés.</Caption>}
  </View>;
}

/** One line for the people who cannot change the filters. Null when nothing is filtered. */
export function filterSummary(activity: Outing['activity'], value: VenueFilter | undefined): string | null {
  if (!value) return null;
  const parts = [...(activity === 'dinner' ? value.cuisines.map(c => cuisineLabels[c]) : []), ...(value.outdoorSeating ? ['avec terrasse'] : [])];
  return parts.length ? parts.join(', ') : null;
}

export function FilterSummary({ activity, value }: { activity: Outing['activity']; value: VenueFilter | undefined }) {
  const summary = filterSummary(activity, value);
  return summary ? <Body>Filtres de l’organisateur : {summary}.</Body> : null;
}
