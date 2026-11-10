import { useState } from 'react';
import { Platform, View } from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import type { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Chip } from '../ui';

// Native date or time selector. Values are Paris wall-clock strings (YYYY-MM-DD, HH:MM): the picker only shows
// the calendar or the clock, so the phone time zone never shifts the chosen day or time.
type Props = { mode: 'date' | 'time'; label: string; value: string; onChange: (value: string) => void; minimumDay?: string; selected?: boolean };

const pad = (value: number) => String(value).padStart(2, '0');
function toLocal(mode: Props['mode'], value: string): Date {
  if (mode === 'date') { const [y, m, d] = value.split('-').map(Number); return new Date(y!, m! - 1, d!, 12); }
  const [h, min] = value.split(':').map(Number); const date = new Date(); date.setHours(h!, min!, 0, 0); return date;
}
const fromLocal = (mode: Props['mode'], date: Date) => mode === 'date' ? `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` : `${pad(date.getHours())}:${pad(date.getMinutes())}`;

export function WallClockPicker({ mode, label, value, onChange, minimumDay, selected }: Props) {
  const [open, setOpen] = useState(false);
  const minimumDate = mode === 'date' && minimumDay ? toLocal('date', minimumDay) : undefined;
  const handle = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'ios') setOpen(false);
    if (event.type === 'set' && date) onChange(fromLocal(mode, date));
  };
  function show() {
    if (Platform.OS === 'android') DateTimePickerAndroid.open({ value: toLocal(mode, value), mode, is24Hour: true, minimumDate, minuteInterval: 5, onChange: handle });
    else setOpen(!open);
  }
  return <View>
    <Chip selected={selected} onPress={show}>{label}</Chip>
    {open && Platform.OS === 'ios' && <DateTimePicker value={toLocal(mode, value)} mode={mode} display={mode === 'date' ? 'inline' : 'spinner'} locale="fr-FR" minimumDate={minimumDate} minuteInterval={5} onChange={handle} />}
  </View>;
}
