import { useCallback, useState } from 'react';
import { AppState, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { locationPayloadSchema, locationTopic } from '@onyva/shared';
import type { LivePosition, Outing, Station, Venue } from '@onyva/shared';
import { supabase } from '../lib/supabase';
import VenueMap from './VenueMap';
import { Body } from './ui';
export default function LiveVenueMap(
  { outing, stations, venues }: { outing: Outing; stations: Station[]; venues: Venue[] },
) {
  const [positions, setPositions] = useState<LivePosition[]>([]);
  const [unavailable, setUnavailable] = useState(false);
  const topic = locationTopic(outing);
  useFocusEffect(useCallback(() => {
    if (!supabase || !outing.confirmedVenueId) return;
    const client = supabase;
    let channel: ReturnType<typeof client.channel> | null = null;
    const unsubscribe = () => {
      if (channel) {
        void client.removeChannel(channel);
        channel = null;
      }
      setPositions([]);
    };
    const subscribe = () => {
      if (channel || AppState.currentState !== 'active') return;
      channel = client.channel(topic, { config: { private: true } })
        .on('broadcast', { event: 'location' }, (message) => {
          const parsed = locationPayloadSchema.safeParse(message.payload);
          if (
            parsed.success && outing.participants.some((p) => p.id === parsed.data.participantId) &&
            Math.abs(Date.now() - parsed.data.timestamp) < 120000
          ) {
            setPositions((current) => [
              ...current.filter((p) => p.participantId !== parsed.data.participantId),
              parsed.data,
            ]);
          }
        })
        .on('broadcast', { event: 'location-stop' }, (message) => {
          const id = message.payload?.participantId;
          if (typeof id === 'string') {
            setPositions((current) => current.filter((p) => p.participantId !== id));
          }
        })
        .subscribe((status) => setUnavailable(['CHANNEL_ERROR', 'TIMED_OUT'].includes(status)));
    };
    subscribe();
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') subscribe();
      else unsubscribe();
    });
    const expiry = setInterval(
      () => setPositions((current) => current.filter((p) => Date.now() - p.timestamp < 120000)),
      15000,
    );
    return () => {
      clearInterval(expiry);
      listener.remove();
      unsubscribe();
    };
  }, [topic, outing.confirmedVenueId]));
  return (
    <View className="gap-2">
      <VenueMap stations={stations} venues={venues} positions={positions} />
      {unavailable && (
        <Body>Le partage en direct est indisponible pour le moment.</Body>
      )}
      {positions.map((position) => (
        <Body key={position.participantId}>
          {outing.participants.find((p) => p.id === position.participantId)?.name}{' '}
          partage sa position.
        </Body>
      ))}
    </View>
  );
}
