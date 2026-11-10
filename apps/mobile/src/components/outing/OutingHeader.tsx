import { View } from 'react-native';
import { Clock3 } from 'lucide-react-native';
import { activityLabels, formatTime } from '@onyva/shared';
import type { Outing } from '@onyva/shared';
import { palette } from '../../theme';
import { Body, Label, Title } from '../ui';

export function OutingHeader({ outing }: { outing: Outing }) {
  const date = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'long' }).format(new Date(outing.startsAt));
  return <View className="gap-3">
    <View className="flex-row items-center justify-between gap-3"><Label>{outing.confirmedVenueId ? 'LE RENDEZ-VOUS EST PRIS' : 'TA SORTIE · ÉTAPE 4 / 4'}</Label><Label>SORTIE PARTAGÉE</Label></View>
    <Title>{outing.confirmedVenueId ? 'C’est décidé. On y va !' : 'Des amis. Un même point.'}</Title>
    <View className="flex-row flex-wrap items-center gap-3">
      <Body>{activityLabels[outing.activity]}</Body><Body>·</Body><Clock3 size={16} color={palette.muted} />
      <Body>{date} · {formatTime(outing.startsAt)} à {formatTime(outing.endsAt)}</Body>
    </View>
  </View>;
}
