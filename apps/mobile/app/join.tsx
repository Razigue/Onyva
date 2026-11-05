import {normalizeInviteCode} from '@onyva/shared';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Button, Field, Notice, Shell, StationPicker, ui } from '../src/components/ui';
import { useStore } from '../src/lib/store';
import { supabase } from '../src/lib/supabase';

export default function Join() {
  const params = useLocalSearchParams<{ code?: string }>();
  const [enteredCode, setEnteredCode] = useState(typeof params.code === 'string' ? params.code : '');
  const code = normalizeInviteCode(enteredCode) ?? '';
  useEffect(() => { if (typeof params.code === 'string') setEnteredCode(params.code); }, [params.code]);
  const store = useStore();
  const [name, setName] = useState<string | null>(null);
  const person = (name ?? store.name).trim();
  const [departure, setDeparture] = useState('');
  const [returnStation, setReturnStation] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (code) void AsyncStorage.setItem('onyva:pending-invite', code); }, [code]);
  async function join() {
    setBusy(true); setError('');
    try { await store.saveName(person); await store.join(code, person, departure, returnStation || departure); await AsyncStorage.removeItem('onyva:pending-invite'); router.replace('/outing'); }
    catch { setError('Impossible de rejoindre cette sortie. Le lien a peut-être expiré, le groupe est complet ou le lieu est déjà confirmé.'); }
    finally { setBusy(false); }
  }
  return <Shell narrow><View style={ui.section}><Text style={ui.title}>Il y a une place pour toi.</Text><Text style={ui.body}>Ajoute ta station pour rejoindre tes amis.</Text>
    <Field label="Code d’invitation" value={enteredCode} onChangeText={setEnteredCode} maxLength={100} />
    {!code ? <Notice>Colle ton lien ou saisis les 8 caractères du code d’invitation.</Notice> : !supabase ? <Notice warning>Le service n’est pas configuré sur cette version de l’application.</Notice> : !store.userId ? <Notice warning={store.sessionFailed}>{store.sessionFailed ? 'Le service est injoignable. Vérifie ta connexion internet, on réessaie tout seuls.' : 'On prépare ta session…'}</Notice> : <><Field label="Ton prénom" value={name ?? store.name} onChangeText={setName} maxLength={40} /><StationPicker stations={store.stations} value={departure} onChange={setDeparture} /><StationPicker label="Ta station de retour (même station par défaut)" stations={store.stations} value={returnStation || departure} onChange={setReturnStation} /><Button loading={busy} disabled={!person || !departure} onPress={() => void join()}>Je rejoins la bande</Button></>}
    {!!error && <Notice warning>{error}</Notice>}
  </View></Shell>;
}
