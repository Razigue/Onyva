import type { ReactNode } from 'react';
import { Text } from 'react-native';
import type { TextProps } from 'react-native';
import { cx } from './cx';

type Props = TextProps & { children: ReactNode; className?: string };

export function Title({ className, ...props }: Props) {
  return <Text accessibilityRole="header" className={cx('text-title-lg font-sans-bold tracking-tight text-ink', className)} {...props} />;
}
export function Subtitle({ className, ...props }: Props) {
  return <Text className={cx('text-title font-sans-semibold text-ink', className)} {...props} />;
}
export function Body({ className, ...props }: Props) {
  return <Text className={cx('font-sans text-body text-muted', className)} {...props} />;
}
export function Label({ className, ...props }: Props) {
  return <Text className={cx('text-small font-sans-semibold text-muted', className)} {...props} />;
}
export function Caption({ className, ...props }: Props) {
  return <Text className={cx('font-sans text-caption text-muted', className)} {...props} />;
}
