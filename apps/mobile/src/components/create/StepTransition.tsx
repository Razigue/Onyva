import type { ReactNode } from 'react';
import Animated, { FadeInLeft, FadeInRight, ReduceMotion } from 'react-native-reanimated';

/**
 * Short slide between wizard steps (220 ms, DESIGN.md: 150 to 250 ms). The content is there at once and stays
 * readable during the motion, which is skipped when the system asks to reduce animations.
 */
export function StepTransition({ step, direction, children }: { step: number; direction: number; children: ReactNode }) {
  const entering = (direction < 0 ? FadeInLeft : FadeInRight).duration(220).reduceMotion(ReduceMotion.System);
  return <Animated.View key={step} entering={entering} style={{ gap: 20 }}>{children}</Animated.View>;
}
