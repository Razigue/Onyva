import { Pressable, Text, View } from 'react-native';
import { Check, ChevronDown, MapPin, ThumbsUp } from 'lucide-react-native';
import { cuisineLabels, formatTime } from '@onyva/shared';
import type { Outing, Recommendation, Station } from '@onyva/shared';
import { palette } from '../../theme';
import { Body, Button, Caption, Card, cx, Subtitle } from '../ui';
import { minutes } from './format';
import { FairnessPanel } from './FairnessPanel';
import { JourneyDetails } from './JourneyDetails';

type Props = {
  recommendation: Recommendation; index: number; outing: Outing; stations: Station[];
  /** First automatic result: never true for a venue picked by hand. */
  best: boolean;
  /** Changes with each new result, to replay the arrival animation. */
  replay: string;
  votes: number; liked: boolean; expanded: boolean;
  reactDisabled: boolean; canConfirm: boolean; confirmDisabled: boolean; saving: boolean;
  onToggle: () => void; onReact: () => void; onConfirm: () => void; onReviews: () => void;
};

export function ResultCard({ recommendation, index, outing, stations, best, replay, votes, liked, expanded, reactDisabled, canConfirm, confirmDisabled, saving, onToggle, onReact, onConfirm, onReviews }: Props) {
  const { venue } = recommendation;
  const selected = venue.id === outing.confirmedVenueId;
  const badge = selected ? 'Lieu confirmé' : outing.selectedVenue ? 'Lieu choisi par le groupe' : best ? 'Le plus équilibré' : `Autre idée · ${index + 1}`;
  return <Card className={cx('gap-5', best ? 'border-lime-line bg-lime-soft' : 'border-border bg-surface')}>
    <View className="flex-row items-center justify-between gap-3">
      <View className={cx('rounded-pill px-3 py-2', best ? 'bg-lime' : 'bg-chip')}><Text className="text-caption font-semibold text-ink">{badge}</Text></View>
      <Caption>OpenStreetMap</Caption>
    </View>
    <View className="gap-2">
      <Subtitle className="text-[24px] leading-[30px]">{venue.name}</Subtitle>
      <View className="flex-row items-center gap-3"><MapPin size={14} color={palette.muted} /><Body>{venue.neighborhood} · {minutes(venue.walkSeconds)} min à pied</Body></View>
    </View>
    <FairnessPanel rows={recommendation.journeys.map(j => ({ participantId: j.participantId, duration: j.outbound.duration }))} maximum={recommendation.maximum} spread={recommendation.spread} participants={outing.participants} replay={replay} highlight={best} />
    {!!venue.cuisines?.length && <Body>{venue.cuisines.map(value => cuisineLabels[value]).join(' · ')}</Body>}
    {venue.kind === 'dinner' && !venue.cuisines?.length && <Body>Cuisine non renseignée</Body>}
    <Pressable accessibilityRole="link" accessibilityLabel={`Consulter les avis Google pour ${venue.name}`} onPress={onReviews} className="min-h-[44px] justify-center">
      <Text className="text-brand">Consulter les avis Google ↗</Text><Caption>Vérifie la note et les avis avant de choisir.</Caption>
    </Pressable>
    <View className="flex-row items-start gap-3">
      <Check size={18} color={palette.success} />
      <View className="flex-1 gap-1">
        <Text className="text-small font-medium text-ink">{`Retour vérifié pour chacun après ${formatTime(outing.endsAt)}`}</Text>
        <Caption className="leading-[18px]">{recommendation.journeys.some(j => j.inbound.night) ? 'Un trajet de retour utilise un bus de nuit.' : 'Marche, attente et correspondances incluses.'}</Caption>
      </View>
    </View>
    <Pressable accessibilityRole="button" onPress={onToggle} className="min-h-[44px] flex-row items-center justify-between gap-3">
      <Text className="text-small font-medium text-brand">Voir les trajets aller et retour</Text><ChevronDown size={18} color={palette.brand} />
    </Pressable>
    {expanded && <JourneyDetails recommendation={recommendation} participants={outing.participants} stations={stations} />}
    <Pressable accessibilityRole="button" accessibilityLabel={`Ça me plaît : ${venue.name}`} aria-pressed={liked} accessibilityState={{ selected: liked, disabled: reactDisabled }} disabled={reactDisabled} onPress={onReact} className="min-h-[44px] flex-row items-center gap-3">
      <ThumbsUp size={18} color={liked ? palette.brand : palette.muted} /><Text className={liked ? 'text-brand' : 'text-muted'}>{liked ? 'Ça me plaît !' : 'Ça me plaît'} · {votes}</Text>
    </Pressable>
    {canConfirm && <Button secondary={!best} disabled={confirmDisabled} loading={saving} onPress={onConfirm}>{best ? 'On se retrouve ici' : 'Choisir ce lieu'}</Button>}
  </Card>;
}
