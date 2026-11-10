import { useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import type { Participant } from '@onyva/shared';
import { personColors } from '../../theme';
import { minutes } from './format';

type Row = { participantId: string; duration: number };

function Bar({ width, color, delay, replay }: { width: number; color: string; delay: number; replay: string }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = 0;
    progress.value = withDelay(delay, withTiming(1, { duration: 450, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System }));
  }, [replay, delay, progress]);
  const style = useAnimatedStyle(() => ({ width: `${width * progress.value}%` }));
  return <View className="h-2 overflow-hidden rounded-pill bg-track"><Animated.View style={[{ height: 8, borderRadius: 999, backgroundColor: color }, style]} /></View>;
}

/**
 * One bar per person, scaled on the longest trip: the bars grow towards the maximum when results arrive.
 * The minutes are written as text from the start, so the motion never delays the information.
 */
export function JourneyBars({ rows, maximum, participants, replay, estimated = false }: { rows: Row[]; maximum: number; participants: Participant[]; replay: string; estimated?: boolean }) {
  return <View className="gap-3">{rows.map((row, i) => {
    const person = participants.find(p => p.id === row.participantId);
    const value = `${estimated ? 'environ ' : ''}${minutes(row.duration)} min`;
    return <View key={row.participantId} accessible accessibilityLabel={`${person?.name} : ${estimated ? 'environ ' : ''}${minutes(row.duration)} minutes`} className="gap-1.5">
      <View className="flex-row items-center justify-between gap-3">
        <Text className="text-small text-ink">{person?.name}</Text>
        <Text className="text-small font-semibold text-ink" style={{ fontVariant: ['tabular-nums'] }}>{value}</Text>
      </View>
      <Bar width={Math.max(2, row.duration / Math.max(60, maximum) * 100)} color={personColors[i % personColors.length]!} delay={i * 60} replay={replay} />
    </View>;
  })}</View>;
}
