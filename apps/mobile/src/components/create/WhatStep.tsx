import { Pressable, Text, View } from 'react-native';
import { Coffee, GlassWater, Sparkles, Utensils } from 'lucide-react-native';
import { activityLabels } from '@onyva/shared';
import type { Outing } from '@onyva/shared';
import { tapSelection } from '../../lib/haptics';
import { palette } from '../../theme';
import { Body, cx } from '../ui';

const options = [
  { kind: 'drinks', Icon: GlassWater, detail: 'Un toast à la fin de la journée.' },
  { kind: 'dinner', Icon: Utensils, detail: 'Une table et du temps pour discuter.' },
  { kind: 'coffee', Icon: Coffee, detail: 'Une pause qui fait du bien.' },
  { kind: 'other', Icon: Sparkles, detail: 'L’important, c’est de se retrouver.' },
] as const;

export function WhatStep({ activity, onChange }: { activity: Outing['activity']; onChange: (activity: Outing['activity']) => void }) {
  return <View className="gap-3">{options.map(({ kind, Icon, detail }) => {
    const selected = activity === kind;
    return <Pressable key={kind} accessibilityRole="button" accessibilityState={{ selected }} onPress={() => { if (!selected) tapSelection(); onChange(kind); }}
      className={cx('flex-row items-center gap-3 rounded-large border p-[22px]', selected ? 'border-brand bg-brand-soft' : 'border-border bg-surface')}>
      <Icon size={25} color={selected ? palette.brand : palette.muted} />
      <View className="gap-1"><Text className="text-subtitle font-sans-semibold text-ink">{activityLabels[kind]}</Text><Body>{detail}</Body></View>
    </Pressable>;
  })}</View>;
}
