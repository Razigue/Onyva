import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, Coffee, GlassWater, Utensils, Sparkles } from 'lucide-react-native';
import { activityLabels, defaultStart } from '@onyva/shared';
import type { Outing } from '@onyva/shared';
import { Button, Chip, colors, Field, Notice, Shell, StationPicker, ui } from '../src/components/ui';
import SignInButtons from '../src/components/SignInButtons';
import { useStore } from '../src/lib/store';
import { supabase } from '../src/lib/supabase';

function parisParts(date: Date) { const parts = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date).split(' '); return { day: parts[0]!, time: parts[1]! }; }
// Resolve an explicit Paris wall time; reject nonexistent DST times instead of silently moving them.
export function parisDate(day: string, time: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;
  const utc = Date.parse(`${day}T${time}:00Z`);
  for (const offset of [2, 1]) { const date = new Date(utc - offset * 3600_000); if (!Number.isFinite(date.getTime())) continue; const parts = parisParts(date); if (parts.day === day && parts.time === time) return date; }
  return null;
}

export default function Create() {
  const { create, stations, userId, outing, coverage } = useStore();
  const initial = parisParts(defaultStart());
  const [step, setStep] = useState(0);
  const [day, setDay] = useState(initial.day);
  const [time, setTime] = useState(initial.time);
  const [duration, setDuration] = useState(150);
  const [activity, setActivity] = useState<Outing['activity']>('drinks');
  const [station, setStation] = useState(outing?.participants[0]?.departureId ?? stations[0]?.id ?? '');
  const [demo, setDemo] = useState(false);
  const usingDemo = !supabase || !userId || demo;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (stations.length && !stations.some(candidate => candidate.id === station)) setStation(stations[0]!.id);
  }, [stations, station]);
  async function next() {
    setError('');
    const starts = parisDate(day, time);
    if (!starts || starts.getTime() < Date.now()) { setError('Choisis une date et une heure à venir, à l’heure de Paris.'); return; }
    if (step < 2) { setStep(step + 1); return; }
    if (!stations.some(s => s.id === station)) { setError('Choisis ta station de départ.'); return; }
    setBusy(true);
    try { await create({ startsAt: starts.toISOString(), endsAt: new Date(starts.getTime() + duration * 60_000).toISOString(), activity, departureId: station }, usingDemo); router.replace('/outing'); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'La sortie n’a pas pu être créée. Vérifie ta connexion puis réessaie.'); }
    finally { setBusy(false); }
  }
  return <Shell narrow><View style={ui.section}>
    <Pressable accessibilityRole="button" onPress={() => step ? setStep(step - 1) : router.back()} style={{ ...ui.row, minHeight: 44, alignSelf: 'flex-start' }}><ArrowLeft size={18} color={colors.muted} /><Text style={ui.body}>Retour</Text></Pressable>
    <View style={ui.between}><Text style={ui.label}>UNE SORTIE, QUATRE PETITS PAS</Text><Text style={ui.label}>{step + 1} / 4</Text></View>
    <View style={{ flexDirection: 'row', gap: 8 }}>{[0, 1, 2, 3].map(i => <View key={i} style={{ flex: 1, height: 4, borderRadius: 4, backgroundColor: i <= step ? colors.blue : colors.border }} />)}</View>
    <Text accessibilityRole="header" style={{ ...ui.title, marginTop: 14 }}>{['On se retrouve quand ?', 'Qu’est-ce qui te ferait plaisir ?', 'Tu pars d’où ?'][step]}</Text>
    <Text style={ui.body}>{['Le bon moment, c’est celui où vous êtes ensemble.', 'Les grandes soirées commencent souvent par un petit verre.', 'Une station suffit. Pas besoin de ton adresse.'][step]}</Text>
    {step === 0 && <View style={{ gap: 24 }}><View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>{['Aujourd’hui', 'Demain', 'Ce week-end'].map((label, i) => <Chip key={label} selected={day === parisParts(new Date(Date.now() + (i === 2 ? ((6 - new Date().getDay() + 7) % 7 || 7) : i) * 86400_000)).day} onPress={() => setDay(parisParts(new Date(Date.now() + (i === 2 ? ((6 - new Date().getDay() + 7) % 7 || 7) : i) * 86400_000)).day)}>{label}</Chip>)}</View><Field label="Date (AAAA-MM-JJ)" value={day} onChangeText={setDay} /><Field label="Heure de Paris (HH:MM)" value={time} onChangeText={setTime} /><View style={{ gap: 10 }}><Text style={ui.label}>On prévoit de rester…</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>{[90, 150, 240].map(d => <Chip key={d} selected={duration === d} onPress={() => setDuration(d)}>{d === 90 ? '1 h 30' : d === 150 ? '2 h 30' : '4 h'}</Chip>)}</View></View></View>}
    {step === 1 && <View style={{ gap: 12 }}>{([{ kind: 'drinks', Icon: GlassWater, detail: 'Un toast à la fin de la journée.' }, { kind: 'dinner', Icon: Utensils, detail: 'Une table et du temps pour discuter.' }, { kind: 'coffee', Icon: Coffee, detail: 'Une pause qui fait du bien.' }, { kind: 'other', Icon: Sparkles, detail: 'L’important, c’est de se retrouver.' }] as const).map(({ kind, Icon, detail }) => <Pressable key={kind} accessibilityRole="button" accessibilityState={{ selected: activity === kind }} onPress={() => setActivity(kind)} style={{ ...ui.row, padding: 22, borderRadius: 16, borderWidth: 1, borderColor: activity === kind ? colors.blue : colors.border, backgroundColor: activity === kind ? '#EDF1FF' : 'white' }}><Icon size={25} color={activity === kind ? colors.blue : colors.muted} /><View style={{ gap: 4 }}><Text style={{ color: colors.ink, fontSize: 17, fontWeight: '600' }}>{activityLabels[kind]}</Text><Text style={ui.body}>{detail}</Text></View></Pressable>)}</View>}
    {step === 2 && <View style={{ gap: 24 }}><StationPicker stations={stations} value={station} onChange={setStation} /><Notice>Seul le nom de ta station sera partagé avec le groupe.</Notice>{!userId && supabase && <View style={{ gap: 10 }}><Text style={ui.body}>Connecte-toi pour inviter tes amis sur leurs téléphones.</Text><SignInButtons onError={setError} /></View>}{userId && <View style={{ flexDirection: 'row', gap: 10 }}><Chip selected={!usingDemo} onPress={() => setDemo(false)}>Sortie partagée</Chip><Chip selected={usingDemo} onPress={() => setDemo(true)}>Essai local</Chip></View>}{usingDemo && <Notice warning>Les lieux sont réels. Les trajets sont simulés et la sortie reste sur cet appareil.</Notice>}</View>}
    {!!error && <Notice warning>{error}</Notice>}
    {!usingDemo && <Notice warning={!coverage?.ready}>{coverage?.ready ? 'Les trajets seront vérifiés avec Île-de-France Mobilités.' : coverage === null ? 'On vérifie le service de trajets…' : 'La recherche automatique de lieu est en pause. Tu peux créer la sortie et inviter tes amis. Après la création, choisis une station de rendez-vous et un lieu.'}</Notice>}
    <View style={{ marginTop: 10 }}><Button testID="wizard-next" loading={busy} onPress={() => void next()}>{step === 2 ? 'Créer ma sortie' : 'Suivant'}</Button></View>
  </View></Shell>;
}
