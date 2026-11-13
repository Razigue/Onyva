import { TextInput, View } from 'react-native';
import type { TextInputProps } from 'react-native';
import { palette } from '../../theme';
import { Label } from './Text';

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return <View className="gap-2">
    <Label>{label}</Label>
    <TextInput accessibilityLabel={label} placeholderTextColor={palette.muted} {...props}
      className="min-h-[52px] rounded-medium border border-border bg-surface px-4 font-sans text-body text-ink" />
  </View>;
}
