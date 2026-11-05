import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import type { Outing, Station, Venue } from '@onyva/shared';
import { Button, Notice, StationPicker, ui } from './ui';

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
  return <View style={ui.card}>
    <Text style={ui.subtitle}>Choisir le lieu ensemble</Text>
    <Text style={ui.body}>Choisis une station de rendez-vous. Les lieux proposés sont ouverts pendant la sortie, à cinq minutes de marche estimée au maximum.</Text>
    {outing.selectedVenue && <Notice>Lieu choisi : {outing.selectedVenue.name}. {outing.participants.length < 2 ? 'Ajoute un ami pour vérifier les allers et retours.' : 'La confirmation attend la vérification des trajets de tout le groupe.'}</Notice>}
    <StationPicker label="Station de rendez-vous" stations={stations} value={station} onChange={setStation} />
    <Button secondary disabled={disabled || !station} loading={loading} onPress={() => void search()}>Voir les lieux ouverts</Button>
    {!!error && <Notice warning>{error}</Notice>}
    {searched && !venues.length && <Notice>Aucun lieu avec des horaires connus ne correspond à ce créneau près de cette station. Essaie une autre station ou un autre type de sortie.</Notice>}
    {venues.map(venue => <View key={venue.id} style={{ gap: 8 }}>
      <Text style={ui.subtitle}>{venue.name}</Text>
      <Text style={ui.body}>{Math.ceil(venue.walkSeconds / 60)} min de marche estimée. Les trajets seront vérifiés avant confirmation.</Text>
      <Button secondary disabled={disabled || loading} onPress={() => void selectVenue(venue)}>{`Vérifier les trajets vers ${venue.name}`}</Button>
    </View>)}
    <Text style={{ ...ui.body, fontSize: 12 }}>Lieux : © les contributeurs OpenStreetMap, ODbL. Vérifie les horaires auprès de l’établissement.</Text>
  </View>;
}
