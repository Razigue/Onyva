import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Card } from './Card';
import { ConvergenceMotif } from './ConvergenceMotif';
import type { MotifVariant } from './ConvergenceMotif';
import { Body, Subtitle } from './Text';

/** Empty, waiting or offline state: what is going on, then what you can do. */
export function EmptyState({ variant, title, children, action }: { variant: MotifVariant; title: string; children?: ReactNode; action?: ReactNode }) {
  return <Card className="items-center gap-3 py-10">
    <ConvergenceMotif variant={variant} />
    <Subtitle className="text-center">{title}</Subtitle>
    {children && <Body className="max-w-[360px] text-center">{children}</Body>}
    {action && <View className="mt-2 w-full max-w-[360px]">{action}</View>}
  </Card>;
}
