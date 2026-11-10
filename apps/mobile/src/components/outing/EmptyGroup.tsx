import { Users } from 'lucide-react-native';
import { palette } from '../../theme';
import { Body, Card, Subtitle } from '../ui';

export function EmptyGroup() {
  return <Card className="items-center py-12">
    <Users size={36} color={palette.brand} />
    <Subtitle>Il ne manque qu’un ami.</Subtitle>
    <Body className="max-w-[350px] text-center">Ajoute un deuxième départ pour découvrir les lieux les plus équilibrés.</Body>
  </Card>;
}
