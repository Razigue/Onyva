import { View } from 'react-native';
import type { ViewStyle } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { palette } from '../../theme';

/** Signature motif of DESIGN.md: several journeys meeting at one point. Decorative, hidden from screen readers. */
export function Convergence({ style }: { style?: ViewStyle }) {
  return <View accessible={false} importantForAccessibility="no-hide-descendants" style={style}><Svg width="100%" height="100%" viewBox="0 0 460 380">
    <Path d="M30 -30 V68 C30 125 220 110 230 190 S280 280 480 280" fill="none" stroke={palette.brand} strokeWidth="14" />
    <Path d="M480 20 H390 C320 20 370 140 230 190 S170 300 170 420" fill="none" stroke={palette.lime} strokeWidth="14" />
    <Path d="M-30 330 H65 C150 330 130 220 230 190 S330 210 480 140" fill="none" stroke={palette.ink} strokeWidth="14" />
    <Path d="M-30 145 H45 C130 145 160 190 230 190" fill="none" stroke={palette.coral} strokeWidth="14" />
    <Circle cx="230" cy="190" r="24" fill={palette.paper} />
    <Circle cx="230" cy="190" r="9" fill={palette.brand} />
    <Circle cx="30" cy="68" r="6" fill={palette.surface} /><Circle cx="390" cy="20" r="6" fill={palette.ink} /><Circle cx="65" cy="330" r="6" fill={palette.surface} />
  </Svg></View>;
}
