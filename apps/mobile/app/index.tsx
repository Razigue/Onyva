import { Text, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { ArrowUpRight, Clock3, MapPin, ShieldCheck, Users } from 'lucide-react-native';
import { activityLabels, formatTime } from '@onyva/shared';
import { Button, colors, Convergence, Shell, ui } from '../src/components/ui';
import { useStore } from '../src/lib/store';

export default function Home() {
  const { outing } = useStore();
  const wide = useWindowDimensions().width >= 1100;
  return <Shell>
    <View style={{ flexDirection: wide ? 'row' : 'column', minHeight: wide ? 390 : undefined, marginBottom: 44, gap: 24 }}>
      <View style={{ flex: 1.1, justifyContent: 'center', gap: 23, paddingVertical: 16 }}>
        <View style={ui.row}><View style={{ width: 7, height: 7, borderRadius: 8, backgroundColor: colors.blue }} /><Text style={{ color: colors.muted, fontSize: 12, letterSpacing: 1.4, fontWeight: '600' }}>LE BON ENDROIT, POUR TOUT LE MONDE</Text></View>
        <Text accessibilityRole="header" style={{ color: colors.ink, fontSize: wide ? 64 : 46, lineHeight: wide ? 69 : 51, letterSpacing: -2, fontFamily: 'Georgia' }}>On se retrouve{ '\n' }à mi-chemin.</Text>
        <Text style={{ ...ui.body, maxWidth: 360, fontSize: 17, lineHeight: 27 }}>Un verre, un resto, des amis. Trouve le lieu qui rapproche tout le monde.</Text>
        <View style={{ alignSelf: 'flex-start', marginTop: 5 }}><Button onPress={() => router.push('/create')}>On organise ça</Button></View>
        <Text style={{ fontSize: 12, color: colors.muted }}>2 à 10 amis. Chacun son départ. Un même point.</Text>
      </View>
      <View style={{ flex: wide ? 1 : undefined, height: wide ? 390 : 240, overflow: 'hidden', borderRadius: 24, backgroundColor: '#EFEEE6', justifyContent: 'center' }}>
        <Convergence style={{ position: 'absolute', width: '100%', height: '100%' }} />
        <View style={{ position: 'absolute', left: 20, top: 24, backgroundColor: 'white', paddingVertical: 9, paddingHorizontal: 14, borderRadius: 50, flexDirection: 'row', gap: 8 }}><MapPin size={14} color={colors.blue} /><Text style={{ fontSize: 12, fontWeight: '500' }}>Toi, d’ici.</Text></View>
        <View style={{ position: 'absolute', right: 18, bottom: 26, backgroundColor: colors.lime, paddingVertical: 12, paddingHorizontal: 18, borderRadius: 50 }}><Text style={{ fontSize: 13, color: colors.ink, fontWeight: '600' }}>Nous, au même endroit.</Text></View>
      </View>
    </View>
    <View style={ui.section}>
      <View style={ui.between}><Text style={ui.subtitle}>Le prochain bon moment</Text><ArrowUpRight size={21} color={colors.muted} /></View>
      {outing ? <View style={ui.card}><View style={ui.between}><View style={{ gap: 8 }}><Text style={ui.subtitle}>{activityLabels[outing.activity]} entre amis</Text><Text style={ui.body}>{formatTime(outing.startsAt)} · {outing.participants.length} {outing.participants.length > 1 ? 'participants' : 'participant'} · {outing.confirmedVenueId ? 'Lieu confirmé' : 'À organiser'}</Text></View><Users size={28} color={colors.blue} /></View><Button secondary onPress={() => router.push('/outing')}>Retrouver ma sortie</Button></View> : <View style={{ ...ui.card, flexDirection: wide ? 'row' : 'column', alignItems: wide ? 'center' : 'flex-start', justifyContent: 'space-between', padding: 28 }}><View style={ui.row}><View style={{ width: 54, height: 54, borderRadius: 16, backgroundColor: '#F0F2FF', alignItems: 'center', justifyContent: 'center' }}><Users size={24} color={colors.blue} /></View><View style={{ flexShrink: 1, gap: 5 }}><Text style={{ fontSize: 17, fontWeight: '600', color: colors.ink }}>Il ne manque que le premier message.</Text><Text style={ui.body}>Lance une sortie. On s’occupe du point de rencontre.</Text></View></View><Button secondary onPress={() => router.push('/create')}>Créer ma première sortie</Button></View>}
    </View>
    <View style={{ borderTopWidth: 1, borderColor: colors.border, paddingTop: 32, gap: 24 }}><Text style={ui.subtitle}>Moins de « on va où ? ». Plus de « on y va ».</Text><View style={{ flexDirection: wide ? 'row' : 'column', gap: 28 }}>{[{ Icon: MapPin, title: 'Chacun son point de départ', body: 'Une station suffit. Ton adresse reste chez toi.' }, { Icon: Clock3, title: 'Un trajet juste pour tous', body: 'On réduit le trajet le plus long. Tu vois la différence.' }, { Icon: ShieldCheck, title: 'Et le retour dans tout ça ?', body: 'Les possibilités de retour comptent aussi dans le choix.' }].map(({ Icon, title, body }, i) => <View key={title} style={{ flex: 1, gap: 12 }}><View style={ui.between}><Icon color={colors.blue} size={24} /><Text style={{ color: '#737985', fontSize: 12 }}>0{i + 1}</Text></View><Text style={{ color: colors.ink, fontSize: 16, fontWeight: '600' }}>{title}</Text><Text style={ui.body}>{body}</Text></View>)}</View></View>
    <View style={{ marginTop: 40, alignItems: 'center' }}><Text style={{ fontSize: 12, color: colors.muted }}>Pas de publicité. Pas de suivi. Juste le plaisir de se retrouver.</Text></View>
  </Shell>;
}
