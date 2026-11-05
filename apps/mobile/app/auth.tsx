import { useEffect } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, Text } from 'react-native';
import { Shell, ui } from '../src/components/ui';
import { useStore } from '../src/lib/store';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function Auth() {
  const { userId } = useStore();
  useEffect(() => { if (userId) void AsyncStorage.getItem('onyva:pending-invite').then(code => { router.replace(code ? { pathname: '/join', params: { code } } : '/create'); }); }, [userId]);
  return <Shell narrow><ActivityIndicator /><Text style={ui.body}>On termine ta connexion…</Text></Shell>;
}
