import { Pressable, Text } from 'react-native';
import { cx } from './cx';

export function Chip({ children, selected, onPress }: { children: string; selected?: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress}
    className={cx('min-h-[48px] justify-center rounded-medium border px-[18px]', selected ? 'border-brand bg-brand-soft' : 'border-border bg-surface')}>
    <Text className={cx('text-body', selected ? 'font-semibold text-brand' : 'text-ink')}>{children}</Text>
  </Pressable>;
}
