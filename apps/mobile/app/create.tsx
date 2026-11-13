import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { defaultStart, noVenueFilter, timetableLimit } from '@onyva/shared';
import type { Outing, VenueFilter } from '@onyva/shared';
import { StepHeader } from '../src/components/create/StepHeader';
import { StepTransition } from '../src/components/create/StepTransition';
import { WhatStep } from '../src/components/create/WhatStep';
import { WhenStep } from '../src/components/create/WhenStep';
import { WhereStep } from '../src/components/create/WhereStep';
import { Button, Notice, Shell } from '../src/components/ui';
import { tapSuccess } from '../src/lib/haptics';
import { parisDate, parisParts } from '../src/lib/paris-time';
import { useStore } from '../src/lib/store';
import { supabase } from '../src/lib/supabase';

export default function Create() {
  const { create, stations, userId, outing, coverage, name, saveName, sessionFailed } = useStore();
  const initial = parisParts(defaultStart());
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const go = (next: number) => { setDirection(next > step ? 1 : -1); setStep(next); };
  const [day, setDay] = useState(initial.day);
  const [time, setTime] = useState(initial.time);
  const [duration, setDuration] = useState(150);
  const [activity, setActivity] = useState<Outing['activity']>('drinks');
  const [filters, setFilters] = useState<VenueFilter>(noVenueFilter);
  const [station, setStation] = useState(outing?.participants[0]?.departureId ?? '');
  const [person, setPerson] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    // The full catalog has thousands of stops: never preselect an arbitrary one.
    if (station && stations.length && !stations.some(candidate => candidate.id === station)) setStation('');
  }, [stations, station]);
  async function next() {
    setError('');
    const starts = parisDate(day, time);
    if (!starts || starts.getTime() < Date.now()) { setError('Choisis une date et une heure à venir, à l’heure de Paris.'); return; }
    const limit = timetableLimit(coverage, new Date(starts.getTime() + duration * 60_000));
    if (limit) { setError(limit); return; }
    if (step < 2) { go(step + 1); return; }
    if (!stations.some(s => s.id === station)) { setError('Choisis ta station de départ.'); return; }
    if (!(person ?? name).trim()) { setError('Indique ton prénom.'); return; }
    setBusy(true);
    try {
      const personName = (person ?? name).trim();
      await saveName(personName);
      await create({ startsAt: starts.toISOString(), endsAt: new Date(starts.getTime() + duration * 60_000).toISOString(), activity, departureId: station, filters: { cuisines: activity === 'dinner' ? filters.cuisines : [], outdoorSeating: activity !== 'other' && filters.outdoorSeating } }, personName);
      tapSuccess();
      router.replace('/outing');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'La sortie n’a pas pu être créée. Vérifie ta connexion puis réessaie.'); }
    finally { setBusy(false); }
  }
  return <Shell narrow><View className="mb-8 gap-5">
    <StepHeader step={step} onBack={() => step ? go(step - 1) : router.back()} />
    <StepTransition step={step} direction={direction}>
      {step === 0 && <WhenStep day={day} time={time} duration={duration} onDay={setDay} onTime={setTime} onDuration={setDuration} />}
      {step === 1 && <WhatStep activity={activity} onChange={setActivity} filters={filters} onFilters={setFilters} />}
      {step === 2 && <WhereStep name={person ?? name} onName={setPerson} stations={stations} station={station} onStation={setStation} configured={!!supabase} sessionReady={!!userId} sessionFailed={sessionFailed} />}
    </StepTransition>
    {!!error && <Notice warning>{error}</Notice>}
    {!!userId && <Notice warning={!coverage?.ready}>{coverage?.ready ? 'Les trajets seront vérifiés avec Île-de-France Mobilités.' : coverage === null ? 'On vérifie le service de trajets…' : 'La recherche automatique de lieu est en pause. Tu peux créer la sortie et inviter tes amis. Après la création, choisis une station de rendez-vous et un lieu.'}</Notice>}
    <View className="mt-2.5"><Button testID="wizard-next" loading={busy} disabled={step === 2 && !userId} onPress={() => void next()}>{step === 2 ? 'Créer ma sortie' : 'Suivant'}</Button></View>
  </View></Shell>;
}
