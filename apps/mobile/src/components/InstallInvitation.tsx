import { useEffect, useState } from 'react';
import { Modal, Platform, Text, View } from 'react-native';
import { router, usePathname, useRootNavigationState } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';
import * as Clipboard from 'expo-clipboard';
import { inviteFromReferrer, normalizeInviteCode } from '@onyva/shared';
import { Button, Field, Notice, ui } from './ui';
const handledKey = 'onyva:install-invite-handled';
export function InstallInvitation() {
  const path = usePathname();
  const navigation = useRootNavigationState();
  const [visible, setVisible] = useState(false),
    [code, setCode] = useState(''),
    [error, setError] = useState('');
  async function open(value: string) {
    const normalized = normalizeInviteCode(value);
    if (!normalized) {
      setError('Ce code est incomplet. Copie les 8 caractères de ton invitation.');
      return;
    }
    await AsyncStorage.setItem('onyva:pending-invite', normalized);
    await AsyncStorage.setItem(handledKey, '1');
    setVisible(false);
    router.push({ pathname: '/join', params: { code: normalized } });
  }
  useEffect(() => {
    if (!navigation?.key) return;
    let cancelled = false;
    void (async () => {
      if (await AsyncStorage.getItem(handledKey)) return;
      if (
        path === '/join' || path === '/auth' || await AsyncStorage.getItem('onyva:pending-invite')
      ) {
        await AsyncStorage.setItem(handledKey, '1');
        return;
      }
      if (Platform.OS === 'android') {
        try {
          const referrer = inviteFromReferrer(await Application.getInstallReferrerAsync());
          if (cancelled) return;
          if (referrer) await open(referrer);
          else await AsyncStorage.setItem(handledKey, '1');
        } catch { /* Sideloaded builds have no Play referrer. An invitation link still works. */ }
      } else if (Platform.OS === 'ios' && !cancelled) setVisible(true);
    })().catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [path, navigation?.key]);
  return (
    <Modal
      visible={visible}
      transparent
      animationType='fade'
      onRequestClose={() => setVisible(false)}
    >
      <View style={{ flex: 1, backgroundColor: '#0006', justifyContent: 'center', padding: 24 }}>
        <View style={{ ...ui.card, gap: 18 }}>
          <Text style={ui.subtitle}>Tu as un code d’invitation ?</Text>
          <Text style={ui.body}>
            Colle le code copié avant l’installation, ou saisis ses 8 caractères.
          </Text>
          <Field label='Code d’invitation' value={code} onChangeText={setCode} maxLength={40} />
          <Button
            onPress={() =>
              void Clipboard.getStringAsync().then(open).catch(() =>
                setError('Le presse-papier est indisponible. Saisis ton code.')
              )}
          >
            Coller mon code
          </Button>
          <Button secondary onPress={() => void open(code)}>Utiliser ce code</Button>
          <Button
            secondary
            onPress={() => void AsyncStorage.setItem(handledKey, '1').then(() => setVisible(false))}
          >
            Passer
          </Button>
          {!!error && <Notice warning>{error}</Notice>}
        </View>
      </View>
    </Modal>
  );
}
