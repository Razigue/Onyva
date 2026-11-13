import type { Participant, RecommendationResponse, Station } from '@onyva/shared';
import { Body, Caption, Card, Subtitle } from '../ui';
import { FairnessPanel } from './FairnessPanel';

type Candidate = NonNullable<RecommendationResponse['stationCandidates']>[number];

/** First numbers as soon as they exist: the best meeting station so far, clearly marked as an estimate. */
export function FirstCandidate({ candidate, stations, participants }: { candidate: Candidate; stations: Station[]; participants: Participant[] }) {
  return <Card>
    <Caption className="font-sans-semibold">Première estimation</Caption>
    <Subtitle>{stations.find(s => s.id === candidate.stationId)?.name ?? 'Station en cours de vérification'}</Subtitle>
    <FairnessPanel rows={candidate.times} maximum={candidate.maximum} spread={candidate.spread} participants={participants} replay={candidate.stationId} estimated />
    <Body className="text-small">Temps estimés pour rejoindre la station. Les lieux, la marche finale et les retours sont en cours de vérification.</Body>
  </Card>;
}
