import { HomeEmpty } from '../src/components/home/HomeEmpty';
import { NextOuting } from '../src/components/home/NextOuting';
import { Shell } from '../src/components/ui';
import { useStore } from '../src/lib/store';

export default function Home() {
  const { outing } = useStore();
  return <Shell narrow>{outing ? <NextOuting outing={outing} /> : <HomeEmpty />}</Shell>;
}
