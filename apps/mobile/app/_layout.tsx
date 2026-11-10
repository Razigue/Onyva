import '../src/lib/location-task';
import {useEffect} from 'react';
// One import per weight: the package index would bundle every weight of both families.
import { Fraunces_600SemiBold } from '@expo-google-fonts/fraunces/600SemiBold';
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { Inter_800ExtraBold } from '@expo-google-fonts/inter/800ExtraBold';
import { useFonts } from 'expo-font';
import {AppState} from 'react-native';
import {stopExpiredTracking} from '../src/lib/location-task';
import '../global.css';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StoreProvider } from '../src/lib/store';
import { NotificationNavigation } from '../src/components/NotificationNavigation';
import { InstallInvitation } from '../src/components/InstallInvitation';
import { palette } from '../src/theme';

export default function Layout() {
  // Free fonts bundled with the app (SIL Open Font License). If loading fails, the system font takes over.
  const [fontsLoaded, fontError] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold, Fraunces_600SemiBold });
  useEffect(()=>{const check=()=>{void stopExpiredTracking().catch(()=>undefined);};check();const timer=setInterval(check,30000);const listener=AppState.addEventListener('change',check);return()=>{clearInterval(timer);listener.remove();};},[]);
  if (!fontsLoaded && !fontError) return null;
  return <SafeAreaProvider><StoreProvider><NotificationNavigation /><InstallInvitation /><StatusBar style="dark" /><Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: palette.paper }, animation: 'fade' }} /></StoreProvider></SafeAreaProvider>;
}
