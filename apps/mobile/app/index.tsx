import { useWindowDimensions } from 'react-native';
import { HomeHero } from '../src/components/home/HomeHero';
import { HomePromises } from '../src/components/home/HomePromises';
import { NextOutingCard } from '../src/components/home/NextOutingCard';
import { Shell } from '../src/components/ui';
import { useStore } from '../src/lib/store';

export default function Home() {
  const { outing } = useStore();
  const wide = useWindowDimensions().width >= 1100;
  return <Shell>
    <HomeHero wide={wide} />
    <NextOutingCard outing={outing} wide={wide} />
    <HomePromises wide={wide} />
  </Shell>;
}
