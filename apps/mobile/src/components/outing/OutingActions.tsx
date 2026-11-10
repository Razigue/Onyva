import { Platform, Pressable, Text, View } from 'react-native';
import { Share2 } from 'lucide-react-native';
import type { Outing } from '@onyva/shared';
import { palette } from '../../theme';
import { Body, Button, Label } from '../ui';

type Props = {
  outing: Outing; confirmed: boolean; saving: boolean; pushEnabled: boolean;
  onShare: () => void; onCopyCode: () => void; onStartTracking: () => void; onStopTracking: () => void; onCalendar: () => void; onTogglePush: () => void;
};

export function OutingActions({ outing, confirmed, saving, pushEnabled, onShare, onCopyCode, onStartTracking, onStopTracking, onCalendar, onTogglePush }: Props) {
  const native = Platform.OS !== 'web';
  return <>
    <Pressable accessibilityRole="button" onPress={onShare} className="min-h-[48px] flex-row items-center justify-center gap-3">
      <Share2 size={16} color={palette.brand} /><Text className="font-semibold text-brand">{confirmed ? 'Partager le rendez-vous' : 'Inviter mes amis'}</Text>
    </Pressable>
    {outing.shortCode && <View className="gap-2.5"><Body>Code d’invitation : {outing.shortCode}</Body><Button secondary onPress={onCopyCode}>Copier le code d’invitation</Button></View>}
    {confirmed && native && <>
      <Button secondary loading={saving} onPress={onStartTracking}>Je suis en route</Button>
      <Button secondary loading={saving} onPress={onStopTracking}>Je suis arrivé</Button>
    </>}
    {confirmed && <Button secondary loading={saving} onPress={onCalendar}>Ajouter au calendrier</Button>}
    {!confirmed && native && <Button secondary loading={saving} onPress={onTogglePush}>{pushEnabled ? 'Désactiver les notifications' : 'Me prévenir du lieu choisi'}</Button>}
    <View className="gap-2.5 px-2"><Label>Juste ce qu’il faut savoir.</Label><Body className="text-small">Tes stations restent entre vous. La sortie est effacée 24 h après sa fin.</Body></View>
  </>;
}
