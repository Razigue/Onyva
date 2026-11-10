import type { ReactNode } from 'react';
import { Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { Link, usePathname } from 'expo-router';
import { CalendarDays, Compass, MapPin, Plus, Users } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { palette } from '../../theme';
import { Brand } from './Brand';
import { cx } from './cx';
import { Caption, Label } from './Text';

const links = [{ href: '/' as const, label: 'À la une', Icon: Compass }, { href: '/outing' as const, label: 'Ma sortie', Icon: Users }, { href: '/account' as const, label: 'Mon compte', Icon: CalendarDays }];

function Sidebar({ path }: { path: string }) {
  return <View className="w-60 justify-between border-r border-border bg-paper-deep p-[30px]">
    <View className="gap-[52px]">
      <Link href="/" accessibilityLabel="Onyva, accueil"><Brand /></Link>
      <View className="gap-2.5">{links.map(({ href, label, Icon }) => <Link key={href} href={href} asChild>
        <Pressable className={cx('min-h-[50px] flex-row items-center gap-3 rounded-medium px-3.5', path === href ? 'bg-surface' : 'bg-transparent')}>
          <Icon size={20} color={path === href ? palette.brand : palette.muted} />
          <Text className={cx('text-small', path === href ? 'font-semibold text-ink' : 'text-muted')}>{label}</Text>
        </Pressable>
      </Link>)}</View>
    </View>
    <View className="gap-[18px]">
      <View className="h-[3px] w-8 bg-brand" />
      <Text className="text-subtitle text-ink">Des amis.{'\n'}Des trajets.{'\n'}Un même point.</Text>
      <Caption>Pensé pour l’Île-de-France.</Caption>
    </View>
  </View>;
}

function TabBar({ path }: { path: string }) {
  return <View className="flex-row border-t border-border bg-paper">{links.map(({ href, label, Icon }) => <Link key={href} href={href} asChild>
    <Pressable className="flex-1 items-center gap-1 py-3">
      <Icon size={21} color={path === href ? palette.brand : palette.muted} />
      <Text className={cx('text-[11px] font-semibold', path === href ? 'text-brand' : 'text-muted')}>{label}</Text>
    </Pressable>
  </Link>)}</View>;
}

export function Shell({ children, narrow = false }: { children: ReactNode; narrow?: boolean }) {
  const { width } = useWindowDimensions();
  const desktop = width >= 1000;
  const path = usePathname();
  return <SafeAreaView className="flex-1 bg-paper">
    <View className="flex-1 flex-row">
      {desktop && <Sidebar path={path} />}
      <View className="flex-1">
        <View className={cx('min-h-[82px] flex-row items-center justify-between border-b border-border', desktop ? 'px-12' : 'px-5')}>
          {desktop ? <View className="flex-row items-center gap-3"><MapPin size={16} color={palette.muted} /><Label>Paris & Île-de-France</Label></View> : <Link href="/"><Brand small /></Link>}
          <Link href="/create" asChild><Pressable accessibilityRole="button" className="min-h-[44px] flex-row items-center gap-2">
            <Plus size={19} color={palette.brand} /><Text className="text-small font-semibold text-brand">Créer une sortie</Text>
          </Pressable></Link>
        </View>
        <ScrollView contentContainerClassName={cx('items-center pb-11', desktop ? 'p-12' : 'p-5')} keyboardShouldPersistTaps="handled">
          <View className={cx('w-full', narrow ? 'max-w-[660px]' : 'max-w-[1120px]')}>{children}</View>
        </ScrollView>
        {!desktop && <TabBar path={path} />}
      </View>
    </View>
  </SafeAreaView>;
}
