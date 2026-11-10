import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Body, Button, Card, Field, Notice, Shell, Subtitle, Title } from '../src/components/ui';
import { useStore } from '../src/lib/store';
import { supabase } from '../src/lib/supabase';
import SignInButtons from '../src/components/SignInButtons';
import { stopTracking } from '../src/lib/location-task';
import { disableConfirmationPush } from '../src/lib/notifications';

export default function Account() {
  const { userId, name, anonymous, saveName, clear } = useStore();
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  async function run(action: () => Promise<void>) {
    setBusy(true); setError(''); setMessage('');
    try { await action(); } catch (e) { setError(e instanceof Error ? e.message : 'Réessaie dans un instant.'); }
    finally { setBusy(false); }
  }
  async function leave() { await stopTracking(); await disableConfirmationPush(); await clear(); }
  return <Shell narrow><View className="mb-8 gap-5"><Title>{name ? `Salut ${name}.` : 'Des amis, pas des mots de passe.'}</Title><Body>Pas besoin de compte. Ton prénom et tes stations suffisent.</Body>
    {!supabase && <Notice warning>Le service n’est pas configuré sur cette version de l’application.</Notice>}
    <Field label="Ton prénom" value={draft ?? name} onChangeText={setDraft} maxLength={40} />
    <Button secondary loading={busy} disabled={!(draft ?? name).trim()} onPress={() => void run(async () => { await saveName(draft ?? name); setDraft(null); setMessage('Ton prénom est enregistré pour tes prochaines sorties.'); })}>Enregistrer mon prénom</Button>
    {userId && anonymous && <Card className="gap-3"><Subtitle>Changer de téléphone ?</Subtitle><Body>Tes sorties sont liées à ce téléphone. Relie un compte pour les retrouver ailleurs ou après une réinstallation. C’est facultatif.</Body><SignInButtons mode="link" onError={setError} /><Body className="text-small">J’ai déjà un compte :</Body><SignInButtons mode="signin" onError={setError} /></Card>}
    {userId && !anonymous && <Button secondary loading={busy} onPress={() => void run(async () => { await leave(); await supabase?.auth.signOut(); })}>Me déconnecter</Button>}
    {userId && <Button secondary onPress={() => setDeleting(!deleting)}>{anonymous ? 'Effacer mes données' : 'Supprimer mon compte'}</Button>}
    {deleting && <View className="gap-3.5"><Notice warning>Tes données et les sorties que tu organises seront supprimées. Cette action est définitive.</Notice><Button loading={busy} onPress={() => void run(async () => { await stopTracking(); const result = await supabase?.functions.invoke('delete-account'); if (result?.error) throw new Error('La suppression a échoué. Réessaie.'); await clear(); await supabase?.auth.signOut(); setDeleting(false); })}>Confirmer la suppression</Button></View>}
    <Button secondary onPress={() => router.push('/join')}>Rejoindre avec un code</Button>
    {!!message && <Notice>{message}</Notice>}
    {!!error && <Notice warning>{error}</Notice>}
    <Card className="mt-3"><Subtitle>Ta vie reste privée.</Subtitle><Body>On garde tes stations, jamais ton adresse. Les sorties disparaissent 24 h après leur fin. Aucun suivi publicitaire. Le partage de position est facultatif, temporaire et sans stockage en base.</Body><Body className="text-small">Sans compte relié, supprimer l’application efface l’accès à tes sorties.</Body><Button secondary loading={busy} onPress={() => void run(clear)}>Effacer la sortie sur cet appareil</Button></Card>
  </View></Shell>;
}
