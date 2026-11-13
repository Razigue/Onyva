import { View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { palette } from '../../theme';

export type MotifVariant = 'together' | 'waiting' | 'apart' | 'offline';

const paths = ['M8 14 C48 14 52 48 80 48', 'M8 82 C48 82 52 48 80 48', 'M152 10 C112 10 108 48 80 48'];
// Lines that stop before the meeting point, for "no venue suits everyone".
const short = ['M8 14 C40 14 46 34 58 40', 'M8 82 C40 82 46 62 58 56', 'M152 10 C120 10 114 30 102 38'];
const colors = [palette.brand, palette.ink, palette.lime];

/**
 * Convergence motif of DESIGN.md for empty states. Decorative and hidden from screen readers: the text next to it
 * always says what is going on.
 */
export function ConvergenceMotif({ variant = 'together', size = 'large' }: { variant?: MotifVariant; size?: 'large' | 'small' }) {
  const width = size === 'large' ? 160 : 64, height = size === 'large' ? 96 : 38;
  const lines = variant === 'apart' ? short : paths;
  return <View accessible={false} importantForAccessibility="no-hide-descendants" style={{ width, height }}>
    <Svg width={width} height={height} viewBox="0 0 160 96">
      {lines.map((d, i) => {
        const muted = variant === 'offline' || (variant === 'waiting' && i > 0);
        return <Path key={i} d={d} fill="none" stroke={muted ? palette.border : colors[i]} strokeWidth={8} strokeLinecap="round" strokeDasharray={muted ? '2 14' : undefined} />;
      })}
      {variant === 'together' || variant === 'waiting'
        ? <><Circle cx={80} cy={48} r={12} fill={palette.paper} /><Circle cx={80} cy={48} r={6} fill={palette.brand} /></>
        : <Circle cx={80} cy={48} r={8} fill="none" stroke={variant === 'offline' ? palette.border : palette.muted} strokeWidth={3} />}
    </Svg>
  </View>;
}
