import { ActivityIndicator } from 'react-native';
import type { RecommendationResponse, Station } from '@onyva/shared';
import { palette } from '../../theme';
import { Body, Card, Subtitle } from '../ui';

export function CalculationProgress({ results, stations }: { results: RecommendationResponse | null; stations: Station[] }) {
  const progress = results?.progress, first = results?.stationCandidates?.[0];
  return <>
    <Card className="items-center">
      <ActivityIndicator color={palette.brand} />
      <Body>{progress?.stage === 'returns' ? `On vérifie les allers et retours… ${progress.completed} / ${progress.total}` : progress ? `On compare les trajets… ${progress.completed} / ${progress.total}` : 'On compare les trajets pour vous…'}</Body>
    </Card>
    {first && <Card>
      <Subtitle>Un premier point de rencontre</Subtitle>
      <Body>{stations.find(s => s.id === first.stationId)?.name ?? 'Station en cours de vérification'}</Body>
      <Body>Retour en cours de vérification. Tu pourras choisir un lieu dès que le calcul sera terminé.</Body>
    </Card>}
  </>;
}
