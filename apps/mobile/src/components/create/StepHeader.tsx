import { Pressable, View } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import { palette } from '../../theme';
import { Body, cx, Label, Title } from '../ui';

const titles = ['On se retrouve quand ?', 'Qu’est-ce qui te ferait plaisir ?', 'Tu pars d’où ?'];
const leads = ['Le bon moment, c’est celui où vous êtes ensemble.', 'Les grandes soirées commencent souvent par un petit verre.', 'Une station suffit. Pas besoin de ton adresse.'];

export function StepHeader({ step, onBack }: { step: number; onBack: () => void }) {
  return <>
    <Pressable accessibilityRole="button" onPress={onBack} className="min-h-[44px] flex-row items-center gap-3 self-start">
      <ArrowLeft size={18} color={palette.muted} /><Body>Retour</Body>
    </Pressable>
    <View className="flex-row items-center justify-between gap-3"><Label>UNE SORTIE, QUATRE PETITS PAS</Label><Label>{step + 1} / 4</Label></View>
    <View className="flex-row gap-2">{[0, 1, 2, 3].map(i => <View key={i} className={cx('h-1 flex-1 rounded', i <= step ? 'bg-brand' : 'bg-border')} />)}</View>
    <Title className="mt-3.5">{titles[step]}</Title>
    <Body>{leads[step]}</Body>
  </>;
}
