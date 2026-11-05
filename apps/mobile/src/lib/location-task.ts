import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import { arrivedAt, trackingSessionSchema } from '@onyva/shared';
import { supabase } from './supabase';
const taskName = 'onyva-background-location';
const storageKey = 'onyva:tracking:v1';
async function tracking() {
  const raw = await SecureStore.getItemAsync(storageKey);
  if (!raw) return null;
  const parsed = trackingSessionSchema.safeParse(JSON.parse(raw));
  return parsed.success ? parsed.data : null;
}
async function relay(body: unknown) {
  const session = await supabase?.auth.getSession();
  const token = session?.data.session?.access_token;
  if (!token) throw new Error('Connexion requise.');
  return fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/location`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  });
}
export async function stopTracking() {
  const current = await tracking();
  if (await Location.hasStartedLocationUpdatesAsync(taskName)) {
    await Location.stopLocationUpdatesAsync(taskName);
  }
  await SecureStore.deleteItemAsync(storageKey);
  if (current) {
    await relay({ action: 'stop', outingId: current.outingId, lease: current.lease }).catch(() =>
      undefined
    );
  }
}
export async function stopExpiredTracking() {
  const current = await tracking();
  if (current && current.expiresAt <= Date.now()) await stopTracking();
}
TaskManager.defineTask<{ locations: Location.LocationObject[] }>(
  taskName,
  async ({ data, error }) => {
    if (error || !data) return;
    try {
      const current = await tracking();
      if (!current) return;
      if (current.expiresAt <= Date.now()) {
        await stopTracking();
        return;
      }
      for (const location of data.locations) {
        if (current.expiresAt <= Date.now()) {
          await stopTracking();
          return;
        }
        if (Math.abs(Date.now() - location.timestamp) > 60000) continue;
        if (
          location.coords.accuracy !== null && location.coords.accuracy <= 75 &&
          arrivedAt(location.coords, current.venue)
        ) {
          await stopTracking();
          return;
        }
        const response = await relay({
          action: 'position',
          outingId: current.outingId,
          lease: current.lease,
          position: {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            accuracy: location.coords.accuracy,
            timestamp: Math.round(location.timestamp),
          },
        });
        if ([401, 403, 404, 410].includes(response.status)) {
          await stopTracking();
          return;
        }
      }
    } catch { /* Never log or persist a live position. The next update may retry. */ }
  },
);
export async function startTracking(outingId: string) {
  if (!supabase) throw new Error('Connecte-toi pour partager ta position.');
  if (!(await TaskManager.isAvailableAsync())) throw new Error('Utilise une version de développement de l’application pour partager ta position.');
  if (!(await Location.requestForegroundPermissionsAsync()).granted) {
    throw new Error('Autorise ta position pour partager ton arrivée.');
  }
  if (!(await Location.requestBackgroundPermissionsAsync()).granted) {
    throw new Error('Autorise la position en arrière-plan dans les réglages.');
  }
  const response = await relay({ action: 'start', outingId });
  if (!response.ok) throw new Error('Le partage est indisponible. Réessaie.');
  const current = trackingSessionSchema.parse(await response.json());
  await stopTracking();
  await SecureStore.setItemAsync(storageKey, JSON.stringify(current));
  try {
    await Location.startLocationUpdatesAsync(taskName, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 15000,
      distanceInterval: 25,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'Tu es en route avec Onyva',
        notificationBody:
          'Ta position reste entre vous. Le partage s’arrête à ton arrivée ou après 90 min.',
        killServiceOnDestroy: true,
      },
    });
  } catch {
    await SecureStore.deleteItemAsync(storageKey);
    throw new Error('Le partage en arrière-plan n’a pas pu démarrer.');
  }
}
