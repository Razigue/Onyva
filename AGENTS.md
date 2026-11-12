# AGENTS.md

Instructions pour les agents qui travaillent sur Onyva. Lire `PRODUCT.md` avant toute fonctionnalité. Ce fichier reste la référence pour les parcours, les règles métier et le périmètre.

## Vue d’ensemble

Onyva est une application Expo iOS et Android qui cherche un lieu de rencontre équitable en transports en commun en Île-de-France.

1. L’application parle à Supabase.
2. Supabase fournit PostgreSQL, PostGIS, Auth anonyme avec Apple et Google facultatifs, Realtime, les Edge Functions et pg_cron.
3. Transition en cours : les trajets passent de PRIM/Navitia à un moteur maison alimenté par le GTFS IDFM (décision du 6 novembre 2026, voir `docs/engine.md`). Le moteur est un service Node sans état, appelé uniquement par l’Edge Function `recommend` avec un secret partagé. Il peut tourner sur une VM, Oracle Cloud Always Free pour le MVP, sans aucun service payant. Le moteur est branché dans `recommend` derrière `TRANSIT_PROVIDER=engine` ; PRIM reste le fournisseur actif tant que la VM n’est pas déployée.
4. Une tâche GitHub Actions hebdomadaire importe les lieux depuis l’extrait régional OpenStreetMap, sans Overpass.

Tout doit rester gratuit au départ. Ne jamais ajouter un service payant, une facturation à l’usage ou un dépassement automatique sans accord explicite. Le dépassement d’un quota bloque le service concerné avec un message clair. La gratuité n’est pas une promesse de capacité illimitée.

## Structure

Monorepo pnpm workspaces, TypeScript strict, sans Turborepo.

```
apps/
  mobile/                  Expo Router, NativeWind, MapLibre
  invite/                  Page statique, invitations et liens vers les boutiques
  engine/                  Service HTTP du moteur, sans état, fils parallèles, Docker multi-architecture
packages/
  shared/                  Schémas Zod, types, contrats et types Supabase générés
  fairness/                Règles pures : minimax, présélection et validation des retours
  transit-engine/          Compilation GTFS, instantané binaire, RAPTOR, sans réseau ni base
supabase/
  migrations/              Migrations SQL versionnées, source de vérité de la base
  functions/
    recommend/             Orchestration PRIM ou moteur (TRANSIT_PROVIDER) et résultat progressif
    location/              Réception HTTP des positions et relais Realtime HTTP
    dispatch-notifications/
    delete-account/
    _shared/               Adaptateurs et orchestration testables
scripts/
  venues/                  Extraction OSM régionale et import hebdomadaire
  import-stations.ts       Catalogue de stations PRIM, remplacé par scripts/engine/ à terme
  engine/                  build-network, bench, bench-http, record-references, import-stations, refresh-snapshot.sh
  generate-db-types.mjs     Génération des types depuis Supabase
tests/
  database/                RLS, quotas, concurrence et PostGIS
```

Le moteur maison est documenté dans `docs/engine.md`, phase par phase. `docs/plan-b.md` est une note d’historique.

## Commandes

```bash
pnpm install
pnpm dev                         # aperçu local de l’application
pnpm dev:all                     # application et invitations en parallèle
pnpm --filter mobile start       # build de développement requis pour le GPS en arrière-plan
pnpm supabase:start
pnpm supabase:functions
pnpm exec supabase migration new nom_de_migration
pnpm exec supabase migration up --local
pnpm db:push                      # projet distant explicitement sélectionné
pnpm db:types                     # supabase gen types, schéma public local
pnpm stations:import              # clé PRIM et quota gratuit confirmé requis
pnpm venues:import                # fichier régional déjà extrait
pnpm lint
pnpm typecheck
pnpm test
pnpm test:database                # PostgreSQL/PostGIS isolé dans le conteneur local
pnpm test:e2e
# Test distant explicite avec comptes temporaires et jusqu’à 20 appels gratuits :
ONYVA_LIVE_TEST_CONFIRMED=true pnpm test:manual
# Moteur maison, GTFS décompressé dans data/gtfs-idfm/raw :
pnpm engine:build-network         # GTFS IDFM vers instantané binaire dans data/engine
pnpm engine:bench                 # mémoire et latences sur le GTFS réel
pnpm engine:dev                   # service moteur local, ENGINE_SECRET requis
pnpm engine:bench-http            # latences HTTP d’un service lancé
pnpm engine:record-references     # 20 captures PRIM de référence, --dry-run sans appel
pnpm engine:import-stations       # catalogue depuis l’instantané, simulation sans --apply
```

