import { Text, View } from 'react-native';
import type { Participant } from '@onyva/shared';
import { Caption, cx } from '../ui';
import { minutes } from './format';
import { JourneyBars } from './JourneyBars';

type Props = { rows: Array<{ participantId: string; duration: number }>; maximum: number; spread: number; participants: Participant[]; replay: string; estimated?: boolean; highlight?: boolean };

/**
 * The proof of fairness (PRODUCT.md): nobody goes beyond the maximum, and the spread between the longest and the
 * shortest trip. Written first, then shown per person. Estimates say so.
 */
export function FairnessPanel({ rows, maximum, spread, participants, replay, estimated = false, highlight = false }: Props) {
  const approx = estimated ? 'environ ' : '';
  const summary = `Personne ne dépasse ${approx}${minutes(maximum)} minutes. Écart de ${approx}${minutes(spread)} minutes entre le trajet le plus long et le plus court.`;
  return <View className={cx('gap-4 rounded-large p-4', highlight ? 'bg-surface' : 'bg-paper')}>
    <View accessible accessibilityLabel={summary} className="flex-row flex-wrap items-end gap-x-6 gap-y-2">
      <View className="gap-0.5">
        <Caption>Personne ne dépasse</Caption>
        <Text className="text-display font-bold text-ink" style={{ fontVariant: ['tabular-nums'] }}>{estimated ? '≈ ' : ''}{minutes(maximum)} min</Text>
      </View>
      <View className="gap-0.5 pb-1">
        <Caption>Écart entre vous</Caption>
        <Text className="text-title font-semibold text-ink" style={{ fontVariant: ['tabular-nums'] }}>{estimated ? '≈ ' : ''}{minutes(spread)} min</Text>
      </View>
    </View>
    <JourneyBars rows={rows} maximum={maximum} participants={participants} replay={replay} estimated={estimated} />
  </View>;
}
