import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { cx } from './cx';

export function Notice({ children, warning = false }: { children: ReactNode; warning?: boolean }) {
  return <View accessibilityRole="alert" className={cx('rounded-medium p-3.5', warning ? 'bg-warning-soft' : 'bg-brand-soft')}>
    <Text className={cx('font-sans text-small', warning ? 'text-warning-ink' : 'text-brand-ink')}>{children}</Text>
  </View>;
}
