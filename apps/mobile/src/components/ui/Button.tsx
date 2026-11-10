import { ActivityIndicator, Pressable, Text } from 'react-native';
import { ArrowRight } from 'lucide-react-native';
import { palette } from '../../theme';
import { cx } from './cx';

type Props = { children: string; onPress: () => void; secondary?: boolean; disabled?: boolean; loading?: boolean; icon?: boolean; testID?: string };

export function Button({ children, onPress, secondary = false, disabled = false, loading = false, icon = true, testID }: Props) {
  const foreground = secondary ? palette.ink : palette.surface;
  return <Pressable testID={testID} accessibilityRole="button" accessibilityState={{ disabled: disabled || loading }} onPress={onPress} disabled={disabled || loading}
    className={cx('min-h-[52px] flex-row items-center justify-center gap-3.5 rounded-medium px-5 py-3.5 active:opacity-75', secondary ? 'border border-border bg-surface' : 'bg-brand', disabled && 'opacity-45')}>
    {loading ? <ActivityIndicator color={secondary ? palette.brand : palette.surface} /> : <>
      <Text className={cx('text-button font-semibold', secondary ? 'text-ink' : 'text-surface')}>{children}</Text>
      {icon && <ArrowRight size={18} color={foreground} />}
    </>}
  </Pressable>;
}
