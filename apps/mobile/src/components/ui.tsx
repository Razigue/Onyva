import type { ReactNode } from 'react';
import { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import type { TextInputProps, ViewStyle } from 'react-native';
import { Link, usePathname } from 'expo-router';
import { ArrowRight, CalendarDays, Compass, MapPin, Plus, Search, Users, X } from 'lucide-react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Station } from '@onyva/shared';

export const colors = { blue: '#2E5BFF', lime: '#D8FF3B', ink: '#111827', paper: '#F7F6F1', muted: '#5F6673', border: '#E3E5E8', green: '#16794B', orange: '#9A5B00' };
export const ui = StyleSheet.create({
  title: { fontSize: 30, lineHeight: 37, fontWeight: '700', letterSpacing: -1, color: colors.ink },
  subtitle: { fontSize: 21, fontWeight: '600', letterSpacing: -.4, color: colors.ink },
  body: { fontSize: 15, lineHeight: 23, color: colors.muted },
  label: { fontSize: 13, lineHeight: 19, fontWeight: '600', color: colors.muted },
  card: { backgroundColor: 'white', borderRadius: 20, padding: 24, borderWidth: 1, borderColor: colors.border, gap: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  section: { gap: 20, marginBottom: 32 },
});

export function Button({ children, onPress, secondary = false, disabled = false, loading = false, icon = true, testID }: { children: string; onPress: () => void; secondary?: boolean; disabled?: boolean; loading?: boolean; icon?: boolean; testID?: string }) {
  return <Pressable testID={testID} accessibilityRole="button" accessibilityState={{ disabled: disabled || loading }} onPress={onPress} disabled={disabled || loading} style={({ pressed }) => ({ minHeight: 52, paddingHorizontal: 20, paddingVertical: 14, borderRadius: 13, backgroundColor: secondary ? 'white' : colors.blue, borderWidth: secondary ? 1 : 0, borderColor: colors.border, opacity: disabled ? .45 : pressed ? .75 : 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14 })}>
    {loading ? <ActivityIndicator color={secondary ? colors.blue : 'white'} /> : <><Text style={{ color: secondary ? colors.ink : 'white', fontWeight: '600', fontSize: 15 }}>{children}</Text>{icon && <ArrowRight size={18} color={secondary ? colors.ink : 'white'} />}</>}
  </Pressable>;
}

export function Chip({ children, selected, onPress }: { children: string; selected?: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={{ minHeight: 48, paddingHorizontal: 18, justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: selected ? colors.blue : colors.border, backgroundColor: selected ? '#EDF1FF' : 'white' }}><Text style={{ color: selected ? colors.blue : colors.ink, fontSize: 15, fontWeight: selected ? '600' : '400' }}>{children}</Text></Pressable>;
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return <View style={{ gap: 8 }}><Text style={ui.label}>{label}</Text><TextInput accessibilityLabel={label} placeholderTextColor={colors.muted} {...props} style={[{ borderWidth: 1, borderColor: colors.border, minHeight: 52, backgroundColor: 'white', borderRadius: 12, paddingHorizontal: 16, color: colors.ink, fontSize: 16 }, props.style]} /></View>;
}

export function Notice({ children, warning = false }: { children: ReactNode; warning?: boolean }) {
  return <View accessibilityRole="alert" style={{ backgroundColor: warning ? '#FFF4E2' : '#EDF1FF', borderRadius: 12, padding: 14 }}><Text style={{ color: warning ? '#825000' : '#2448C7', fontSize: 13, lineHeight: 20 }}>{children}</Text></View>;
}

export function Brand({ small = false }: { small?: boolean }) {
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Text style={{ fontSize: small ? 28 : 37, letterSpacing: -2, fontWeight: '800', color: colors.ink }}>onyva</Text><View style={{ width: 8, height: 8, backgroundColor: colors.blue, borderRadius: 8, marginTop: 16 }} /></View>;
}

export function Convergence({ style }: { style?: ViewStyle }) {
  return <View accessible={false} style={style}><Svg width="100%" height="100%" viewBox="0 0 460 380">
    <Path d="M30 -30 V68 C30 125 220 110 230 190 S280 280 480 280" fill="none" stroke={colors.blue} strokeWidth="14" />
    <Path d="M480 20 H390 C320 20 370 140 230 190 S170 300 170 420" fill="none" stroke={colors.lime} strokeWidth="14" />
    <Path d="M-30 330 H65 C150 330 130 220 230 190 S330 210 480 140" fill="none" stroke="#111827" strokeWidth="14" />
    <Path d="M-30 145 H45 C130 145 160 190 230 190" fill="none" stroke="#F56B4F" strokeWidth="14" />
    <Circle cx="230" cy="190" r="24" fill={colors.paper} />
    <Circle cx="230" cy="190" r="9" fill={colors.blue} />
    <Circle cx="30" cy="68" r="6" fill="white" /><Circle cx="390" cy="20" r="6" fill={colors.ink} /><Circle cx="65" cy="330" r="6" fill="white" />
  </Svg></View>;
}

export function Shell({ children, narrow = false }: { children: ReactNode; narrow?: boolean }) {
  const { width } = useWindowDimensions();
  const desktop = width >= 1000;
  const path = usePathname();
  const links = [{ href: '/' as const, label: 'À la une', Icon: Compass }, { href: '/outing' as const, label: 'Ma sortie', Icon: Users }, { href: '/account' as const, label: 'Mon compte', Icon: CalendarDays }];
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }}>
    <View style={{ flex: 1, flexDirection: 'row' }}>
      {desktop && <View style={{ width: 240, borderRightWidth: 1, borderColor: colors.border, padding: 30, backgroundColor: '#F0EFE9', justifyContent: 'space-between' }}>
        <View style={{ gap: 52 }}><Link href="/" accessibilityLabel="Onyva, accueil"><Brand /></Link><View style={{ gap: 10 }}>{links.map(({ href, label, Icon }) => <Link key={href} href={href} asChild><Pressable style={{ flexDirection: 'row', gap: 12, alignItems: 'center', minHeight: 50, borderRadius: 12, paddingHorizontal: 14, backgroundColor: path === href ? 'white' : 'transparent' }}><Icon size={20} color={path === href ? colors.blue : colors.muted} /><Text style={{ fontSize: 14, fontWeight: path === href ? '600' : '400', color: path === href ? colors.ink : colors.muted }}>{label}</Text></Pressable></Link>)}</View></View>
        <View style={{ gap: 18 }}><View style={{ width: 32, height: 3, backgroundColor: colors.blue }} /><Text style={{ fontSize: 18, lineHeight: 26, color: colors.ink }}>Des amis.{ '\n' }Des trajets.{ '\n' }Un même point.</Text><Text style={{ fontSize: 12, color: colors.muted }}>Pensé pour l’Île-de-France.</Text></View>
      </View>}
      <View style={{ flex: 1 }}>
        <View style={{ paddingHorizontal: desktop ? 48 : 22, minHeight: 82, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderColor: colors.border }}>
          {desktop ? <View style={ui.row}><MapPin size={16} color={colors.muted} /><Text style={ui.label}>Paris & Île-de-France</Text></View> : <Link href="/"><Brand small /></Link>}
          <Link href="/create" asChild><Pressable accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 }}><Plus size={19} color={colors.blue} /><Text style={{ color: colors.blue, fontSize: 14, fontWeight: '600' }}>Créer une sortie</Text></Pressable></Link>
        </View>
        <ScrollView contentContainerStyle={{ padding: desktop ? 48 : 22, paddingBottom: 44, alignItems: 'center' }} keyboardShouldPersistTaps="handled"><View style={{ width: '100%', maxWidth: narrow ? 660 : 1120 }}>{children}</View></ScrollView>
        {!desktop && <View style={{ flexDirection: 'row', backgroundColor: colors.paper, borderTopWidth: 1, borderColor: colors.border }}>{links.map(({ href, label, Icon }) => <Link key={href} href={href} asChild><Pressable style={{ flex: 1, alignItems: 'center', paddingVertical: 12, gap: 5 }}><Icon size={21} color={path === href ? colors.blue : colors.muted} /><Text style={{ fontSize: 11, fontWeight: '600', color: path === href ? colors.blue : colors.muted }}>{label}</Text></Pressable></Link>)}</View>}
      </View>
    </View>
  </SafeAreaView>;
}

