import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { notificationDataSchema } from '@onyva/shared';
import { useStore } from '../lib/store';

Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldPlaySound: false, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true }) });

export function NotificationNavigation() {
  const { userId, openOuting, setError } = useStore();
  const handled = useRef<string | null>(null);
  useEffect(() => {
    if (!userId) return;
    const receive = (response: Notifications.NotificationResponse | null) => {
      if (!response) return;
      const id = response.notification.request.identifier;
      const data = notificationDataSchema.safeParse(response.notification.request.content.data);
      if (!data.success || handled.current === id) return;
      handled.current = id;
      void openOuting(data.data.outingId).then(() => router.push('/outing')).catch(() => setError('Cette sortie n’est plus disponible.'));
    };
    void Notifications.getLastNotificationResponseAsync().then(receive).catch(() => undefined);
    const subscription = Notifications.addNotificationResponseReceivedListener(receive);
    return () => subscription.remove();
  }, [userId, openOuting, setError]);
  return null;
}
