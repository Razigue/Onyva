import { useEffect, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { authProvidersSchema } from '@onyva/shared';
import type { z } from 'zod';
import { Button, Notice, ui } from './ui';
import { signIn, supabase } from '../lib/supabase';

// mode 'link' attaches Google or Apple to the current anonymous session, 'signin' opens an existing account.
export default function SignInButtons({ onError, mode = 'signin' }: { onError: (message: string) => void; mode?: 'link' | 'signin' }) {
  const [providers, setProviders] = useState<z.infer<typeof authProvidersSchema> | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    setFailed(false);
    void (async () => {
      const response = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY! }, signal: controller.signal });
      if (!response.ok) throw new Error('Connexion indisponible.');
      const value = authProvidersSchema.parse(await response.json());
      if (!cancelled) setProviders(value);
    })().catch(() => { if (!cancelled) setFailed(true); }).finally(() => clearTimeout(timer));
    return () => { cancelled = true; controller.abort(); clearTimeout(timer); };
  }, [attempt]);
  async function connect(provider: 'apple' | 'google') {
    setBusy(true); onError('');
    try { await signIn(provider, mode); }
    catch (cause) { onError(cause instanceof Error ? cause.message : 'La connexion n’a pas abouti. Réessaie.'); }
    finally { setBusy(false); }
  }
  if (!supabase) return null;
  if (failed) return <View style={{ gap: 10 }}><Notice warning>La connexion est indisponible pour le moment.</Notice><Button secondary onPress={() => setAttempt(attempt + 1)}>Réessayer la connexion</Button></View>;
  if (!providers) return <Text style={ui.body}>Chargement des moyens de connexion…</Text>;
  const google = providers.external.google && (Platform.OS !== 'ios' || providers.external.apple);
  return <View style={{ gap: 10 }}>
    {providers.external.apple && <Button secondary={mode === 'signin'} loading={busy} onPress={() => void connect('apple')}>{mode === 'link' ? 'Relier mon compte Apple' : 'Continuer avec Apple'}</Button>}
    {google && <Button secondary loading={busy} onPress={() => void connect('google')}>{mode === 'link' ? 'Relier mon compte Google' : 'Continuer avec Google'}</Button>}
    {!providers.external.apple && !google && <Notice>Aucun compte ne peut être relié sur cet appareil pour le moment.</Notice>}
  </View>;
}
