import '../src/lib/location-task';
import {useEffect} from 'react';
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
  useEffect(()=>{const check=()=>{void stopExpiredTracking().catch(()=>undefined);};check();const timer=setInterval(check,30000);const listener=AppState.addEventListener('change',check);return()=>{clearInterval(timer);listener.remove();};},[]);
  return <SafeAreaProvider><StoreProvider><NotificationNavigation /><InstallInvitation /><StatusBar style="dark" /><Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: palette.paper }, animation: 'fade' }} /></StoreProvider></SafeAreaProvider>;
}
