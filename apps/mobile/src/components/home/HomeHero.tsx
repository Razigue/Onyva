import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { MapPin } from 'lucide-react-native';
import { palette } from '../../theme';
import { Body, Button, Caption, Convergence, cx } from '../ui';

export function HomeHero({ wide }: { wide: boolean }) {
  return <View className={cx('mb-11 gap-6', wide ? 'min-h-[390px] flex-row' : 'flex-col')}>
    <View className="flex-[1.1] justify-center gap-[23px] py-4">
      <View className="flex-row items-center gap-3"><View className="h-[7px] w-[7px] rounded-pill bg-brand" /><Text className="text-caption font-semibold tracking-widest text-muted">LE BON ENDROIT, POUR TOUT LE MONDE</Text></View>
      <Text accessibilityRole="header" className={cx('tracking-tighter text-ink', wide ? 'text-[64px] leading-[69px]' : 'text-[46px] leading-[51px]')} style={{ fontFamily: 'Georgia' }}>On se retrouve{'\n'}à mi-chemin.</Text>
      <Body className="max-w-[360px] text-[17px] leading-[27px]">Un verre, un resto, des amis. Trouve le lieu qui rapproche tout le monde.</Body>
      <View className="mt-1 self-start"><Button onPress={() => router.push('/create')}>On organise ça</Button></View>
      <Caption>2 à 10 amis. Chacun son départ. Un même point.</Caption>
    </View>
    <View className={cx('justify-center overflow-hidden rounded-[24px] bg-paper-shade', wide ? 'h-[390px] flex-1' : 'h-60')}>
      <Convergence style={{ position: 'absolute', width: '100%', height: '100%' }} />
      <View className="absolute left-5 top-6 flex-row gap-2 rounded-pill bg-surface px-3.5 py-2"><MapPin size={14} color={palette.brand} /><Text className="text-caption font-medium text-ink">Toi, d’ici.</Text></View>
      <View className="absolute bottom-[26px] right-[18px] rounded-pill bg-lime px-[18px] py-3"><Text className="text-[13px] font-semibold text-ink">Nous, au même endroit.</Text></View>
    </View>
  </View>;
}
