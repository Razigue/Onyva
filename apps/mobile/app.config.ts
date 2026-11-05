import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  const inviteUrl = process.env.EXPO_PUBLIC_INVITE_URL;
  const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID ?? config.extra?.eas?.projectId;
  if (['preview', 'production'].includes(process.env.EAS_BUILD_PROFILE ?? '')) {
    for (const key of ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_INVITE_URL']) {
      const value = process.env[key];
      if (!value || new URL(value).protocol !== 'https:' || ['localhost', '127.0.0.1'].includes(new URL(value).hostname)) throw new Error(`Set a public HTTPS ${key} before building for real devices`);
    }
    if (!process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) throw new Error('Set EXPO_PUBLIC_SUPABASE_ANON_KEY before building');
    if (typeof projectId !== 'string' || !/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(projectId)) throw new Error('Link an EAS project and set EXPO_PUBLIC_EAS_PROJECT_ID before building');
    if (process.env.EAS_BUILD_PLATFORM === 'android' && !process.env.GOOGLE_SERVICES_FILE && !config.android?.googleServicesFile) throw new Error('Set GOOGLE_SERVICES_FILE for Android confirmation notifications');
  }
  const host = inviteUrl ? new URL(inviteUrl).hostname : null;
  return {
    ...config, name: 'Onyva', slug: 'onyva',
    extra: { ...config.extra, ...(projectId ? { eas: { ...config.extra?.eas, projectId } } : {}) },
    ios: { ...config.ios, ...(host ? { associatedDomains: [`applinks:${host}`] } : {}) },
    android: { ...config.android, blockedPermissions: ['android.permission.READ_CALENDAR', 'android.permission.WRITE_CALENDAR'], ...(process.env.GOOGLE_SERVICES_FILE ? { googleServicesFile: process.env.GOOGLE_SERVICES_FILE } : {}), ...(host ? { intentFilters: [{ action: 'VIEW', autoVerify: true, data: [{ scheme: 'https', host, pathPrefix: '/join' }], category: ['BROWSABLE', 'DEFAULT'] }] } : {}) },
  };
};
