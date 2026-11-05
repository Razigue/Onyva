# Onyva

Application Expo iOS et Android pour trouver un lieu de rencontre équitable en transports en Île-de-France. Le produit est défini dans `PRODUCT.md` et les règles de contribution dans `AGENTS.md`.

## Stack actuelle

- Application : Expo Router, React Native, NativeWind, MapLibre et OpenFreeMap.
- Backend : Supabase Auth, PostgreSQL, PostGIS, Edge Functions, Realtime, pg_cron et pg_net.
- Trajets : PRIM IDFM/Navitia, appelé uniquement depuis une Edge Function avec une clé serveur.
- Choix : package TypeScript pur `packages/fairness`, maximum puis somme puis écart.
- Lieux : import hebdomadaire d’un extrait régional OpenStreetMap depuis Geofabrik, activé atomiquement dans Supabase. Aucun appel Overpass.
- Données : migrations SQL Supabase et types générés dans `packages/shared/src/generated/database.ts`. Zod valide les frontières.
- Outils : pnpm workspaces, TypeScript, Vitest, Playwright et Maestro. Aucun Turborepo, Drizzle, service Node de routage ni VM.

L’ancien calculateur est décrit comme [plan B](docs/plan-b.md), hors runtime.

## Essayer sans compte

Node.js 24 et pnpm 10.28.2 sont requis.

```sh
pnpm install
pnpm dev
```

Ouvrir **http://localhost:8082**. Le catalogue local contient des établissements OSM réels et datés. Les trajets et les retours restent simulés et sont signalés comme tels. Cet aperçu ne garantit ni le transport réel ni l’ouverture actuelle d’un établissement. Le bouton de partage explique que cet essai reste sur un seul appareil.

Le parcours permet de créer une sortie, ajouter des amis manuellement, comparer les lieux, réagir, confirmer et exporter le rendez-vous au calendrier. La sortie est restaurée depuis le cache local tant qu’elle n’a pas expiré.

## Mode connecté

Consulter le [guide de configuration](docs/live-setup.md) et les [vérifications PRIM](docs/prim.md).

```sh
pnpm supabase:start
pnpm live:local:configure
pnpm exec supabase migration up --local
pnpm db:types
pnpm supabase:functions
```

Le configurateur refuse d’écraser les fichiers locaux existants. Compléter `.env.example`, les fichiers ignorés de l’application et ceux des fonctions. Une clé PRIM, un plafond gratuit confirmé et `PRIM_QUOTA_CONFIRMED=true` sont requis pour les trajets réels. Aucun quota gratuit chiffré n’est supposé. Les connexions Google et Apple ont leurs propres identifiants à configurer dans Supabase.

Importer les stations avec `pnpm stations:import` après confirmation du quota. L’import OSM est effectué par `.github/workflows/import-venues.yml`, chaque semaine ou manuellement. Un catalogue vide, trop ancien ou incomplet ne produit pas de lieux fictifs.

## Choix manuel disponible

La recherche du juste milieu est en pause. En mode connecté, l’organisateur choisit une station de rendez-vous puis un établissement ouvert à proximité. PRIM vérifie les allers et retours, sans isochrone. Seuls les lieux vérifiés pour tout le groupe peuvent être confirmés. Aucun label d’optimum n’est appliqué à ce choix manuel. Les invités peuvent aussi saisir le code court depuis « Mon compte » puis « Rejoindre avec un code ».

Google est configuré sur le projet distant courant. Apple reste en attente et n’est pas proposé tant qu’il n’est pas activé dans Supabase. La version iOS ne doit pas être publiée avec Google seul. Les [mesures réelles du mode manuel](docs/prim.md) et la [validation](docs/live-validation.md) distinguent les essais réseau, les tests navigateur et les validations physiques encore nécessaires.

## Recherche automatique en pause

Lorsque la recherche automatique est réactivée, l’Edge Function `recommend` authentifie la personne, vérifie son appartenance à la sortie et lance un travail court en arrière-plan. Les isochrones tabulaires individuelles sont réutilisées pendant 180 secondes. Les paramètres et la date font partie de la clé de cache ; l’ajout d’un ami ne recalcule pas les isochrones encore fraîches des autres.

Les stations sont classées par maximum, somme et écart. Trois lieux sont présélectionnés. Chaque personne dispose ensuite d’un aller détaillé arrivant avant le rendez-vous et d’un retour après la fin. Aucun résultat provisoire n’est confirmable. Le cache, les verrous et les résultats sont partagés en base et supprimés avec la sortie. Un contrôle de révision empêche la publication d’un résultat calculé pour une ancienne composition du groupe.

Objectif : expérience progressive autour de trois secondes pour dix personnes. La latence réelle est **à vérifier**. Un cache froid peut nécessiter jusqu’à 70 appels pour dix personnes, car les allers détaillés et les retours s’ajoutent aux dix isochrones. L’isochrone au départ ne démontre pas, à lui seul, l’optimum global des trajets à l’arrivée. Les paramètres et cette garantie restent à valider sur les réponses PRIM réelles. Voir [les limites documentées](docs/prim.md).

## Position et invitations

La tâche native `expo-task-manager` envoie les positions par HTTP à la fonction `location`. Celle-ci vérifie la session, l’appartenance au groupe et un droit signé de 90 minutes avant un relais Realtime HTTP privé. Aucune position n’est écrite en base, dans un cache persistant ou dans les logs. Seules les cartes visibles au premier plan ouvrent une connexion Realtime, supprimée à la fermeture ou en arrière-plan.

Un build natif est requis pour le suivi. Les exports JavaScript ne prouvent pas le fonctionnement écran verrouillé ni l’arrêt effectif du capteur à l’expiration.

Après installation Android, `expo-application` récupère l’Install Referrer de Google Play. Sur iOS, la page affiche un code court et permet de le copier ; l’application propose de le coller ou de le saisir au premier lancement, sans lecture automatique du presse-papier. Les codes expirent avec les invitations et leur résolution est limitée.

## Vérifications

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm test:database
pnpm build
pnpm test:e2e
pnpm test:live
# Essai distant explicite, comptes temporaires et consommation PRIM :
ONYVA_LIVE_TEST_CONFIRMED=true pnpm test:manual
```

Les tests SQL créent une base PostgreSQL/PostGIS temporaire dans le conteneur Supabase local, appliquent les migrations et la suppriment ensuite. Ils ne modifient pas les données du projet. Le test PRIM connecté est explicitement ignoré quand la clé ou la confirmation de quota manque. Les exemples de contrat Navitia sont identifiés comme synthétiques ; des captures PRIM authentiques restent à ajouter.

L’état des vérifications de cette migration est consigné dans [le rapport local](docs/live-validation.md). Les parcours Maestro nécessitent des appareils et une invitation réelle. Aucun test navigateur ne valide une installation depuis une boutique, la connexion Apple/Google réelle ou les permissions GPS natives.

## Déploiement gratuit au départ

- Base, fonctions, cache et notifications planifiées : Supabase. Les secrets du planificateur sont dans Vault ; pg_cron appelle la fonction de notifications par pg_net, sans VM.
- Lieux : GitHub Actions hebdomadaire. Surveiller les minutes gratuites et le stockage Supabase.
- Invitations : Cloudflare Pages, avec les associations universelles et les identifiants réels de signature.
- Application : EAS dans les quotas gratuits. Les éventuels frais de publication dans les boutiques restent séparés.

Les comptes, clés, quotas et signatures réels restent à configurer. Aucune montée en gamme payante n’est activée. Google Maps est un lien externe pour consulter les avis ; Google Places reste désactivé.
