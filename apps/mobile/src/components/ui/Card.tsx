import { View } from 'react-native';
import type { ViewProps } from 'react-native';
import { cx } from './cx';

export function Card({ className, ...props }: ViewProps & { className?: string }) {
  return <View className={cx('gap-4 rounded-large border border-border bg-surface p-6', className)} {...props} />;
}
