# Avoir Onyva dans la main

Guide pas à pas pour installer Onyva sur deux téléphones Android. Chaque étape qui touche un compte externe est faite par toi. Rien ici ne demande un service payant : Expo, Firebase (offre Spark) et Cloudflare Pages restent dans leurs offres gratuites.

L’APK fonctionne en mode « lieu choisi manuellement ». Il n’attend pas le moteur de trajets.

## Ce qu’il te faut

| Élément | Où | Coût |
| --- | --- | --- |
| Compte Expo | expo.dev, connexion par e-mail ou GitHub | Gratuit, quota de builds mensuel limité |
| EAS CLI | `npm install -g eas-cli` sur ta machine | Gratuit |
| Projet Firebase | console.firebase.google.com, offre Spark, sans carte bancaire | Gratuit |
| Compte Cloudflare | dash.cloudflare.com, Pages | Gratuit, domaine `pages.dev` |
| Accès au dépôt GitHub | Réglages du dépôt, secrets et variables Actions | Gratuit |
| Deux téléphones Android | Installation d’APK autorisée (« sources inconnues ») | |

L’ordre compte : la page d’invitation a besoin de l’empreinte de signature Android, et l’application a besoin de l’URL de la page d’invitation.

## 1. Lier le projet Expo

Dans `apps/mobile` :

```sh
eas login
eas init
```

`eas init` crée le projet sur ton compte et affiche son identifiant (un UUID). Comme la configuration est dynamique (`app.config.ts`), reporte-le toi-même :

- dans `apps/mobile/app.json`, sous `expo.extra.eas.projectId` (valeur publique, elle peut être versionnée) ;
- ou dans la variable `EXPO_PUBLIC_EAS_PROJECT_ID`.

Vérifie avec `eas project:info`.

## 2. Créer la clé de signature Android

```sh
eas credentials --platform android
```

Choisis le profil `preview`, puis « Keystore » et « Set up a new keystore ». EAS la conserve pour toi. Note l’empreinte **SHA-256** affichée (format `AB:CD:…`, 32 octets). C’est la valeur de `ANDROID_CERT_FINGERPRINT`.

## 3. Publier la page d’invitation sur Cloudflare Pages

1. Dans Cloudflare, ouvre « Workers et Pages », puis crée un projet Pages en « Direct Upload », par exemple `onyva-invite`. Son adresse sera `https://onyva-invite.pages.dev`.
2. Crée un jeton d’API limité à **Cloudflare Pages : Modifier**, sur ton seul compte.
3. Note l’identifiant de compte (colonne de droite du tableau de bord).
4. Dans GitHub, réglages du dépôt, « Secrets and variables », « Actions » :

| Type | Nom | Valeur |
| --- | --- | --- |
| Secret | `CLOUDFLARE_API_TOKEN` | Le jeton de l’étape 2 |
| Variable | `CLOUDFLARE_ACCOUNT_ID` | L’identifiant de compte |
| Variable | `CLOUDFLARE_PAGES_PROJECT` | `onyva-invite` |
| Variable | `ANDROID_CERT_FINGERPRINT` | L’empreinte SHA-256 de l’étape 2 |
| Variable | `ANDROID_STORE_URL` | Facultatif tant que l’app n’est pas sur Google Play |
| Variable | `IOS_STORE_URL`, `APPLE_APP_ID` | À laisser vides pour l’instant (iOS plus tard) |

`SUPABASE_URL` et `SUPABASE_ANON_KEY` sont déjà configurées.

5. Le workflow ne se lance qu’à la main, depuis la branche par défaut : onglet « Actions », « Déployer les invitations sur Cloudflare Pages », « Run workflow ».
6. Vérifie ensuite ces trois adresses :
   - `https://onyva-invite.pages.dev/join?code=TEST` affiche la page d’invitation ;
   - `https://onyva-invite.pages.dev/.well-known/assetlinks.json` contient `fr.onyva.app` et ton empreinte ;
   - `https://onyva-invite.pages.dev/.well-known/apple-app-site-association` répond en JSON, avec une liste vide tant qu’iOS n’est pas configuré.

