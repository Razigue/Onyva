import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { tokens } from '../../theme';

/** Placeholder block shaped like the content to come. Gentle pulse, still when the system reduces motion. */
export function Skeleton({ width = '100%', height = 16, radius = 8 }: { width?: number | `${number}%`; height?: number; radius?: number }) {
  const opacity = useSharedValue(1);
  useEffect(() => { opacity.value = withRepeat(withTiming(0.45, { duration: 800, reduceMotion: ReduceMotion.System }), -1, true); }, [opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[{ width, height, borderRadius: radius, backgroundColor: tokens.colors.chip }, style]} />;
}

/** Groups placeholders under one spoken label, so a screen reader hears "Chargement" once. */
export function SkeletonGroup({ label, children }: { label: string; children: ReactNode }) {
  return <View accessible accessibilityRole="progressbar" accessibilityLabel={label} className="gap-3">{children}</View>;
}
