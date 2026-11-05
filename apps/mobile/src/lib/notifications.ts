import Constants from 'expo-constants';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { expoPushTokenSchema } from '@onyva/shared';
import { supabase } from './supabase';

let token: string | null = null;

export async function enableConfirmationPush(outingId: string): Promise<void> {
  if (!supabase) throw new Error('Connecte-toi pour activer les notifications.');
  const projectId = Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) throw new Error('Les notifications ne sont pas encore configurées pour cette application.');
  if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('outings', { name: 'Sorties confirmées', importance: Notifications.AndroidImportance.DEFAULT });
  let permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) permission = await Notifications.requestPermissionsAsync();
  if (!permission.granted) throw new Error('Autorise les notifications dans les réglages de ton téléphone pour recevoir la confirmation.');
  token = expoPushTokenSchema.parse((await Notifications.getExpoPushTokenAsync({ projectId })).data);
  const result = await supabase.rpc('register_outing_push', { outing_id: outingId, push_token: token });
  if (result.error) throw new Error('Impossible d’activer les notifications. Réessaie.');
}

export async function disableConfirmationPush(): Promise<void> {
  if (!supabase) return;
  // Recover after an application restart without prompting for permission.
  if (!token) {
    const projectId = Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId || !(await Notifications.getPermissionsAsync()).granted) return;
    token = expoPushTokenSchema.parse((await Notifications.getExpoPushTokenAsync({ projectId })).data);
  }
  const result = await supabase.rpc('unregister_push_token', { push_token: token });
  if (result.error) throw new Error('Impossible de désactiver les notifications. Vérifie ta connexion et réessaie.');
  token = null;
}
