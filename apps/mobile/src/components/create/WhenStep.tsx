import { View } from 'react-native';
import { quickDays } from '../../lib/paris-time';
import { Chip, Field, Label } from '../ui';

type Props = { day: string; time: string; duration: number; onDay: (day: string) => void; onTime: (time: string) => void; onDuration: (minutes: number) => void };
const durations = [{ minutes: 90, label: '1 h 30' }, { minutes: 150, label: '2 h 30' }, { minutes: 240, label: '4 h' }];

export function WhenStep({ day, time, duration, onDay, onTime, onDuration }: Props) {
  return <View className="gap-6">
    <View className="flex-row flex-wrap gap-2.5">{quickDays().map(option => <Chip key={option.label} selected={day === option.day} onPress={() => onDay(option.day)}>{option.label}</Chip>)}</View>
    <Field label="Date (AAAA-MM-JJ)" value={day} onChangeText={onDay} />
    <Field label="Heure de Paris (HH:MM)" value={time} onChangeText={onTime} />
    <View className="gap-2.5">
      <Label>On prévoit de rester…</Label>
      <View className="flex-row flex-wrap gap-2.5">{durations.map(d => <Chip key={d.minutes} selected={duration === d.minutes} onPress={() => onDuration(d.minutes)}>{d.label}</Chip>)}</View>
    </View>
  </View>;
}
