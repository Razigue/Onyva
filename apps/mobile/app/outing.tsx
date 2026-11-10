import { useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, Share, Text, View, useWindowDimensions } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { MapPin } from 'lucide-react-native';
import { activityLabels, formatTime, venueReviewsUrl } from '@onyva/shared';
import type { Cuisine } from '@onyva/shared';
import LiveVenueMap from '../src/components/LiveVenueMap';
import ManualVenuePicker from '../src/components/ManualVenuePicker';
import { CalculationSteps } from '../src/components/outing/CalculationSteps';
import { ConvergenceMark } from '../src/components/outing/ConvergenceMark';
import { CuisineFilter } from '../src/components/outing/CuisineFilter';
import { EmptyGroup } from '../src/components/outing/EmptyGroup';
import { FirstCandidate } from '../src/components/outing/FirstCandidate';
import { OutingActions } from '../src/components/outing/OutingActions';
import { OutingHeader } from '../src/components/outing/OutingHeader';
import { ParticipantList } from '../src/components/outing/ParticipantList';
import { ResultCard } from '../src/components/outing/ResultCard';
import { Body, Button, Caption, cx, Notice, Shell, Subtitle, Title } from '../src/components/ui';
import { addToCalendar } from '../src/lib/calendar';
import { startTracking, stopTracking } from '../src/lib/location-task';
import { disableConfirmationPush, enableConfirmationPush } from '../src/lib/notifications';
import { useStore } from '../src/lib/store';
import { palette } from '../src/theme';

