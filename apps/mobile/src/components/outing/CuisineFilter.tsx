import { Pressable, Text, View } from 'react-native';
import { cuisineLabels } from '@onyva/shared';
import type { Cuisine } from '@onyva/shared';
import { Body, cx } from '../ui';

export function CuisineFilter({ available, active, onChange }: { available: Cuisine[]; active: Cuisine | null; onChange: (value: Cuisine | null) => void }) {
  return <View className="gap-3">
    <Body>Jusqu’à 12 restos pour varier les envies. Le premier garde les trajets les plus équilibrés. Les cuisines dépendent des infos disponibles.</Body>
    <View className="flex-row flex-wrap items-center gap-3">{[null, ...available].map(value => <Pressable key={value ?? 'all'} accessibilityRole="button" accessibilityState={{ selected: active === value }} onPress={() => onChange(value)} className={cx('rounded-[24px] p-3', active === value ? 'bg-lime' : 'bg-chip')}>
      <Text className="font-sans text-ink">{value ? cuisineLabels[value] : 'Tous les restos'}</Text>
    </Pressable>)}</View>
  </View>;
}
