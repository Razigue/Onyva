import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useStore } from '../../lib/store';
import { Body, Button, Convergence, ConvergenceMotif, Title } from '../ui';

/** No outing yet: one big action, and a discreet way in for people who received a code. */
export function HomeEmpty() {
  const { sessionFailed } = useStore();
  return <View className="items-center gap-6 py-6">
    <View className="h-44 w-full max-w-[320px] overflow-hidden rounded-large bg-paper-shade">
      <Convergence style={{ width: '100%', height: '100%' }} />
    </View>
    <View className="items-center gap-2">
      <Title className="text-center font-serif tracking-normal">On sort quand ?</Title>
      <Body className="max-w-[320px] text-center">Chacun donne sa station. Onyva cherche un lieu juste pour tout le monde.</Body>
    </View>
    {sessionFailed && <View accessibilityRole="alert" className="w-full max-w-[420px] flex-row items-center gap-3 rounded-medium border border-border bg-surface p-3.5">
      <ConvergenceMotif variant="offline" size="small" />
      <Body className="flex-1 text-small text-ink">Pas de connexion pour l’instant. On réessaie tout seuls, tu pourras organiser dès que le réseau revient.</Body>
    </View>}
    <View className="w-full max-w-[420px]"><Button large onPress={() => router.push('/create')}>Organiser</Button></View>
    <Pressable accessibilityRole="link" onPress={() => router.push('/join')} className="min-h-[44px] justify-center px-3">
      <Text className="text-body font-sans-medium text-brand">J’ai un code</Text>
    </Pressable>
  </View>;
}