export default function OutingScreen() {
  const store = useStore();
  const { outing, results, stations, busy, cached, error, userId, coverage } = store;
  const wide = useWindowDimensions().width >= 1150;
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [cuisine, setCuisine] = useState<Cuisine | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [pushEnabledFor, setPushEnabledFor] = useState<string | null>(null);
  const mapStations = useMemo(() => stations.filter(s => outing?.participants.some(p => p.departureId === s.id)), [stations, outing?.participants]);
  const availableCuisines = [...new Set(results?.recommendations.flatMap(r => r.venue.cuisines ?? []) ?? [])];
  const activeCuisine = cuisine && availableCuisines.includes(cuisine) ? cuisine : null;
  const visibleResults = results?.recommendations.filter(r => !activeCuisine || r.venue.cuisines?.includes(activeCuisine)) ?? [];
  if (!store.ready) return <Shell><ActivityIndicator accessibilityLabel="Chargement de ta sortie" color={palette.brand} /></Shell>;
  if (!outing) return <Shell narrow><View className="mb-8 gap-5">
    <Title>La prochaine sortie commence ici.</Title>
    <Body>Tu n’as pas encore de sortie en cours. Invite tes amis et trouvons votre point de rencontre.</Body>
    <Button onPress={() => router.push('/create')}>Créer une sortie</Button>
  </View></Shell>;
  const owner = outing.ownerId === userId;
  const confirmed = results?.recommendations.find(r => r.venue.id === outing.confirmedVenueId);
  const canEdit = owner && !outing.confirmedVenueId;
  /** Runs a user action with one shared busy and error state. Resolves to true when it succeeded. */
  async function action(fn: () => Promise<void>): Promise<boolean> {
    setSaving(true); store.setError(null); setMessage('');
    try { await fn(); return true; } catch (cause) { store.setError(cause instanceof Error ? cause.message : 'Réessaie dans un instant.'); return false; }
    finally { setSaving(false); }
  }
  async function share() {
    if (!outing) return;
    const base = process.env.EXPO_PUBLIC_INVITE_URL;
    if (!base) { setMessage('Le lien d’invitation n’est pas encore configuré.'); return; }
    const url = `${base.replace(/\/$/, '')}/join?code=${encodeURIComponent(outing.inviteCode)}`;
    const text = confirmed ? `On se retrouve à ${confirmed.venue.name} à ${formatTime(outing.startsAt)} ! ${url}` : `${activityLabels[outing.activity]} à ${formatTime(outing.startsAt)} ? Rejoins la sortie et ajoute ta station. ${url}`;
    if (Platform.OS === 'web') {
      if (navigator.share) await navigator.share({ title: 'On se retrouve avec Onyva', text });
      else { await navigator.clipboard.writeText(text); setMessage('Le message d’invitation est copié. Colle-le dans votre groupe.'); }
    } else await Share.share({ message: text });
  }
  const cards = confirmed ? [confirmed] : visibleResults;
  return <Shell><View className="gap-7">
    <OutingHeader outing={outing} />
    {cached && <Notice>{`Dernière version enregistrée · ${formatTime(outing.updatedAt)}. Actualise avant de choisir un lieu.`}</Notice>}
    {!!error && <View className="gap-2.5"><Notice warning>{error}</Notice><Button secondary onPress={() => void store.refresh()}>Réessayer</Button></View>}
    {!!message && <Notice>{message}</Notice>}
    <View className={cx('items-start gap-7', wide ? 'flex-row' : 'flex-col')}>
      <View className={cx('gap-5', wide ? 'w-[300px]' : 'w-full')}>
        <ParticipantList outing={outing} stations={stations} canEdit={canEdit} saving={saving}
          onRemove={id => void action(() => store.remove(id))}
          onAdd={(name, departure, returnStation) => action(() => store.add(name, departure, returnStation))} />
        <OutingActions outing={outing} confirmed={!!confirmed} saving={saving} pushEnabled={pushEnabledFor === outing.id}
          onShare={() => void action(share)}
          onCopyCode={() => void action(async () => { await Clipboard.setStringAsync(outing.shortCode!); setMessage('Code copié. Tes amis peuvent le saisir dans « Rejoindre avec un code ».'); })}
          onStartTracking={() => void action(async () => { await startTracking(outing.id); setMessage('Ta position reste entre vous. Le partage s’arrête à ton arrivée ou après 90 min.'); })}
          onStopTracking={() => void action(async () => { await stopTracking(); setMessage('Le partage de ta position est arrêté.'); })}
          onCalendar={() => void action(() => addToCalendar(outing, confirmed!.venue))}
          onTogglePush={() => void action(async () => {
            if (pushEnabledFor === outing.id) { await disableConfirmationPush(); setPushEnabledFor(null); setMessage('Les notifications sont désactivées sur ce téléphone.'); }
            else { await enableConfirmationPush(outing.id); setPushEnabledFor(outing.id); setMessage('Tu recevras une notification quand le lieu sera confirmé.'); }
          })} />
      </View>
      <View className="w-full flex-1 gap-5">
        <View className="flex-row items-center justify-between gap-3">
          <View className="flex-row items-center gap-2">{!!results?.recommendations.length && <ConvergenceMark replay={results.computedAt} />}<Subtitle>{confirmed ? 'Votre point de rencontre' : 'Les lieux pour vous'}</Subtitle></View>
          {results && <Pressable accessibilityRole="button" onPress={() => setShowMap(!showMap)} className="min-h-[44px] flex-row items-center gap-3">
            <MapPin size={16} color={palette.brand} /><Text className="text-small text-brand">{showMap ? 'Masquer la carte' : 'Voir la carte'}</Text>
          </Pressable>}
        </View>
        {!confirmed && outing.activity === 'dinner' && !!results?.recommendations.length && <CuisineFilter available={availableCuisines} active={activeCuisine} onChange={setCuisine} />}
        {showMap && <LiveVenueMap outing={outing} stations={mapStations} venues={visibleResults.map(r => r.venue)} />}
        {busy && <CalculationSteps progress={results?.progress} manualChoice={!!outing.selectedVenue} />}
        {busy && !!results?.stationCandidates?.length && !results.recommendations.length && <FirstCandidate candidate={results.stationCandidates[0]!} stations={stations} participants={outing.participants} />}
        {!confirmed && <>
          {coverage?.ready === false && <Notice>La recherche du juste milieu est en pause. L’organisateur peut choisir un lieu et faire vérifier les allers et retours.</Notice>}
          {canEdit && <ManualVenuePicker outing={outing} stations={stations} findVenues={store.findVenues} disabled={saving || busy || cached} selectVenue={venue => action(() => store.selectVenue(venue)).then(() => undefined)} />}
          {!canEdit && outing.selectedVenue && !results?.recommendations.length && <Notice>Lieu choisi : {outing.selectedVenue.name}. Les allers et retours restent à vérifier.</Notice>}
        </>}
        {outing.participants.length < 2 && coverage?.ready && <EmptyGroup />}
        {!busy && results?.progress?.stage === 'complete' && results.recommendations.length === 0 && <Notice warning>Aucun lieu ne permet de réunir tout le monde avec un retour vérifié. Essaie une sortie plus tôt ou un autre type de lieu.</Notice>}
        {cards.map(recommendation => {
          const id = recommendation.venue.id, votes = store.reactions.filter(r => r.venueId === id), liked = votes.some(r => r.userId === userId);
          return <ResultCard key={id} recommendation={recommendation} index={confirmed ? 0 : results!.recommendations.indexOf(recommendation)} outing={outing} stations={stations}
            best={!outing.selectedVenue && id === results?.recommendations[0]?.venue.id} replay={results?.computedAt ?? ''} votes={votes.length} liked={liked} expanded={expanded === id}
            reactDisabled={!!outing.confirmedVenueId || saving || busy || cached} canConfirm={canEdit} confirmDisabled={busy || cached} saving={saving}
            onToggle={() => setExpanded(expanded === id ? null : id)}
            onReact={() => void action(() => store.react(id, !liked))}
            onConfirm={() => void action(() => store.confirm(id))}
            onReviews={() => void action(() => Linking.openURL(venueReviewsUrl(recommendation.venue)))} />;
        })}
        {results && <Pressable accessibilityRole="link" accessibilityLabel="Crédits et licence OpenStreetMap" onPress={() => void action(() => Linking.openURL('https://www.openstreetmap.org/copyright'))} className="min-h-[44px] justify-center">
          <Text className="text-caption text-brand">Lieux : © les contributeurs OpenStreetMap · ODbL ↗</Text>
        </Pressable>}
        {results && <Caption className="leading-[19px]">Horaires théoriques · calcul à {formatTime(results.computedAt)}. {results.warnings.join(' ')}</Caption>}
      </View>
    </View>
  </View></Shell>;
}
