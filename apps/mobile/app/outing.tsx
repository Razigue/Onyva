import { useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, Share, Text, View, useWindowDimensions } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { Check, ChevronDown, Clock3, MapPin, Plus, Share2, Trash2, Users, ThumbsUp } from 'lucide-react-native';
import { activityLabels, cuisineLabels, formatTime, venueReviewsUrl } from '@onyva/shared';
import type { Cuisine, Recommendation } from '@onyva/shared';
import { Button, colors, Field, Notice, Shell, StationPicker, ui } from '../src/components/ui';
import LiveVenueMap from '../src/components/LiveVenueMap';
import ManualVenuePicker from '../src/components/ManualVenuePicker';
import {startTracking,stopTracking} from '../src/lib/location-task';
import { useStore } from '../src/lib/store';
import { addToCalendar } from '../src/lib/calendar';
import { disableConfirmationPush, enableConfirmationPush } from '../src/lib/notifications';

const personColors = ['#2E5BFF', '#A75529', '#647632', '#7756A1', '#267479'];
function minutes(seconds: number) { return Math.ceil(seconds / 60); }

export default function OutingScreen() {
  const store = useStore();
  const { outing, results, stations, busy, cached, error, userId, coverage } = store;
  const wide = useWindowDimensions().width >= 1150;
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [departure, setDeparture] = useState('montreuil');
  const [returnStation, setReturnStation] = useState('');
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
  const mapVenues = visibleResults.map(r => r.venue);
  if (!store.ready) return <Shell><ActivityIndicator accessibilityLabel="Chargement de ta sortie" color={colors.blue} /></Shell>;
  if (!outing) return <Shell narrow><View style={ui.section}><Text style={ui.title}>La prochaine sortie commence ici.</Text><Text style={ui.body}>Tu n’as pas encore de sortie en cours. Invite tes amis et trouvons votre point de rencontre.</Text><Button onPress={() => router.push('/create')}>Créer une sortie</Button></View></Shell>;
  const owner = outing.mode === 'demo' || outing.ownerId === userId;
  const confirmed = results?.recommendations.find(r => r.venue.id === outing.confirmedVenueId);
  const canEdit = owner && !outing.confirmedVenueId;
  async function action(fn: () => Promise<void>) {
    setSaving(true); store.setError(null); setMessage('');
    try { await fn(); } catch (cause) { store.setError(cause instanceof Error ? cause.message : 'Réessaie dans un instant.'); }
    finally { setSaving(false); }
  }
  async function share() {
    if (!outing) return;
    if (outing.mode === 'demo') { setMessage('Cet essai reste sur ton appareil. Le partage entre plusieurs téléphones n’est pas encore disponible.'); return; }
    const base = process.env.EXPO_PUBLIC_INVITE_URL;
    if (!base) { setMessage('Le lien d’invitation n’est pas encore configuré.'); return; }
    const url = `${base.replace(/\/$/, '')}/join?code=${encodeURIComponent(outing.inviteCode)}`;
    const text = confirmed ? `On se retrouve à ${confirmed.venue.name} à ${formatTime(outing.startsAt)} ! ${url}` : `${activityLabels[outing.activity]} à ${formatTime(outing.startsAt)} ? Rejoins la sortie et ajoute ta station. ${url}`;
    if (Platform.OS === 'web') {
      if (navigator.share) await navigator.share({ title: 'On se retrouve avec Onyva', text });
      else { await navigator.clipboard.writeText(text); setMessage('Le message d’invitation est copié. Colle-le dans votre groupe.'); }
    } else await Share.share({ message: text });
  }
  function venueCard(recommendation: Recommendation, index: number) {
    const selected = recommendation.venue.id === outing?.confirmedVenueId;
    const best = !outing?.selectedVenue && recommendation.venue.id === results?.recommendations[0]?.venue.id;
    const votes = store.reactions.filter(r => r.venueId === recommendation.venue.id);
    const liked = votes.some(r => r.userId === (outing?.mode === 'demo' ? '00000000-0000-4000-8000-000000000000' : userId));
    return <View key={recommendation.venue.id} style={{ ...ui.card, borderColor: best ? '#C8DE7E' : colors.border, backgroundColor: best ? '#FBFCF5' : 'white', gap: 20 }}>
      <View style={ui.between}><View style={{ paddingHorizontal: 12, paddingVertical: 7, backgroundColor: best ? colors.lime : '#F0F1F3', borderRadius: 50 }}><Text style={{ fontSize: 12, fontWeight: '600', color: colors.ink }}>{selected ? 'Lieu confirmé' : outing?.selectedVenue ? 'Lieu choisi par le groupe' : best ? 'Le plus équilibré' : `Autre idée · ${index + 1}`}</Text></View><Text style={{ fontSize: 12, color: colors.muted }}>{recommendation.venue.source === 'demo' ? 'Lieu fictif' : 'OpenStreetMap'}</Text></View>
      <View style={{ gap: 7 }}><Text style={{ ...ui.subtitle, fontSize: 24 }}>{recommendation.venue.name}</Text><View style={ui.row}><MapPin size={14} color={colors.muted} /><Text style={ui.body}>{recommendation.venue.neighborhood} · {minutes(recommendation.venue.walkSeconds)} min à pied</Text></View></View>
      {!!recommendation.venue.cuisines?.length && <Text style={ui.body}>{recommendation.venue.cuisines.map(value => cuisineLabels[value]).join(' · ')}</Text>}
      {recommendation.venue.kind === 'dinner' && !recommendation.venue.cuisines?.length && <Text style={ui.body}>Cuisine non renseignée</Text>}
      {recommendation.venue.source !== 'demo' && <Pressable accessibilityRole="link" accessibilityLabel={`Consulter les avis Google pour ${recommendation.venue.name}`} onPress={() => void action(() => Linking.openURL(venueReviewsUrl(recommendation.venue)))} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: colors.blue }}>Consulter les avis Google ↗</Text><Text style={{ ...ui.body, fontSize: 12 }}>Vérifie la note et les avis avant de choisir.</Text></Pressable>}
      <View style={{ gap: 13 }}>{recommendation.journeys.map((journey, i) => {
        const person = outing?.participants.find(p => p.id === journey.participantId);
        return <View key={journey.participantId} accessible accessibilityLabel={`${person?.name} : ${minutes(journey.outbound.duration)} minutes`} style={{ gap: 7 }}><View style={ui.between}><Text style={{ fontSize: 14, color: colors.ink }}>{person?.name}</Text><Text style={{ color: colors.ink, fontSize: 14, fontWeight: '600', fontVariant: ['tabular-nums'] }}>{minutes(journey.outbound.duration)} min</Text></View><View style={{ height: 7, borderRadius: 5, backgroundColor: '#E9EBE5' }}><View style={{ width: `${Math.max(2, journey.outbound.duration / Math.max(60, recommendation.maximum) * 100)}%`, height: 7, borderRadius: 5, backgroundColor: personColors[i % personColors.length] }} /></View></View>;
      })}</View>
      <View style={{ flexDirection: 'row', gap: 24, borderTopWidth: 1, borderColor: colors.border, paddingTop: 18 }}><View style={{ gap: 4 }}><Text style={{ color: colors.ink, fontSize: 21, fontWeight: '600' }}>{minutes(recommendation.maximum)} min</Text><Text style={{ color: colors.muted, fontSize: 12 }}>le trajet le plus long</Text></View><View style={{ gap: 4 }}><Text style={{ color: colors.ink, fontSize: 21, fontWeight: '600' }}>{minutes(recommendation.spread)} min</Text><Text style={{ color: colors.muted, fontSize: 12 }}>d’écart entre vous</Text></View></View>
      <View style={{ ...ui.row, alignItems: 'flex-start' }}><Check size={18} color={outing?.mode === 'demo' ? colors.muted : colors.green} /><View style={{ flex: 1, gap: 3 }}><Text style={{ color: colors.ink, fontSize: 14, fontWeight: '500' }}>{outing?.mode === 'demo' ? 'Retour simulé pour tout le monde' : `Un retour prévu après ${formatTime(outing!.endsAt)}`}</Text><Text style={{ ...ui.body, fontSize: 12, lineHeight: 18 }}>{recommendation.journeys.some(j => j.inbound.night) ? 'Un trajet de retour utilise un bus de nuit.' : 'Marche, attente et correspondances incluses.'}</Text></View></View>
      <Pressable accessibilityRole="button" onPress={() => setExpanded(expanded === recommendation.venue.id ? null : recommendation.venue.id)} style={{ ...ui.between, minHeight: 44 }}><Text style={{ color: colors.blue, fontSize: 14, fontWeight: '500' }}>Voir les trajets aller et retour</Text><ChevronDown size={18} color={colors.blue} /></Pressable>
      {expanded === recommendation.venue.id && <View style={{ gap: 18 }}>{recommendation.journeys.map(journey => <View key={journey.participantId} style={{ gap: 6 }}><Text style={{ fontWeight: '600', color: colors.ink }}>{outing?.participants.find(p => p.id === journey.participantId)?.name}</Text>{([['Aller', journey.outbound], ['Retour', journey.inbound]] as const).map(([label, trip]) => <View key={label} style={{ gap: 4 }}><Text style={{ fontSize: 13, color: colors.ink }}>{label} · {formatTime(trip.departure)} → {formatTime(trip.arrival)} · {minutes(trip.duration)} min</Text>{trip.legs.map((leg, i) => <Text key={i} style={{ fontSize: 12, color: colors.muted, lineHeight: 19 }}>{leg.mode === 'walk' ? 'À pied' : leg.mode === 'wait' ? 'Attente' : `Ligne ${leg.line}`} · {leg.fromName ?? stations.find(s => s.id === leg.from)?.name ?? recommendation.venue.name} → {leg.toName ?? stations.find(s => s.id === leg.to)?.name ?? recommendation.venue.name}</Text>)}</View>)}</View>)}</View>}
      <Pressable accessibilityRole="button" accessibilityLabel={`Ça me plaît : ${recommendation.venue.name}`} aria-pressed={liked} accessibilityState={{ selected: liked, disabled: !!outing?.confirmedVenueId || saving || busy || (cached && outing?.mode === 'live') }} disabled={!!outing?.confirmedVenueId || saving || busy || (cached && outing?.mode === 'live')} onPress={() => void action(() => store.react(recommendation.venue.id, !liked))} style={{ ...ui.row, minHeight: 44 }}><ThumbsUp size={18} color={liked ? colors.blue : colors.muted} /><Text style={{ color: liked ? colors.blue : colors.muted }}>{liked ? 'Ça me plaît !' : 'Ça me plaît'} · {votes.length}</Text></Pressable>
      {canEdit && <Button secondary={!best} disabled={busy || (cached && outing?.mode === 'live')} loading={saving} onPress={() => void action(() => store.confirm(recommendation.venue.id))}>{best ? 'On se retrouve ici' : 'Choisir ce lieu'}</Button>}
    </View>;
  }
  return <Shell><View style={{ gap: 28 }}>
    <View style={{ gap: 12 }}><View style={ui.between}><Text style={ui.label}>{outing.confirmedVenueId ? 'LE RENDEZ-VOUS EST PRIS' : 'TA SORTIE · ÉTAPE 4 / 4'}</Text><Text style={ui.label}>{outing.mode === 'demo' ? 'ESSAI LOCAL' : 'SORTIE PARTAGÉE'}</Text></View><Text accessibilityRole="header" style={ui.title}>{outing.confirmedVenueId ? 'C’est décidé. On y va !' : 'Des amis. Un même point.'}</Text><View style={{ ...ui.row, flexWrap: 'wrap' }}><Text style={ui.body}>{activityLabels[outing.activity]}</Text><Text style={ui.body}>·</Text><Clock3 size={16} color={colors.muted} /><Text style={ui.body}>{new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'long' }).format(new Date(outing.startsAt))} · {formatTime(outing.startsAt)} à {formatTime(outing.endsAt)}</Text></View></View>
    {outing.mode === 'demo' && <Notice warning>Les lieux sont réels. Les temps de trajet et les retours sont simulés : vérifie ton trajet avant de partir.</Notice>}
    {cached && <Notice>{outing.mode === 'demo' ? 'Ton dernier essai est enregistré sur cet appareil.' : `Dernière version enregistrée · ${formatTime(outing.updatedAt)}. Actualise avant de choisir un lieu.`}</Notice>}
    {!!error && <View style={{ gap: 10 }}><Notice warning>{error}</Notice><Button secondary onPress={() => void store.refresh()}>Réessayer</Button></View>}
    {!!message && <Notice>{message}</Notice>}
    <View style={{ flexDirection: wide ? 'row' : 'column', gap: 28, alignItems: 'flex-start' }}>
      <View style={{ width: wide ? 300 : '100%', gap: 20 }}><View style={ui.card}>
        <View style={ui.between}><Text style={ui.subtitle}>La bande</Text><View style={{ backgroundColor: '#F0F1F3', paddingVertical: 5, paddingHorizontal: 10, borderRadius: 20 }}><Text style={{ fontSize: 12, fontWeight: '600', color: colors.muted }}>{outing.participants.length} / 10</Text></View></View>
        {outing.participants.map((p, i) => <View key={p.id} style={ui.row}><View style={{ width: 38, height: 38, borderRadius: 38, backgroundColor: ['#E6ECFF', '#FAE8DC', '#EAF0D8', '#EDE6F5'][i % 4], alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: colors.ink, fontWeight: '600' }}>{p.name.charAt(0).toUpperCase()}</Text></View><View style={{ flex: 1, gap: 3 }}><Text style={{ fontSize: 14, fontWeight: '600', color: colors.ink }}>{p.name}{i === 0 ? ' · organise' : ''}</Text><Text style={{ fontSize: 12, color: colors.muted }}>{stations.find(s => s.id === p.departureId)?.name ?? p.departureId}</Text></View>{canEdit && i > 0 && <Pressable accessibilityRole="button" accessibilityLabel={`Retirer ${p.name}`} disabled={saving} onPress={() => void action(() => store.remove(p.id))} style={{ padding: 12 }}><Trash2 size={16} color={colors.muted} /></Pressable>}</View>)}
        {canEdit && outing.participants.length < 10 && <Pressable accessibilityRole="button" onPress={() => { setAdding(!adding); setDeparture(stations.find(s => s.id === 'montreuil')?.id ?? stations[0]?.id ?? ''); }} style={{ ...ui.row, minHeight: 48, borderTopWidth: 1, borderColor: colors.border, paddingTop: 12 }}><Plus size={18} color={colors.blue} /><Text style={{ color: colors.blue, fontWeight: '500', fontSize: 14 }}>Ajouter un ami</Text></Pressable>}
        {adding && canEdit && <View style={{ gap: 14 }}><Field label="Son prénom" value={name} onChangeText={setName} maxLength={40} /><StationPicker label="Son départ" stations={stations} value={departure} onChange={setDeparture} /><StationPicker label="Son retour" stations={stations} value={returnStation || departure} onChange={setReturnStation} /><Button loading={saving} disabled={!name.trim()} onPress={() => void action(async () => { await store.add(name.trim(), departure, returnStation || departure); setAdding(false); setName(''); setReturnStation(''); })}>Ajouter au groupe</Button></View>}
      </View>
      <Pressable accessibilityRole="button" onPress={() => void action(share)} style={{ ...ui.row, justifyContent: 'center', minHeight: 48 }}><Share2 size={16} color={colors.blue} /><Text style={{ color: colors.blue, fontWeight: '600' }}>{confirmed ? 'Partager le rendez-vous' : 'Inviter mes amis'}</Text></Pressable>
      {outing.mode === 'live' && outing.shortCode && <View style={{ gap: 10 }}><Text style={ui.body}>Code d’invitation : {outing.shortCode}</Text><Button secondary onPress={() => void action(async () => { await Clipboard.setStringAsync(outing.shortCode!); setMessage('Code copié. Tes amis peuvent le saisir dans « Rejoindre avec un code ».'); })}>Copier le code d’invitation</Button></View>}
      {confirmed && outing.mode === 'live' && Platform.OS !== 'web' && <><Button secondary loading={saving} onPress={() => void action(async () => {await startTracking(outing.id);setMessage('Ta position reste entre vous. Le partage s’arrête à ton arrivée ou après 90 min.');})}>Je suis en route</Button><Button secondary loading={saving} onPress={() => void action(async () => {await stopTracking();setMessage('Le partage de ta position est arrêté.');})}>Je suis arrivé</Button></>}
      {confirmed && <Button secondary loading={saving} onPress={() => void action(() => addToCalendar(outing, confirmed.venue))}>Ajouter au calendrier</Button>}
      {outing.mode === 'live' && !confirmed && Platform.OS !== 'web' && <Button secondary loading={saving} onPress={() => void action(async () => {
        if (pushEnabledFor === outing.id) { await disableConfirmationPush(); setPushEnabledFor(null); setMessage('Les notifications sont désactivées sur ce téléphone.'); }
        else { await enableConfirmationPush(outing.id); setPushEnabledFor(outing.id); setMessage('Tu recevras une notification quand le lieu sera confirmé.'); }
      })}>{pushEnabledFor === outing.id ? 'Désactiver les notifications' : 'Me prévenir du lieu choisi'}</Button>}
      <View style={{ paddingHorizontal: 8, gap: 10 }}><Text style={ui.label}>Juste ce qu’il faut savoir.</Text><Text style={{ ...ui.body, fontSize: 13 }}>Tes stations restent entre vous. La sortie est effacée 24 h après sa fin.</Text></View></View>
      <View style={{ flex: 1, width: '100%', gap: 20 }}>
        <View style={ui.between}><Text style={ui.subtitle}>{confirmed ? 'Votre point de rencontre' : 'Les lieux pour vous'}</Text>{results && <Pressable accessibilityRole="button" onPress={() => setShowMap(!showMap)} style={{ ...ui.row, minHeight: 44 }}><MapPin size={16} color={colors.blue} /><Text style={{ color: colors.blue, fontSize: 14 }}>{showMap ? 'Masquer la carte' : 'Voir la carte'}</Text></Pressable>}</View>
        {!confirmed && outing.activity === 'dinner' && !!results?.recommendations.length && <View style={{ gap: 12 }}><Text style={ui.body}>Jusqu’à 12 restos pour varier les envies. Le premier garde les trajets les plus équilibrés. Les cuisines dépendent des infos disponibles.</Text><View style={{ ...ui.row, flexWrap: 'wrap' }}>{[null, ...availableCuisines].map(value => <Pressable key={value ?? 'all'} accessibilityRole="button" accessibilityState={{ selected: activeCuisine === value }} onPress={() => setCuisine(value)} style={{ padding: 12, borderRadius: 24, backgroundColor: activeCuisine === value ? colors.lime : '#F0F1F3' }}><Text style={{ color: colors.ink }}>{value ? cuisineLabels[value] : 'Tous les restos'}</Text></Pressable>)}</View></View>}
        {showMap && <LiveVenueMap outing={outing} stations={mapStations} venues={mapVenues} />}
        {busy && <View style={{ ...ui.card, alignItems: 'center' }}><ActivityIndicator color={colors.blue} /><Text style={ui.body}>{results?.progress?.stage === 'returns' ? `On vérifie les allers et retours… ${results.progress.completed} / ${results.progress.total}` : results?.progress ? `On compare les trajets… ${results.progress.completed} / ${results.progress.total}` : 'On compare les trajets pour vous…'}</Text></View>}
        {busy && !!results?.stationCandidates?.length && <View style={ui.card}><Text style={ui.subtitle}>Un premier point de rencontre</Text><Text style={ui.body}>{stations.find(s=>s.id===results.stationCandidates![0]!.stationId)?.name ?? 'Station en cours de vérification'}</Text><Text style={ui.body}>Retour en cours de vérification. Tu pourras choisir un lieu dès que le calcul sera terminé.</Text></View>}
        {outing.mode === 'live' && !confirmed && <>
          {coverage?.ready === false && <Notice>La recherche du juste milieu est en pause. L’organisateur peut choisir un lieu et faire vérifier les allers et retours.</Notice>}
          {canEdit && <ManualVenuePicker outing={outing} stations={stations} findVenues={store.findVenues} disabled={saving || busy || cached} selectVenue={venue => action(() => store.selectVenue(venue))} />}
          {!canEdit && outing.selectedVenue && !results?.recommendations.length && <Notice>Lieu choisi : {outing.selectedVenue.name}. Les allers et retours restent à vérifier.</Notice>}
        </>}
        {outing.participants.length < 2 && (outing.mode === 'demo' || coverage?.ready) && <View style={{ ...ui.card, alignItems: 'center', paddingVertical: 48 }}><Users size={36} color={colors.blue} /><Text style={ui.subtitle}>Il ne manque qu’un ami.</Text><Text style={{ ...ui.body, textAlign: 'center', maxWidth: 350 }}>Ajoute un deuxième départ pour découvrir les lieux les plus équilibrés.</Text></View>}
        {!busy && (results?.source === 'demo' || results?.progress?.stage === 'complete') && results?.recommendations.length === 0 && <Notice warning>{outing.mode === 'demo' ? 'Aucun lieu du catalogue ne correspond à ce créneau. Essaie plus tôt, ou choisis un resto, un verre ou un café.' : 'Aucun lieu ne permet de réunir tout le monde avec un retour vérifié. Essaie une sortie plus tôt ou un autre type de lieu.'}</Notice>}
        {(confirmed ? [venueCard(confirmed, 0)] : visibleResults.map(r => venueCard(r, results!.recommendations.indexOf(r))))}
        {results && <Pressable accessibilityRole="link" accessibilityLabel="Crédits et licence OpenStreetMap" onPress={() => void action(() => Linking.openURL('https://www.openstreetmap.org/copyright'))} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ fontSize: 12, color: colors.blue }}>Lieux : © les contributeurs OpenStreetMap · ODbL ↗</Text></Pressable>}
        {results && <Text style={{ fontSize: 12, lineHeight: 19, color: colors.muted }}>{results.source === 'demo' ? 'Simulation' : 'Horaires théoriques'} · calcul à {formatTime(results.computedAt)}. {results.warnings.join(' ')}</Text>}
      </View>
    </View>
  </View></Shell>;
}
