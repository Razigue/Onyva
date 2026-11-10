import { ActivityIndicator, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';
import type { RecommendationResponse } from '@onyva/shared';
import { palette } from '../../theme';
import { Caption, Card, cx } from '../ui';

type Progress = NonNullable<RecommendationResponse['progress']>;
const automatic = [
  { stage: 'isochrones', label: 'On compare les trajets de chacun' },
  { stage: 'returns', label: 'On vérifie les allers et les retours' },
  { stage: 'complete', label: 'Les lieux sont prêts' },
] as const;
// A venue picked by hand skips the comparison: only its journeys are checked.
const manual = automatic.slice(1);

/** The calculation as a readable sequence, announced to screen readers as it moves on. */
export function CalculationSteps({ progress, manualChoice }: { progress?: Progress; manualChoice: boolean }) {
  const steps = manualChoice ? manual : automatic;
  const current = Math.max(0, steps.findIndex(step => step.stage === progress?.stage));
  return <Card className="gap-0 py-4" accessibilityLiveRegion="polite">
    {steps.map((step, i) => {
      const done = i < current || progress?.stage === 'complete', active = !done && i === current;
      const counter = active && progress && progress.total > 0 ? `${progress.completed} sur ${progress.total}` : null;
      const state = done ? 'terminée' : active ? `en cours${counter ? `, ${counter}` : ''}` : 'à venir';
      return <View key={step.stage} accessible accessibilityLabel={`Étape ${i + 1} sur ${steps.length} : ${step.label}, ${state}.`} className="flex-row gap-3">
        <View className="items-center">
          <View className={cx('h-7 w-7 items-center justify-center rounded-pill border-2', done ? 'border-success bg-success' : active ? 'border-brand bg-surface' : 'border-border bg-surface')}>
            {done ? <Check size={14} color={palette.surface} strokeWidth={3} /> : active ? <ActivityIndicator size="small" color={palette.brand} /> : null}
          </View>
          {i < steps.length - 1 && <View className={cx('my-1 w-0.5 flex-1', done ? 'bg-success' : 'bg-border')} style={{ minHeight: 18 }} />}
        </View>
        <View className="flex-1 gap-2 pb-4 pt-1">
          <Text className={cx('text-body', active ? 'font-semibold text-ink' : done ? 'text-ink' : 'text-muted')}>{step.label}</Text>
          {counter && <View className="gap-1.5">
            <View className="h-1.5 overflow-hidden rounded-pill bg-track"><View className="h-1.5 rounded-pill bg-brand" style={{ width: `${Math.round(progress!.completed / progress!.total * 100)}%` }} /></View>
            <Caption style={{ fontVariant: ['tabular-nums'] }}>{counter}</Caption>
          </View>}
        </View>
      </View>;
    })}
  </Card>;
}
