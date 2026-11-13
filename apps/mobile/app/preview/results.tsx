import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Redirect } from 'expo-router';
import type { RecommendationResponse } from '@onyva/shared';
import { CalculationSteps } from '../../src/components/outing/CalculationSteps';
import { ConvergenceMark } from '../../src/components/outing/ConvergenceMark';
import { FirstCandidate } from '../../src/components/outing/FirstCandidate';
import { OutingHeader } from '../../src/components/outing/OutingHeader';
import { ResultCard } from '../../src/components/outing/ResultCard';
import { Button, Notice, Shell, Subtitle } from '../../src/components/ui';
import { SAMPLE_NOTICE, sampleOuting, sampleStations, sampleTimeline } from '../../src/dev/sample-results';

/**
 * Development preview of the results screen with SYNTHETIC data (src/dev/sample-results.ts).
 * It replays the progressive answers of the backend. Absent from release builds: it redirects home.
 */
export default function ResultsPreview() {
  const [results, setResults] = useState<RecommendationResponse | null>(null);
  const [run, setRun] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);
  useEffect(() => {
    if (!__DEV__) return;
    const timers = sampleTimeline().map(step => setTimeout(() => setResults(step.response), step.after));
    return () => timers.forEach(clearTimeout);
  }, [run]);
  if (!__DEV__) return <Redirect href="/" />;
  const busy = !!results?.progress && results.progress.stage !== 'complete';
  const outing = sampleOuting;
  return <Shell><View className="gap-7">
    <Notice warning>{SAMPLE_NOTICE}</Notice>
    <OutingHeader outing={outing} />
    <View className="flex-row items-center gap-2">
      {!!results?.recommendations.length && <ConvergenceMark replay={`${run}-${results.computedAt}`} />}
      <Subtitle>Les lieux pour vous</Subtitle>
    </View>
    {(busy || !results) && <CalculationSteps progress={results?.progress} manualChoice={false} />}
    {busy && !!results?.stationCandidates?.length && <FirstCandidate candidate={results.stationCandidates[0]!} stations={sampleStations} participants={outing.participants} />}
    {results?.recommendations.map((recommendation, index) => {
      const id = recommendation.venue.id;
      return <ResultCard key={id} recommendation={recommendation} index={index} outing={outing} stations={sampleStations} best={index === 0} replay={`${run}-${results.computedAt}`}
        votes={0} liked={false} expanded={expanded === id} reactDisabled canConfirm={false} confirmDisabled saving={false}
        onToggle={() => setExpanded(expanded === id ? null : id)} onReact={() => undefined} onConfirm={() => undefined} onReviews={() => undefined} />;
    })}
    <Button secondary onPress={() => { setResults(null); setRun(run + 1); }}>Rejouer la démonstration</Button>
  </View></Shell>;
}