Avant de terminer : `pnpm lint`, `pnpm typecheck` et `pnpm test` doivent passer. Exécuter aussi les tests SQL si les migrations ou les règles de sécurité changent. Ne jamais modifier une migration déjà appliquée pour faire évoluer le schéma. Ajouter une migration, puis régénérer les types. Ne pas réintroduire Drizzle.

## Architecture

- Tout échange entre l’application, les fonctions, PRIM et la base possède un schéma Zod dans `packages/shared`. Valider les entrées. Aucun `any`.
- Les règles de choix vivent dans `packages/fairness`, sans réseau ni base. Les adaptateurs PRIM restent hors de ce package.
- L’application n’appelle jamais PRIM directement. Une Edge Function vérifie la session et l’appartenance à la sortie.
- Une isochrone tabulaire par départ distinct et heure de rendez-vous alimente la présélection. Le classement minimise le trajet maximum, puis la somme, puis l’écart.
- Les allers à l’heure d’arrivée et les retours après la fin sont vérifiés pour les trois meilleurs lieux présélectionnés. Aucun lieu non vérifié n’est confirmable. Ne pas présenter un polygone isochrone comme un temps exact ni promettre un optimum global non démontré.
- Cache court en base, lié à la sortie et supprimé en cascade. Clés distinctes selon départ, destination, date, direction et fraîcheur. Les temps déjà calculés sont réutilisés tant qu’ils sont frais. Un nouvel arrivant ne relance pas les isochrones des autres.
- Les verrous de calcul et le contrôle de révision empêchent les appels concurrents identiques et les résultats obsolètes. Le compteur PRIM est partagé entre les fonctions, pas seulement en mémoire.
- Les limites gratuites, le plafond de paramètres PRIM et la latence réelle sont documentés dans `docs/prim.md`. Toute information non confirmée est marquée « à vérifier ». Ne jamais inventer une mesure ni une capture PRIM.
- La sécurité est dans la base : RLS sur toutes les tables, accès aux sorties réservé aux membres, mutations réservées aux RPC autorisées. Les caches, quotas et imports sont réservés au serveur.
- Pas de NestJS ni de serveur applicatif supplémentaire. Les fonctions orchestrent les API et publient la progression, elles ne reconstruisent pas un moteur de transport.

## Mode provisoire : lieu choisi manuellement

La recherche du juste milieu est en pause. `RECOMMENDATIONS_ENABLED=false` désactive uniquement la recherche automatique. Un lieu choisi par l’organisateur via `select_outing_venue` reste vérifiable par la fonction `recommend`, sans isochrone. `list_outing_venues` exige l’appartenance à la sortie ; la sélection exige son organisateur. Le lieu est validé à nouveau contre le catalogue actif au calcul. Aucun lieu non vérifié n’est confirmable, aucun label « le plus équilibré » pour un choix manuel. Voir le parcours provisoire de `PRODUCT.md`.

## Invariants produit

- Équité : maximum, somme, écart. Exclure un lieu dès qu’une personne ne peut pas rentrer après la fin.
- Calcul à l’heure prévue de la rencontre, jamais implicitement pour maintenant.
- Trajet complet : marche, attente, correspondances et marche finale incluses.
- Objectif : premier résultat progressif autour de trois secondes pour dix personnes. Mesurer séparément le calcul pur et les appels PRIM ; une mesure locale du package ne valide pas la latence réseau.
- Position : jamais en base, dans les logs, dans un cache persistant ou dans `realtime.send()`. La tâche `expo-task-manager` envoie par HTTP à la fonction `location`, qui relaie par HTTP à Realtime. Aucun WebSocket dans la tâche.
- Seules les cartes visibles au premier plan s’abonnent aux canaux privés. Désabonnement à la fermeture, à la perte de focus et au passage en arrière-plan. Les canaux changent avec la révision de la sortie.
- Arrêt du partage à l’arrivée ou après 90 minutes. Le serveur refuse toute position après expiration du droit signé. Vérifier sur appareil que le système arrête bien le suivi en arrière-plan.
- Adresses : seules les stations de départ et de retour sont stockées pour les participants. Aucune adresse exacte ni adresse affichée pour leur position.
- Suppression : la sortie et toutes ses données liées disparaissent 24 h après sa fin, par pg_cron et suppressions en cascade. Les lieux OSM et le catalogue de stations sont des données de référence, pas des données liées à une sortie.
- Aucun traceur publicitaire ni SDK d’analyse tiers.

