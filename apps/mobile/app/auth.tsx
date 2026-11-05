import { useEffect } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Text, View } from 'react-native';
import { Button, Notice, Shell, ui } from '../src/components/ui';
import { useStore } from '../src/lib/store';
import { authErrorMessage } from '../src/lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function Auth() {
  const { userId, anonymous } = useStore();
  const params = useLocalSearchParams<{ error_code?: string; error?: string }>();
  const failure = typeof params.error_code === 'string' ? params.error_code : typeof params.error === 'string' ? params.error : null;
  useEffect(() => {
    if (failure || !userId || anonymous) return;
    void AsyncStorage.getItem('onyva:pending-invite').then(code => { router.replace(code ? { pathname: '/join', params: { code } } : '/account'); });
  }, [userId, anonymous, failure]);
  if (failure) return <Shell narrow><View style={ui.section}><Notice warning>{authErrorMessage(failure)}</Notice><Button secondary onPress={() => router.replace('/account')}>Retour à mon compte</Button></View></Shell>;
  return <Shell narrow><View style={ui.section}><ActivityIndicator /><Text style={ui.body}>On termine ta connexion…</Text><Button secondary onPress={() => router.replace('/account')}>Retour à mon compte</Button></View></Shell>;
}