export function StationPicker({ label = 'Ta station de départ', stations, value, onChange }: { label?: string; stations: Station[]; value: string; onChange: (id: string) => void }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const selected = stations.find(s => s.id === value);
  const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const search = normalize(query);
  const filtered = stations.map(station => ({ station, name: normalize(station.name) }))
    .filter(item => item.name.includes(search))
    .sort((a, b) => Number(b.name === search) - Number(a.name === search) || Number(b.name.startsWith(search)) - Number(a.name.startsWith(search)) || b.station.lines.length - a.station.lines.length)
    .slice(0, 8).map(item => item.station);
  return <View style={{ gap: 10 }}><Text style={ui.label}>{label}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={`${label} : ${selected?.name ?? 'Choisir'}`} onPress={() => setOpen(!open)} style={{ ...ui.between, borderWidth: 1, borderColor: open ? colors.blue : colors.border, borderRadius: 14, backgroundColor: 'white', padding: 16, minHeight: 56 }}><View style={ui.row}><MapPin size={20} color={colors.blue} /><Text style={{ fontSize: 16, color: colors.ink }}>{selected?.name ?? 'Choisis une station'}</Text></View>{open ? <X size={18} color={colors.muted} /> : <Search size={18} color={colors.muted} />}</Pressable>
    {open && <View style={{ ...ui.card, padding: 12, gap: 4 }}><TextInput autoFocus={Platform.OS === 'web'} accessibilityLabel="Rechercher une station" placeholder="Cherche une station…" value={query} onChangeText={setQuery} style={{ minHeight: 48, padding: 12, fontSize: 16, color: colors.ink }} />{filtered.map(station => <Pressable key={station.id} accessibilityRole="button" onPress={() => { onChange(station.id); setOpen(false); setQuery(''); }} style={{ padding: 12, minHeight: 48, gap: 6, borderTopWidth: 1, borderColor: colors.border }}><Text style={{ fontSize: 15, color: colors.ink }}>{station.name}</Text><Text style={{ color: colors.muted, fontSize: 12 }}>Lignes {station.lines.join(' · ')}</Text></Pressable>)}{filtered.length === 0 && <Text style={{ ...ui.body, padding: 12 }}>Aucune station trouvée. Essaie un autre nom.</Text>}</View>}
  </View>;
}
