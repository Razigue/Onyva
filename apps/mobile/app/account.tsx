import { router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { Button, colors, Notice, Shell, ui } from '../src/components/ui';
import { useStore } from '../src/lib/store';
import { supabase } from '../src/lib/supabase';
import SignInButtons from '../src/components/SignInButtons';
import { stopTracking } from '../src/lib/location-task';
import { disableConfirmationPush } from '../src/lib/notifications';

export default function Account() {
  const { userId, name, clear } = useStore();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  async function run(action: () => Promise<void>) {
    setBusy(true); setError('');
    try { await action(); } catch (e) { setError(e instanceof Error ? e.message : 'Réessaie dans un instant.'); }
    finally { setBusy(false); }
  }
  return <Shell narrow><View style={ui.section}><Text style={ui.title}>{userId ? `Salut ${name}.` : 'Des amis, pas des mots de passe.'}</Text><Text style={ui.body}>Connecte-toi pour retrouver ta sortie et rejoindre tes amis.</Text>
    {!supabase && <Notice warning>Tu explores des lieux réels avec des trajets simulés. La connexion et les invitations ne sont pas encore disponibles.</Notice>}
    {!userId ? <SignInButtons onError={setError} /> : <><Button secondary loading={busy} onPress={() => void run(async () => { await stopTracking(); await disableConfirmationPush(); await clear(); await supabase?.auth.signOut(); })}>Me déconnecter</Button><Button secondary onPress={() => setDeleting(!deleting)}>Supprimer mon compte</Button>{deleting && <View style={{ gap: 14 }}><Notice warning>Ton compte et les sorties que tu organises seront supprimés. Cette action est définitive.</Notice><Button loading={busy} onPress={() => void run(async () => { await stopTracking(); const result = await supabase?.functions.invoke('delete-account'); if (result?.error) throw new Error('La suppression a échoué. Réessaie.'); await clear(); await supabase?.auth.signOut(); setDeleting(false); })}>Confirmer la suppression</Button></View>}</>}
    <Button secondary onPress={() => router.push('/join')}>Rejoindre avec un code</Button>
    {!!error && <Notice warning>{error}</Notice>}
    <View style={{ ...ui.card, marginTop: 12 }}><Text style={ui.subtitle}>Ta vie reste privée.</Text><Text style={ui.body}>On garde tes stations, jamais ton adresse. Les sorties disparaissent 24 h après leur fin. Aucun suivi publicitaire. Le partage de position est facultatif, temporaire et sans stockage en base.</Text><Text style={{ color: colors.muted, fontSize: 13 }}>Les essais locaux restent sur cet appareil. Les sorties partagées utilisent ton compte.</Text><Button secondary loading={busy} onPress={() => void run(clear)}>Effacer la sortie sur cet appareil</Button></View>
  </View></Shell>;
}
