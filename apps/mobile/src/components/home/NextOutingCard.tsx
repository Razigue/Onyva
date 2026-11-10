import { View } from 'react-native';
import { router } from 'expo-router';
import { ArrowUpRight, Users } from 'lucide-react-native';
import { activityLabels, formatTime } from '@onyva/shared';
import type { Outing } from '@onyva/shared';
import { palette } from '../../theme';
import { Body, Button, Card, cx, Subtitle } from '../ui';

export function NextOutingCard({ outing, wide }: { outing: Outing | null; wide: boolean }) {
  return <View className="mb-8 gap-5">
    <View className="flex-row items-center justify-between gap-3"><Subtitle>Le prochain bon moment</Subtitle><ArrowUpRight size={21} color={palette.muted} /></View>
    {outing ? <Card>
      <View className="flex-row items-center justify-between gap-3">
        <View className="gap-2"><Subtitle>{activityLabels[outing.activity]} entre amis</Subtitle><Body>{formatTime(outing.startsAt)} · {outing.participants.length} {outing.participants.length > 1 ? 'participants' : 'participant'} · {outing.confirmedVenueId ? 'Lieu confirmé' : 'À organiser'}</Body></View>
        <Users size={28} color={palette.brand} />
      </View>
      <Button secondary onPress={() => router.push('/outing')}>Retrouver ma sortie</Button>
    </Card> : <Card className={cx('justify-between p-7', wide ? 'flex-row items-center' : 'flex-col items-start')}>
      <View className="flex-row items-center gap-3">
        <View className="h-[54px] w-[54px] items-center justify-center rounded-large bg-brand-soft"><Users size={24} color={palette.brand} /></View>
        <View className="shrink gap-1"><Subtitle className="text-subtitle">Il ne manque que le premier message.</Subtitle><Body>Lance une sortie. On s’occupe du point de rencontre.</Body></View>
      </View>
      <Button secondary onPress={() => router.push('/create')}>Créer ma première sortie</Button>
    </Card>}
  </View>;
}
