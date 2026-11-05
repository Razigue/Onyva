# Configuration connectée

La stack active utilise Expo, Supabase et PRIM, plus un import OSM hebdomadaire. Aucun serveur de transport, domaine de routage, Docker applicatif ou compte Oracle à provisionner.

## Prérequis manuels

| Élément | À renseigner par le propriétaire |
| --- | --- |
| PRIM | Clé autorisée pour Navitia, quota gratuit exact confirmé dans « Ma consommation API », débit et conditions de cache |
| Supabase | Projet gratuit, URL, clé publique, clé serveur, identifiants CLI de déploiement |
| Google et Apple | Identifiants OAuth dans Supabase, URL de retour autorisées ; Apple obligatoire avant distribution iOS avec Google |
| Expo/EAS | Projet, signature Android/iOS, FCM V1/APNs, identifiant public du projet et fichier Firebase pour Android |
| Cloudflare Pages | Projet d’invitations, variables publiques et associations de signature |
| GitHub Actions | Secrets de l’import régional et du déploiement, minutes gratuites disponibles |
| Appareils | Deux téléphones pour valider installation, permissions, notification, carte et parcours réel |

Conserver les secrets dans les fichiers ignorés, EAS ou les secrets GitHub. Ne jamais les coller dans le code ou dans un message. Le quota PRIM gratuit et la latence ne sont pas déduits d’un autre service IDFM ou de Navitia SNCF : voir [PRIM](prim.md).

## En local

```sh
pnpm install
pnpm supabase:start
pnpm live:local:configure
pnpm exec supabase migration up --local
pnpm db:types
```

Si les fichiers existent déjà, le configurateur ne les écrase pas. Utiliser `.env.example` pour retirer les anciennes variables `ROUTING_*`, `GTFS_*` et `OVERPASS_*`, puis renseigner les nouvelles. Les données historiques déjà confirmées restent lisibles ; aucune infrastructure de l’ancien moteur n’est démarrée.

Ajouter `PRIM_API_KEY`, `PRIM_DAILY_LIMIT` et `PRIM_QUOTA_CONFIRMED=true` dans les secrets serveur et dans `supabase/functions/.env.local`. Renseigner uniquement un plafond gratuit confirmé pour le compte. Les imports de stations et les fonctions partagent ce budget quotidien. Générer `LOCATION_SIGNING_SECRET` et `NOTIFICATIONS_SECRET` avec au moins 32 caractères aléatoires ; le configurateur local le fait automatiquement pour une installation neuve.

```sh
pnpm stations:import
pnpm supabase:functions
# Autre terminal
pnpm dev:all
```

L’application utilise le port 8082 et les invitations le port 4174. Pour des téléphones physiques, employer des URL accessibles et des retours OAuth correspondant au build. Les builds EAS `preview` et `production` refusent les URL localhost, les clés publiques absentes ou un projet EAS non lié.

## Schéma et types

```sh
pnpm exec supabase migration new nom_de_migration
# Écrire le SQL dans supabase/migrations.
pnpm exec supabase migration up --local
pnpm db:types
pnpm test:database
```

Pour rejouer des captures réelles, renseigner les variables `PRIM_FIXTURE_*` de `.env.example`, lancer `pnpm prim:record`, puis `pnpm test`. La capture consomme trois appels par station de départ choisie et ne doit être lancée qu’après confirmation du quota.

Les types de `packages/shared/src/generated/database.ts` sont générés par la CLI, pas édités à la main. Les schémas Zod restent nécessaires pour les entrées réseau. Les anciennes migrations gardent leurs noms pour respecter l’historique d’un projet déjà utilisé. Le dossier de métadonnées Drizzle et ses dépendances ont été retirés.

## Import OSM régional

