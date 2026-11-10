import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Plus, Trash2 } from 'lucide-react-native';
import type { Outing, Station } from '@onyva/shared';
import { avatarColors, palette } from '../../theme';
import { Button, Caption, Card, Field, StationPicker, Subtitle } from '../ui';

type Props = {
  outing: Outing; stations: Station[]; canEdit: boolean; saving: boolean;
  onRemove: (participantId: string) => void;
  onAdd: (name: string, departure: string, returnStation: string) => Promise<boolean>;
};

export function ParticipantList({ outing, stations, canEdit, saving, onRemove, onAdd }: Props) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [departure, setDeparture] = useState('');
  const [returnStation, setReturnStation] = useState('');
  async function add() {
    if (!(await onAdd(name.trim(), departure, returnStation || departure))) return;
    setAdding(false); setName(''); setReturnStation('');
  }
  return <Card>
    <View className="flex-row items-center justify-between gap-3">
      <Subtitle>La bande</Subtitle>
      <View className="rounded-pill bg-chip px-2.5 py-1"><Caption className="font-semibold">{outing.participants.length} / 10</Caption></View>
    </View>
    {outing.participants.map((p, i) => <View key={p.id} className="flex-row items-center gap-3">
      <View className="h-[38px] w-[38px] items-center justify-center rounded-pill" style={{ backgroundColor: avatarColors[i % avatarColors.length] }}><Text className="font-semibold text-ink">{p.name.charAt(0).toUpperCase()}</Text></View>
      <View className="flex-1 gap-1"><Text className="text-small font-semibold text-ink">{p.name}{i === 0 ? ' · organise' : ''}</Text><Caption>{stations.find(s => s.id === p.departureId)?.name ?? p.departureId}</Caption></View>
      {canEdit && i > 0 && <Pressable accessibilityRole="button" accessibilityLabel={`Retirer ${p.name}`} disabled={saving} onPress={() => onRemove(p.id)} className="p-3"><Trash2 size={16} color={palette.muted} /></Pressable>}
    </View>)}
    {canEdit && outing.participants.length < 10 && <Pressable accessibilityRole="button" onPress={() => { setAdding(!adding); setDeparture(''); }} className="min-h-[48px] flex-row items-center gap-3 border-t border-border pt-3">
      <Plus size={18} color={palette.brand} /><Text className="text-small font-medium text-brand">Ajouter un ami</Text>
    </Pressable>}
    {adding && canEdit && <View className="gap-3.5">
      <Field label="Son prénom" value={name} onChangeText={setName} maxLength={40} />
      <StationPicker label="Son départ" stations={stations} value={departure} onChange={setDeparture} />
      <StationPicker label="Son retour" stations={stations} value={returnStation || departure} onChange={setReturnStation} />
      <Button loading={saving} disabled={!name.trim() || !departure} onPress={() => void add()}>Ajouter au groupe</Button>
    </View>}
  </Card>;
}
