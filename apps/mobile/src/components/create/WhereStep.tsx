import { View } from 'react-native';
import type { Station } from '@onyva/shared';
import { Field, Notice, StationPicker } from '../ui';

type Props = { name: string; onName: (name: string) => void; stations: Station[]; station: string; onStation: (id: string) => void; configured: boolean; sessionReady: boolean; sessionFailed: boolean };

export function WhereStep({ name, onName, stations, station, onStation, configured, sessionReady, sessionFailed }: Props) {
  return <View className="gap-6">
    <Field label="Ton prénom" value={name} onChangeText={onName} maxLength={40} />
    <StationPicker stations={stations} value={station} onChange={onStation} />
    <Notice>Seuls ton prénom et le nom de ta station seront partagés avec le groupe.</Notice>
    {!configured && <Notice warning>Le service n’est pas configuré sur cette version de l’application.</Notice>}
    {configured && !sessionReady && <Notice warning={sessionFailed}>{sessionFailed ? 'Le service est injoignable. Vérifie ta connexion internet, on réessaie tout seuls.' : 'On prépare ta session…'}</Notice>}
  </View>;
}
