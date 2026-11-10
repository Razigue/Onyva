import { Text, View } from 'react-native';
import { cx } from './cx';

export function Brand({ small = false }: { small?: boolean }) {
  return <View className="flex-row items-center gap-2">
    <Text className={cx('font-sans-extrabold tracking-tighter text-ink', small ? 'text-[28px]' : 'text-[37px]')}>onyva</Text>
    <View className="mt-4 h-2 w-2 rounded-pill bg-brand" />
  </View>;
}
