import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

// Sober haptic feedback, only for a choice made and an important action that succeeded.
// Never on the web, and never an error when the device has no vibrator.
const native = Platform.OS === 'ios' || Platform.OS === 'android';

export function tapSelection() {
  if (native) void Haptics.selectionAsync().catch(() => undefined);
}
export function tapSuccess() {
  if (native) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
}
