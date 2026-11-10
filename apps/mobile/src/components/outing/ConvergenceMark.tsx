import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { Easing, ReduceMotion, useAnimatedProps, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import { palette } from '../../theme';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const LENGTH = 40;
const lines = [
  { d: 'M2 6 C14 6 16 20 24 20', color: palette.brand },
  { d: 'M2 34 C14 34 16 20 24 20', color: palette.ink },
  { d: 'M46 4 C34 4 32 20 24 20', color: palette.lime },
];

function Line({ d, color, delay, replay }: { d: string; color: string; delay: number; replay: string }) {
  const offset = useSharedValue(LENGTH);
  useEffect(() => {
    offset.value = LENGTH;
    offset.value = withDelay(delay, withTiming(0, { duration: 420, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System }));
  }, [replay, delay, offset]);
  const props = useAnimatedProps(() => ({ strokeDashoffset: offset.value }));
  return <AnimatedPath d={d} fill="none" stroke={color} strokeWidth={4} strokeLinecap="round" strokeDasharray={LENGTH} animatedProps={props} />;
}

/**
 * Small convergence motif drawn when results arrive: three journeys meet at one point. Decorative only, it runs
 * next to numbers that are already displayed and stays still when the system asks to reduce motion.
 */
export function ConvergenceMark({ replay }: { replay: string }) {
  const dot = useSharedValue(0);
  useEffect(() => {
    dot.value = 0;
    dot.value = withDelay(380, withTiming(1, { duration: 180, reduceMotion: ReduceMotion.System }));
  }, [replay, dot]);
  const dotProps = useAnimatedProps(() => ({ r: 4 * dot.value }));
  return <View accessible={false} importantForAccessibility="no-hide-descendants" style={{ width: 48, height: 40 }}>
    <Svg width={48} height={40} viewBox="0 0 48 40">
      {lines.map((line, i) => <Line key={i} d={line.d} color={line.color} delay={i * 70} replay={replay} />)}
      <AnimatedCircle cx={24} cy={20} fill={palette.brand} animatedProps={dotProps} />
    </Svg>
  </View>;
}