## Application et invitations

- Expo Router, NativeWind, MapLibre et fonds OpenFreeMap.
- Aucun compte requis : session anonyme Supabase créée au premier lancement, prénom saisi par la personne. Apple et Google servent seulement à relier la session (`linkIdentity`) ou à retrouver un compte existant. Apple est obligatoire sur iOS dès que Google est proposé.
- Plus d’essai local avec des trajets simulés. Chaque session a un plafond quotidien d’appels PRIM via `reserve_prim_user_call`.
- `expo-location` et `expo-task-manager` pour le suivi. Build de développement obligatoire, pas Expo Go pour l’arrière-plan.
- Notifications Expo envoyées par Edge Function, avec consentement, reprises bornées et contrôle des reçus.
- La sortie courante reste lisible hors connexion.
- Création en quatre écrans préremplis : quand, quoi, départ, résumé. « Suivant », « Suivant », « Créer » suffit.
- Android après installation : le lien Google Play contient l’Install Referrer, lu avec `expo-application`.
- iOS après installation : la page affiche un code court et un bouton de copie. Au premier lancement, l’application propose de coller ou saisir le code. Aucun accès automatique au presse-papier.
- Les codes courts expirent avec l’invitation et les tentatives de résolution sont limitées. Ne pas introduire de service payant de liens différés.

## Langue et tests

Interface et documentation en français, tutoiement, phrases courtes, accents y compris sur les capitales, sans tirets longs. Identifiants de code et noms de fonctions en anglais.

Vitest couvre les règles pures, les réponses PRIM enregistrées quand une clé permet de les capturer, et les cas limites. Les exemples synthétiques restent identifiés comme tels. Ajouter un test pour chaque règle métier changée. Playwright couvre le web. Maestro couvre la création et l’adhésion sur deux appareils ; les parcours natifs exigent une validation physique.

## Données et déploiement

- GTFS IDFM : horaires théoriques sur environ 30 jours, Licence Mobilités, attribution Île-de-France Mobilités. Source, mesures et contrat du moteur dans `docs/engine.md`.
- PRIM Navitia, en transition : itinéraires, isochrones tabulaires et perturbations, cache court, clé en variables serveur. Retiré après validation du moteur en production.
- OpenStreetMap : extrait régional PBF téléchargé une fois par semaine depuis Geofabrik. Une extraction locale des bars, restaurants et cafés conserve horaires et cuisines documentés. Aucune requête Overpass ni appel par établissement.
- PostGIS cherche les lieux à cinq minutes de marche estimée d’une station ; l’itinéraire détaillé valide la marche finale. Horaires inconnus exclus. Attribution OSM/ODbL conservée.
- Aucun secret ni position dans le code ou les logs. Variables documentées dans `.env.example`.
- Base et fonctions : Supabase CLI. Types générés par `supabase gen types`.
- Application : EAS Build, Submit et Update dans les quotas gratuits. Compte boutique éventuel séparé des services applicatifs.
- Invitations : Cloudflare Pages, associations universelles Apple et Android.
- Import OSM : GitHub Actions hebdomadaire, activation atomique du catalogue. Surveiller stockage Supabase et minutes Actions gratuites.
- Notifications : appel planifié de la fonction par pg_cron/pg_net, sans VM.

## Périmètre

Suivre la version courante de `PRODUCT.md`. Aucun autre ajout V2/V3 sans demande explicite. Les adaptations de position en arrière-plan demandées ici ne justifient pas de construire le reste de V2. Hors périmètre : réservation, partage de dépenses, discussion libre et villes hors Île-de-France.
