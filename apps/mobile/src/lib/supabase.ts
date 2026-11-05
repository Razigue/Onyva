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

export async function signIn(provider: 'apple' | 'google'): Promise<void> {
  if (!supabase) throw new Error('La connexion n’est pas encore disponible. Tu peux essayer la démo.');
  const redirectTo = Linking.createURL('/auth');
  const { data, error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo, skipBrowserRedirect: Platform.OS !== 'web' } });
  if (error) throw new Error('La connexion est indisponible. Réessaie dans un instant.');
  if (Platform.OS !== 'web' && data.url) {
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type === 'success') {
      const code = new URL(result.url).searchParams.get('code');
      if (code) {
        const exchange = await supabase.auth.exchangeCodeForSession(code);
        if (exchange.error) throw new Error('La connexion n’a pas abouti. Réessaie.');
      }
    }
  }
}