L’URL `https://onyva-invite.pages.dev` devient `EXPO_PUBLIC_INVITE_URL`.

## 4. Créer le projet Firebase pour les notifications

1. Crée un projet Firebase, offre Spark. Google Analytics : **désactivé** (Onyva n’utilise aucun SDK d’analyse).
2. Ajoute une application Android avec le nom de package `fr.onyva.app`, puis télécharge `google-services.json`. Range-le dans `apps/mobile/google-services.json` : ce fichier est ignoré par Git.
3. Dans « Paramètres du projet », « Comptes de service », génère une clé privée. Ce fichier JSON est un secret : ne le versionne pas et ne le colle nulle part.
4. Envoie-le à EAS pour FCM V1 :

```sh
eas credentials --platform android
# Google Service Account, puis « Manage your Google Service Account Key for Push Notifications (FCM V1) »
```

## 5. Déclarer les variables du build

Les variables publiques sont visibles dans l’application, ce n’est pas un problème. Aucune clé serveur ne va ici.

```sh
eas env:create --environment preview --name EXPO_PUBLIC_SUPABASE_URL --value "https://<ref>.supabase.co" --visibility plaintext
eas env:create --environment preview --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "<clé publique anon>" --visibility plaintext
eas env:create --environment preview --name EXPO_PUBLIC_INVITE_URL --value "https://onyva-invite.pages.dev" --visibility plaintext
eas env:create --environment preview --name EXPO_PUBLIC_EAS_PROJECT_ID --value "<uuid du projet>" --visibility plaintext
eas env:create --environment preview --name GOOGLE_SERVICES_FILE --type file --value ./google-services.json --visibility secret
```

Vérifie avec `eas env:list --environment preview`. Dans Supabase, « Authentication », « URL Configuration », garde `onyva://auth` parmi les URL de retour autorisées.

## 6. Construire l’APK

```sh
eas build --platform android --profile preview
```

`app.config.ts` refuse le build si une URL est locale, si la clé publique ou le projet EAS manque, ou si le fichier Firebase est absent : lis le message, il dit quoi corriger. À la fin, EAS affiche un lien et un QR code de téléchargement.

Profil `preview` ou `development` ? `preview` donne une application autonome, celle qu’il faut pour un vrai test entre amis. `development` donne un client de développement qui charge le code depuis ta machine (`pnpm --filter mobile start`) : utile pour corriger vite, mais les deux téléphones doivent joindre ton ordinateur. Les deux font fonctionner le GPS en arrière-plan, contrairement à Expo Go.

## 7. Installer sur les deux téléphones

1. Ouvre le lien du build sur chaque téléphone et installe l’APK.
2. Au premier lancement, saisis un prénom. Aucune connexion n’est demandée.
3. Déroule la check-list de [la validation sur appareils](live-validation.md#check-list-à-deux-téléphones) et note chaque résultat à la main.

Un APK installé hors Google Play ne reçoit pas l’Install Referrer : pour ce test, rouvre le lien d’invitation après l’installation, ou saisis le code.

## Si ça bloque

| Symptôme | Piste |
| --- | --- |
| « Set a public HTTPS EXPO_PUBLIC_… » | Variable manquante ou locale dans l’environnement `preview` d’EAS |
| « Link an EAS project… » | `projectId` absent de `app.json` et de `EXPO_PUBLIC_EAS_PROJECT_ID` |
| « Set GOOGLE_SERVICES_FILE… » | Variable fichier absente de l’environnement `preview` |
| Le lien d’invitation ouvre le navigateur | `assetlinks.json` sans la bonne empreinte, ou build signé avec une autre clé |
| Aucune notification | Clé FCM V1 non envoyée à EAS, ou notifications refusées sur le téléphone |
