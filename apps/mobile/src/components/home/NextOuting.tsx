import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { ArrowRight, CheckCircle2, Clock3, MapPin } from 'lucide-react-native';
import { activityLabels } from '@onyva/shared';
import type { Outing } from '@onyva/shared';
import { outingStatus } from '../../lib/outing-status';
import { formatWhen } from '../../lib/paris-time';
import { avatarColors, palette } from '../../theme';
import { Body, cx, Label } from '../ui';

const tone = {
  confirmed: { pill: 'bg-success-soft', text: 'text-success', color: palette.success, Icon: CheckCircle2 },
  chosen: { pill: 'bg-brand-soft', text: 'text-brand-ink', color: palette.brandInk, Icon: MapPin },
  waiting: { pill: 'bg-chip', text: 'text-muted', color: palette.muted, Icon: Clock3 },
} as const;

/** The opening screen when an outing exists: what, when, its state in words, and one way in. */
export function NextOuting({ outing }: { outing: Outing }) {
  const status = outingStatus(outing), style = tone[status.key], when = formatWhen(outing.startsAt);
  const count = outing.participants.length;
  const StatusIcon = style.Icon;
  return <View className="gap-4">
    <Label>TA PROCHAINE SORTIE</Label>
    <Pressable accessibilityRole="button" accessibilityLabel={`${activityLabels[outing.activity]}, ${when}. ${status.label}. ${status.detail} Ouvrir la sortie.`} onPress={() => router.push('/outing')}
      className="gap-5 rounded-large border border-border bg-surface p-6 active:opacity-80">
      <View className={cx('flex-row items-center gap-1.5 self-start rounded-pill px-3 py-1.5', style.pill)}>
        <StatusIcon size={14} color={style.color} /><Text className={cx('text-caption font-sans-semibold', style.text)}>{status.label}</Text>
      </View>
      <View className="gap-1">
        <Text className="text-title-lg font-sans-bold text-ink">{activityLabels[outing.activity]}</Text>
        <Text className="font-sans text-subtitle text-ink">{when}</Text>
      </View>
      <Body>{status.detail}</Body>
      <View className="flex-row items-center justify-between gap-3 border-t border-border pt-4">
        <View className="flex-row items-center gap-2">
          <View className="flex-row">{outing.participants.slice(0, 5).map((p, i) => <View key={p.id} className={cx('h-8 w-8 items-center justify-center rounded-pill border-2 border-surface', i > 0 && '-ml-2')} style={{ backgroundColor: avatarColors[i % avatarColors.length] }}>
            <Text className="text-caption font-sans-semibold text-ink">{p.name.charAt(0).toUpperCase()}</Text>
          </View>)}</View>
          <Body className="text-small">{count} {count > 1 ? 'participants' : 'participant'}</Body>
        </View>
        <View className="flex-row items-center gap-1.5"><Text className="text-small font-sans-semibold text-brand">Voir la sortie</Text><ArrowRight size={16} color={palette.brand} /></View>
      </View>
    </Pressable>
  </View>;
}
