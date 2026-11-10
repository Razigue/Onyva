import { View, Text } from 'react-native';
import { Camera, MapView, PointAnnotation } from '@maplibre/maplibre-react-native';
import type { LivePosition, Station, Venue } from '@onyva/shared';
import { palette } from '../theme';

export default function VenueMap({ stations, venues, positions = [] }: { stations: Station[]; venues: Venue[]; positions?: LivePosition[] }) {
  return <View style={{ height: 320, borderRadius: 18, overflow: 'hidden' }}><MapView style={{ flex: 1 }} mapStyle="https://tiles.openfreemap.org/styles/positron" logoEnabled={false}>
    <Camera defaultSettings={{ centerCoordinate: [2.36, 48.86], zoomLevel: 11 }} />
    {stations.map(s => <PointAnnotation key={s.id} id={s.id} coordinate={[s.longitude, s.latitude]} title={s.name}><View style={{ width: 18, height: 18, borderRadius: 20, borderWidth: 3, borderColor: palette.surface, backgroundColor: palette.ink }} /></PointAnnotation>)}
    {positions.map(position => <PointAnnotation key={position.participantId} id={`live-${position.participantId}`} coordinate={[position.longitude, position.latitude]}><View style={{width:18,height:18,borderRadius:9,backgroundColor:palette.live,borderWidth:3,borderColor:palette.surface}}/></PointAnnotation>)}
    {venues.map((v, i) => <PointAnnotation key={v.id} id={v.id} coordinate={[v.longitude, v.latitude]} title={v.name}><View style={{ width: 32, height: 32, borderRadius: 20, backgroundColor: palette.brand, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: palette.surface, fontWeight: '700' }}>{i + 1}</Text></View></PointAnnotation>)}
  </MapView></View>;
}
