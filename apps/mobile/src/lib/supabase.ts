import type { Database } from '@onyva/shared/database';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

WebBrowser.maybeCompleteAuthSession();
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const storage = Platform.OS === 'web' ? AsyncStorage : {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};
export const supabase = url && key ? createClient<Database>(url, key, { auth: { storage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: Platform.OS === 'web', flowType: 'pkce' } }) : null;

let pendingSession: Promise<void> | null = null;
// Creates the invisible anonymous session when the device has none yet.
export function ensureSession(): Promise<void> {
  if (!supabase) return Promise.reject(new Error('Le service n’est pas configuré.'));
  const client = supabase;
  pendingSession ??= (async () => {
    const { data } = await client.auth.getSession();
    if (data.session) return;
    const { error } = await client.auth.signInAnonymously();
    if (error) throw new Error('Le service est indisponible pour le moment. Réessaie dans un instant.');
  })().finally(() => { pendingSession = null; });
  return pendingSession;
}

// 'link' keeps the current anonymous session and its outings; 'signin' switches to an existing account.
export async function signIn(provider: 'apple' | 'google', mode: 'link' | 'signin' = 'signin'): Promise<void> {
  if (!supabase) throw new Error('La connexion n’est pas encore disponible.');
  const redirectTo = Linking.createURL('/auth');
  const options = { redirectTo, skipBrowserRedirect: Platform.OS !== 'web' };
  const { data, error } = mode === 'link'
    ? await supabase.auth.linkIdentity({ provider, options })
    : await supabase.auth.signInWithOAuth({ provider, options });
  if (error) throw new Error(mode === 'link' ? 'Impossible de relier ce compte pour le moment. Réessaie dans un instant.' : 'La connexion est indisponible. Réessaie dans un instant.');
  if (Platform.OS !== 'web' && data.url) {
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type === 'success') {
      const url = new URL(result.url);
      const failure = url.searchParams.get('error_code') ?? new URLSearchParams(url.hash.slice(1)).get('error_code');
      if (failure) throw new Error(authErrorMessage(failure));
      const code = url.searchParams.get('code');
      if (code) {
        const exchange = await supabase.auth.exchangeCodeForSession(code);
        if (exchange.error) throw new Error('La connexion n’a pas abouti. Réessaie.');
      }
    }
  }
}

export function authErrorMessage(code: string): string {
  return code === 'identity_already_exists'
    ? 'Ce compte est déjà utilisé. Choisis « J’ai déjà un compte » pour le retrouver.'
    : 'La connexion n’a pas abouti. Réessaie.';
}
