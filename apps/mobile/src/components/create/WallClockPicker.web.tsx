import { View } from 'react-native';
import { palette, tokens } from '../../theme';
import { Label } from '../ui';

// Web preview: the browser's own date and time controls. They open a picker, no free typing is needed.
type Props = { mode: 'date' | 'time'; label: string; value: string; onChange: (value: string) => void; minimumDay?: string; selected?: boolean };

export function WallClockPicker({ mode, label, value, onChange, minimumDay, selected }: Props) {
  return <View className="gap-1">
    <Label>{label}</Label>
    <input type={mode} aria-label={label} value={value} min={mode === 'date' ? minimumDay : undefined} step={mode === 'time' ? 300 : undefined}
      onChange={event => { if (event.target.value) onChange(event.target.value); }}
      style={{ minHeight: 48, padding: '0 14px', borderRadius: tokens.radius.medium, border: `1px solid ${selected ? palette.brand : palette.border}`, background: palette.surface, color: palette.ink, fontSize: 16, fontFamily: 'inherit' }} />
  </View>;
}
