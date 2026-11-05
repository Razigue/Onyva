import { activityLabels, formatTime, invitationPreviewSchema, playStoreInviteUrl } from '@onyva/shared';
import './style.css';

const element = (id: string) => document.getElementById(id)!;
const code = new URL(location.href).searchParams.get('code');
const config = import.meta.env;
async function load() {
  if (!code || !/^[\da-f-]{36}$/i.test(code)) { element('summary').textContent = 'Ce lien est incomplet. Demande une nouvelle invitation à ton ami.'; return; }
  if (!config.VITE_SUPABASE_URL || !config.VITE_SUPABASE_ANON_KEY) { element('summary').textContent = 'Les invitations seront bientôt disponibles. Reviens avec le lien de ton ami.'; return; }
  try {
    const response = await fetch(`${config.VITE_SUPABASE_URL}/rest/v1/rpc/preview_invitation`, { method: 'POST', headers: { apikey: config.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${config.VITE_SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ invite_code: code }) });
    if (!response.ok) throw new Error('Unavailable');
    const parsed = invitationPreviewSchema.safeParse(await response.json());
    if (!parsed.success) { element('summary').textContent = 'Cette invitation a expiré. C’est le moment de prévoir la prochaine sortie !'; return; }
    const invitation = parsed.data;
    element('title').textContent = `${invitation.name} t’invite.`;
    element('summary').textContent = `${activityLabels[invitation.activity]}, le ${new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'long' }).format(new Date(invitation.startsAt))} à ${formatTime(invitation.startsAt)}. Déjà ${invitation.count} dans la bande.`;
    if (invitation.shortCode) {
      element('stores').hidden = false;
      const shortCode = invitation.shortCode;
      const display = element('invite-code'); display.textContent = `Ton code : ${shortCode}`; display.hidden = false;
      const copy = element('copy-code'); copy.hidden = false;
      copy.addEventListener('click', () => { void navigator.clipboard.writeText(shortCode).then(() => { element('copy-status').textContent = 'Code copié. Onyva te proposera de le coller au premier lancement.'; }).catch(() => { element('copy-status').textContent = 'Le code n’a pas pu être copié. Note ses 8 caractères.'; }); });
    }
    const open = element('open') as HTMLAnchorElement;
    open.href = `onyva://join?code=${encodeURIComponent(code)}`; open.hidden = false;
    for (const [id, url] of [['ios', config.VITE_IOS_STORE_URL], ['android', config.VITE_ANDROID_STORE_URL]]) {
      if (url && String(url).startsWith('https://')) { const link = element(id) as HTMLAnchorElement; link.href = id === 'android' ? playStoreInviteUrl(url, invitation.shortCode ?? code!) : url; link.hidden = false; element('stores').hidden = false; }
    }
  } catch { element('summary').textContent = 'L’invitation est indisponible pour le moment. Recharge la page pour réessayer.'; }
}
void load();
