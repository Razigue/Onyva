import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import type { Outing, Station, Venue } from '@onyva/shared';
import { Body, Button, Caption, Card, ConvergenceMotif, Notice, Skeleton, SkeletonGroup, StationPicker, Subtitle } from './ui';

type Props = {
  outing: Outing;
  stations: Station[];
  findVenues: (stationId: string) => Promise<Venue[]>;
  selectVenue: (venue: Venue) => Promise<void>;
  disabled: boolean;
};
export default function ManualVenuePicker({ outing, stations, findVenues, selectVenue, disabled }: Props) {
  const [station, setStation] = useState(outing.selectedVenue?.stationId ?? outing.participants[0]?.departureId ?? '');
  const [venues, setVenues] = useState<Venue[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const generation = useRef(0);
  useEffect(() => {
    generation.current++; setVenues([]); setSearched(false); setLoading(false); setError('');
  }, [station, outing.id, outing.updatedAt]);
  async function search() {
    const version = ++generation.current;
    setLoading(true); setError('');
    try {
      const values = await findVenues(station);
      if (generation.current === version) { setVenues(values); setSearched(true); }
    } catch { if (generation.current === version) setError('Les lieux sont indisponibles. Vérifie ta connexion puis réessaie.'); }
    finally { if (generation.current === version) setLoading(false); }
  }
  return <Card>
    <Subtitle>Choisir le lieu ensemble</Subtitle>
    <Body>Choisis une station de rendez-vous. Les lieux proposés sont ouverts pendant la sortie, à cinq minutes de marche estimée au maximum.</Body>
    {outing.selectedVenue && <Notice>Lieu choisi : {outing.selectedVenue.name}. {outing.participants.length < 2 ? 'Ajoute un ami pour vérifier les allers et retours.' : 'La confirmation attend la vérification des trajets de tout le groupe.'}</Notice>}
    <StationPicker label="Station de rendez-vous" stations={stations} value={station} onChange={setStation} />
    <Button secondary disabled={disabled || !station} loading={loading} onPress={() => void search()}>Voir les lieux ouverts</Button>
    {!!error && <Notice warning>{error}</Notice>}
    {loading && <SkeletonGroup label="Recherche des lieux ouverts">{[0, 1, 2].map(i => <View key={i} className="gap-2"><Skeleton width="60%" height={20} /><Skeleton width="85%" height={14} /></View>)}</SkeletonGroup>}
    {searched && !venues.length && <View className="flex-row items-center gap-3 rounded-medium bg-paper p-3.5">
      <ConvergenceMotif variant="apart" size="small" />
      <Body className="flex-1 text-small">Aucun lieu avec des horaires connus ne correspond à ce créneau près de cette station. Essaie une autre station ou un autre type de sortie.</Body>
    </View>}
    {venues.map(venue => <View key={venue.id} className="gap-2">
      <Subtitle>{venue.name}</Subtitle>
      <Body>{Math.ceil(venue.walkSeconds / 60)} min de marche estimée. Les trajets seront vérifiés avant confirmation.</Body>
      <Button secondary disabled={disabled || loading} onPress={() => void selectVenue(venue)}>{`Vérifier les trajets vers ${venue.name}`}</Button>
    </View>)}
    <Caption>Lieux : © les contributeurs OpenStreetMap, ODbL. Vérifie les horaires auprès de l’établissement.</Caption>
  </Card>;
}
