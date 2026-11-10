import { Text, View } from 'react-native';
import { Clock3, MapPin, ShieldCheck } from 'lucide-react-native';
import { palette } from '../../theme';
import { Body, Caption, cx, Subtitle } from '../ui';

const promises = [
  { Icon: MapPin, title: 'Chacun son point de départ', body: 'Une station suffit. Ton adresse reste chez toi.' },
  { Icon: Clock3, title: 'Un trajet juste pour tous', body: 'On réduit le trajet le plus long. Tu vois la différence.' },
  { Icon: ShieldCheck, title: 'Et le retour dans tout ça ?', body: 'Les possibilités de retour comptent aussi dans le choix.' },
];

export function HomePromises({ wide }: { wide: boolean }) {
  return <>
    <View className="gap-6 border-t border-border pt-8">
      <Subtitle>Moins de « on va où ? ». Plus de « on y va ».</Subtitle>
      <View className={cx('gap-7', wide ? 'flex-row' : 'flex-col')}>{promises.map(({ Icon, title, body }, i) => <View key={title} className="flex-1 gap-3">
        <View className="flex-row items-center justify-between gap-3"><Icon color={palette.brand} size={24} /><Caption>0{i + 1}</Caption></View>
        <Text className="text-body font-semibold text-ink">{title}</Text>
        <Body>{body}</Body>
      </View>)}</View>
    </View>
    <View className="mt-10 items-center"><Caption>Pas de publicité. Pas de suivi. Juste le plaisir de se retrouver.</Caption></View>
  </>;
}
