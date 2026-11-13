import { useState } from 'react';
import { Platform, Pressable, Text, TextInput, View } from 'react-native';
import { MapPin, Search, X } from 'lucide-react-native';
import type { Station } from '@onyva/shared';
import { palette } from '../../theme';
import { Card } from './Card';
import { Skeleton, SkeletonGroup } from './Skeleton';
import { cx } from './cx';
import { Body, Caption, Label } from './Text';

const normalize = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Best matches first: exact name, then prefix, then the stations served by the most lines. */
export function searchStations(stations: Station[], query: string, limit = 8): Station[] {
  const search = normalize(query);
  return stations.map(station => ({ station, name: normalize(station.name) }))
    .filter(item => item.name.includes(search))
    .sort((a, b) => Number(b.name === search) - Number(a.name === search) || Number(b.name.startsWith(search)) - Number(a.name.startsWith(search)) || b.station.lines.length - a.station.lines.length)
    .slice(0, limit).map(item => item.station);
}

export function StationPicker({ label = 'Ta station de départ', stations, value, onChange }: { label?: string; stations: Station[]; value: string; onChange: (id: string) => void }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const selected = stations.find(s => s.id === value);
  const filtered = searchStations(stations, query);
  return <View className="gap-2.5">
    <Label>{label}</Label>
    <Pressable accessibilityRole="button" accessibilityLabel={`${label} : ${selected?.name ?? 'Choisir'}`} onPress={() => setOpen(!open)}
      className={cx('min-h-[56px] flex-row items-center justify-between gap-3 rounded-medium border bg-surface p-4', open ? 'border-brand' : 'border-border')}>
      <View className="flex-row items-center gap-3"><MapPin size={20} color={palette.brand} /><Text className="font-sans text-body text-ink">{selected?.name ?? 'Choisis une station'}</Text></View>
      {open ? <X size={18} color={palette.muted} /> : <Search size={18} color={palette.muted} />}
    </Pressable>
    {open && <Card className="gap-1 p-3">
      <TextInput autoFocus={Platform.OS === 'web'} accessibilityLabel="Rechercher une station" placeholder="Cherche une station…" placeholderTextColor={palette.muted} value={query} onChangeText={setQuery} className="min-h-[48px] p-3 font-sans text-body text-ink" />
      {filtered.map(station => <Pressable key={station.id} accessibilityRole="button" onPress={() => { onChange(station.id); setOpen(false); setQuery(''); }} className="min-h-[48px] gap-1.5 border-t border-border p-3">
        <Text className="font-sans text-body text-ink">{station.name}</Text>
        <Caption>Lignes {station.lines.join(' · ')}</Caption>
      </Pressable>)}
      {stations.length === 0 && <View className="p-3"><SkeletonGroup label="Chargement des stations"><Skeleton width="70%" /><Skeleton width="50%" /><Skeleton width="60%" /></SkeletonGroup></View>}
      {stations.length > 0 && filtered.length === 0 && <Body className="p-3">Aucune station trouvée. Essaie un autre nom.</Body>}
    </Card>}
  </View>;
}
