import { Text, View } from 'react-native';
import { formatTime } from '@onyva/shared';
import type { Participant, Recommendation, Station } from '@onyva/shared';
import { Caption } from '../ui';
import { minutes } from './format';

export function JourneyDetails({ recommendation, participants, stations }: { recommendation: Recommendation; participants: Participant[]; stations: Station[] }) {
  const place = (id: string, name?: string) => name ?? stations.find(s => s.id === id)?.name ?? recommendation.venue.name;
  return <View className="gap-[18px]">{recommendation.journeys.map(journey => <View key={journey.participantId} className="gap-1.5">
    <Text className="font-semibold text-ink">{participants.find(p => p.id === journey.participantId)?.name}</Text>
    {([['Aller', journey.outbound], ['Retour', journey.inbound]] as const).map(([label, trip]) => <View key={label} className="gap-1">
      <Text className="text-[13px] text-ink">{label} · {formatTime(trip.departure)} → {formatTime(trip.arrival)} · {minutes(trip.duration)} min</Text>
      {trip.legs.map((leg, i) => <Caption key={i} className="leading-[19px]">{leg.mode === 'walk' ? 'À pied' : leg.mode === 'wait' ? 'Attente' : `Ligne ${leg.line}`} · {place(leg.from, leg.fromName)} → {place(leg.to, leg.toName)}</Caption>)}
    </View>)}
  </View>)}</View>;
}
