import { Text, View } from 'react-native';
import type { Participant, Recommendation } from '@onyva/shared';
import { personColors } from '../../theme';
import { minutes } from './format';

/** One bar per person, scaled on the longest trip. The name and minutes are always written next to the bar. */
export function JourneyBars({ recommendation, participants }: { recommendation: Recommendation; participants: Participant[] }) {
  return <View className="gap-3">{recommendation.journeys.map((journey, i) => {
    const person = participants.find(p => p.id === journey.participantId);
    const width = Math.max(2, journey.outbound.duration / Math.max(60, recommendation.maximum) * 100);
    return <View key={journey.participantId} accessible accessibilityLabel={`${person?.name} : ${minutes(journey.outbound.duration)} minutes`} className="gap-2">
      <View className="flex-row items-center justify-between gap-3">
        <Text className="text-small text-ink">{person?.name}</Text>
        <Text className="text-small font-semibold text-ink" style={{ fontVariant: ['tabular-nums'] }}>{minutes(journey.outbound.duration)} min</Text>
      </View>
      <View className="h-[7px] rounded bg-track"><View className="h-[7px] rounded" style={{ width: `${width}%`, backgroundColor: personColors[i % personColors.length] }} /></View>
    </View>;
  })}</View>;
}
