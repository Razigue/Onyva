import { View } from 'react-native';
import { firstSlot, formatDay, formatSlot, parisDate, quickDays, timeSlots } from '../../lib/paris-time';
import { Body, Chip, Label } from '../ui';
import { WallClockPicker } from './WallClockPicker';

type Props = { day: string; time: string; duration: number; onDay: (day: string) => void; onTime: (time: string) => void; onDuration: (minutes: number) => void };
const durations = [{ minutes: 90, label: '1 h 30' }, { minutes: 150, label: '2 h 30' }, { minutes: 240, label: '4 h' }];

/** Day and time are picked by touch: quick chips, round slots, and the native selector as an option. */
export function WhenStep({ day, time, duration, onDay, onTime, onDuration }: Props) {
  const days = quickDays(), today = days[0]!.day;
  const custom = !days.some(option => option.day === day);
  const slots = timeSlots(day, time);
  function pickDay(next: string) {
    onDay(next);
    // A slot that is already over for the new day moves to the first one still ahead.
    const start = parisDate(next, time);
    if (!start || start.getTime() < Date.now() + 3600_000) { const slot = firstSlot(next); if (slot) onTime(slot); }
  }
  return <View className="gap-6">
    <View className="gap-2.5">
      <Label>Le jour</Label>
      <View className="flex-row flex-wrap gap-2.5">
        {days.map(option => <Chip key={option.label} selected={day === option.day} onPress={() => pickDay(option.day)}>{option.label}</Chip>)}
        <WallClockPicker mode="date" label={custom ? formatDay(day) : 'Autre date'} value={day} minimumDay={today} selected={custom} onChange={pickDay} />
      </View>
    </View>
    <View className="gap-2.5">
      <Label>L’heure, à Paris</Label>
      {slots.length === 0 ? <Body>Plus de créneau ce soir. Choisis un autre jour.</Body> : <View className="flex-row flex-wrap gap-2.5">
        {slots.map(slot => <Chip key={slot} selected={slot === time} onPress={() => onTime(slot)}>{formatSlot(slot)}</Chip>)}
      </View>}
      <View className="flex-row"><WallClockPicker mode="time" label="Autre heure" value={time} onChange={onTime} /></View>
    </View>
    <View className="gap-2.5">
      <Label>On prévoit de rester…</Label>
      <View className="flex-row flex-wrap gap-2.5">{durations.map(d => <Chip key={d.minutes} selected={duration === d.minutes} onPress={() => onDuration(d.minutes)}>{d.label}</Chip>)}</View>
    </View>
  </View>;
}
