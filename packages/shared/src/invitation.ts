import { z } from 'zod';
export const shortInviteCodeSchema = z.string().regex(/^[A-HJ-NP-Z2-9]{8}$/);
export const invitationTokenSchema = z.union([z.string().uuid(), shortInviteCodeSchema]);
export function normalizeInviteCode(value: string): string | null {
  let token = value.trim();
  if (/^(https?:|onyva:)\/\//i.test(token)) {
    try { token = new URL(token).searchParams.get('code') ?? ''; } catch { return null; }
  }
  const normalized = token.toUpperCase().replace(/[\s-]/g, '');
  const short = shortInviteCodeSchema.safeParse(normalized);
  if (short.success) return short.data;
  const uuid = z.string().uuid().safeParse(token);
  return uuid.success ? uuid.data : null;
}
export function inviteFromReferrer(value: string): string | null {
  const params = new URLSearchParams(value);
  return normalizeInviteCode(params.get('onyva_invite') ?? '');
}
export function playStoreInviteUrl(storeUrl: string, code: string): string {
  const url = new URL(storeUrl);
  if (url.protocol !== 'https:' || url.hostname !== 'play.google.com') {
    throw new Error('Lien Google Play invalide.');
  }
  const token = invitationTokenSchema.parse(code);
  url.searchParams.set('referrer', new URLSearchParams({ onyva_invite: token }).toString());
  return url.toString();
}