Le workflow `import-venues.yml` télécharge un seul [extrait PBF Île-de-France Geofabrik](https://download.geofabrik.de/europe/france/ile-de-france.html), le parcourt avec PyOsmium puis importe les établissements par lots dans Supabase. Aucun appel par lieu et aucune requête Overpass.

Configuration GitHub : variable `SUPABASE_URL`, secret `SUPABASE_SERVICE_ROLE_KEY`. La tâche s’exécute le lundi à 03 h 20 UTC et peut être lancée manuellement. Les imports concurrents sont bloqués. Le catalogue précédent reste actif jusqu’à activation complète du nouveau ; les lots échoués sont nettoyés après un jour.

Pour reproduire l’import localement, utiliser Python 3.12 dans un environnement virtuel :

```sh
pip install -r scripts/venues/requirements.txt
curl --fail --location https://download.geofabrik.de/europe/france/ile-de-france-latest.osm.pbf --output /tmp/ile-de-france.osm.pbf
python scripts/venues/extract.py /tmp/ile-de-france.osm.pbf > /tmp/onyva-venues.jsonl
OSM_VENUES_FILE=/tmp/onyva-venues.jsonl pnpm venues:import
```

Les horaires sont évalués dans le fuseau de Paris pour les seize prochains jours, afin de couvrir une semaine entre deux imports et les sept jours de planification. Les horaires inconnus restent exclus des suggestions. PostGIS utilise un index géographique et une estimation de marche conservatrice ; l’itinéraire PRIM détaillé vérifie la marche finale. L’attribution OSM et la licence ODbL restent affichées.

## Déployer Supabase

Renseigner les variables de `.env.example` dans l’environnement du déploiement, puis :

```sh
pnpm deploy:supabase
```

Le script sélectionne explicitement `SUPABASE_PROJECT_REF`, applique le SQL, envoie les secrets, déploie `recommend`, `location`, `delete-account` et `dispatch-notifications`, puis configure le planificateur des notifications dans Vault. `pg_cron` et `pg_net` appellent ce dispatcher une fois par minute. Sans configuration Vault, le planificateur ne fait aucun appel. Aucun secret de position n’est stocké avec une position et aucun point GPS ne passe par un déclencheur SQL.

Le workflow manuel `deploy-supabase.yml` expose les mêmes entrées. Ne pas réutiliser une ancienne variable de routage pour une clé PRIM.

Pour OAuth, le retour du fournisseur est `https://<project-ref>.supabase.co/auth/v1/callback`. Ajouter `onyva://auth` et l’URL web `/auth` autorisée dans Supabase. Configurer les identifiants Google et Apple dans Supabase, jamais dans Expo.

## Invitations et builds natifs

Construire puis publier la page :

```sh
pnpm --filter invite build
```

Publier `apps/invite/dist` sur Cloudflare Pages. Renseigner ses variables `VITE_*`, `APPLE_APP_ID` et `ANDROID_CERT_FINGERPRINT`, ainsi que les URL réelles des boutiques. Le script d’associations charge aussi les fichiers `.env.local` et rejette un format de signature invalide. Copier l’URL HTTPS dans `EXPO_PUBLIC_INVITE_URL` avant de reconstruire l’application.

Dans `apps/mobile`, avec EAS CLI et les comptes appropriés :

```sh
eas login
eas init
eas credentials
eas build --platform android --profile preview
```

Pour iOS, configurer la signature et les appareils autorisés avant le build correspondant. Pour les notifications, suivre [Expo Push](https://docs.expo.dev/push-notifications/push-notifications-setup/) et [FCM V1](https://docs.expo.dev/push-notifications/fcm-credentials/). Un APK installé hors Google Play ne reçoit pas l’Install Referrer : rouvrir le lien pour ce type de pilote. Sur iOS, le bouton de copie nécessite un contexte sécurisé ; en cas de refus, le code peut être saisi à la main.

## Vérification sur le terrain

- Connexion réelle sur deux téléphones, puis création et invitation après connexion.
- Résultats progressifs ; aucun lieu confirmable avant la vérification de tous ses retours.
- Réaction de l’invité visible par l’organisateur, puis notification de confirmation et calendrier.
- Installation depuis Google Play avec le referrer ; installation iOS après copie du code, avec proposition de collage au premier lancement.
- Écran verrouillé : envoi HTTP de chaque mise à jour récente, aucune connexion WebSocket dans la tâche, arrêt à l’arrivée et à 90 minutes.
- Carte fermée ou application en arrière-plan : absence d’abonnement Realtime de réception. Non-membre et ancien membre refusés.
- Lecture hors connexion, reprise réseau et suppression d’un compte de test depuis l’application.
- Captures PRIM réelles, comparaison des allers et retours avec IDFM, Noctilien, travaux et changement d’heure.
- Mesure de latence pour dix personnes, contrôle du compteur et du comportement à quota épuisé.
- Durée de l’import OSM, taille des tables et index, minutes GitHub Actions et limites gratuites Supabase.

Les fonctionnalités V2/V3 non demandées, telles que Vélib, les rappels de départ ou les retours partagés, ne sont pas ajoutées par cette migration.

### Mise en attente de la recherche automatique

`RECOMMENDATIONS_ENABLED=false` désactive la recherche automatique et son indicateur de disponibilité. La vérification d’un lieu manuel reste disponible si PRIM est configuré. La vérification du quota reste distincte. Ce réglage est déployé comme secret serveur ; il permet de préparer le backend sans lancer le calcul du juste milieu. Le choix manuel passe par `list_outing_venues` puis `select_outing_venue`. Les allers et retours restent obligatoires avant confirmation.

Le script `pnpm deploy:supabase` charge le `.env` racine, cible explicitement le projet lié et transmet la carte d’imports Deno au compilateur distant. Les fichiers `.env.local` des applications doivent utiliser les URL et clés publiques du même projet.

## Suite autonome et accès manquants

La base distante, les fonctions, les catalogues et Google sont configurés. Apple reste volontairement à faire plus tard ; ne pas publier la version iOS tant que cette connexion obligatoire n’est pas prête.

### Invitations publiques

Le workflow `.github/workflows/deploy-invite.yml` construit le site et publie `apps/invite/dist` sur Cloudflare Pages, selon la [procédure officielle](https://github.com/cloudflare/wrangler-action). Il est déclenché manuellement pour éviter un déploiement public involontaire. Aucun domaine acheté n’est requis : un domaine `pages.dev` suffit.

Il manque un compte Cloudflare accessible, le projet Pages, le secret GitHub `CLOUDFLARE_API_TOKEN` limité à Pages et les variables `CLOUDFLARE_ACCOUNT_ID` et `CLOUDFLARE_PAGES_PROJECT`. Les variables publiques Supabase et le secret d’import Supabase sont configurés dans GitHub. Le dépôt est encore vide ; la visibilité du code doit être choisie avant son premier envoi. Sans workflow présent sur la branche par défaut, l’import planifié n’est pas actif.

Après publication, renseigner son URL HTTPS dans `EXPO_PUBLIC_INVITE_URL`, ajouter l’URL `/auth` de l’application web dans Supabase si elle est aussi publiée, et fournir les véritables empreintes de signature Android avant de prétendre que les liens universels sont validés.

### Android et notifications

Aucune session Expo n’est disponible sur cette machine. Il faut se connecter à Expo, lier un projet EAS gratuit, puis fournir `EXPO_PUBLIC_EAS_PROJECT_ID`. Android exige le fichier Firebase `google-services.json` et les identifiants FCM v1 dans EAS. Suivre la [configuration officielle des notifications](https://docs.expo.dev/push-notifications/push-notifications-setup/). Garder Firebase sur l’offre Spark et EAS dans son quota gratuit ; aucun dépassement automatique.

Le profil EAS `preview` produit une version installable en interne. Installer sur deux téléphones et valider connexion Google, invitation, adhésion, lieu manuel, allers/retours, confirmation, notifications, hors connexion, suppression du compte et position écran verrouillé. L’Install Referrer nécessite un vrai passage par Google Play ; un APK seul ne valide pas ce parcours.

### Vérification distante reproductible

`ONYVA_LIVE_TEST_CONFIRMED=true pnpm test:manual` utilise deux comptes jetables, vérifie le code court et l’adhésion, choisit un établissement réel puis contrôle les trajets à deux et dix participants. La suppression des comptes et données de test s’exécute en fin de test, même en cas d’échec. Ce test ne contacte aucun ami, n’envoie aucune notification et ne remplace pas un essai physique. Il consomme jusqu’à 20 requêtes PRIM à froid ; chaque requête réserve son unité dans le compteur partagé. Une relance consomme un nouveau budget.
