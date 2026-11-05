# Moteur de transport maison

Décision du 6 novembre 2026 : Onyva remplace PRIM/Navitia par un moteur de calcul d’itinéraires maison, alimenté par le GTFS ouvert d’Île-de-France Mobilités. Supabase reste le backend. Le moteur est un service sans état, appelé uniquement par l’Edge Function `recommend`.

```
App mobile ──► Supabase (auth, PostgreSQL/PostGIS, RLS, Realtime, pg_cron, Edge Functions)
                    │  Edge Function `recommend`, secret partagé, HTTPS
                    ▼
              Service moteur (Node, GTFS compilé en mémoire, sans état, API privée)
```

Ce document est rempli phase par phase. Toute valeur non mesurée est marquée « à vérifier ». Les mesures indiquent leur date et leur machine.

## Phase 0 : la source GTFS

### Origine et licence

| Sujet | Constat | Source |
| --- | --- | --- |
| Jeu de données | « Horaires prévus sur les lignes de transport en commun d’Ile-de-France (GTFS Datahub) », éditeur Île-de-France Mobilités | Métadonnées de `data.iledefrance-mobilites.fr`, jeu `offre-horaires-tc-gtfs-idfm` |
| URL stable | `https://www.data.gouv.fr/api/1/datasets/r/413988ed-d340-467b-8be2-7b999fcd207a`, qui redirige vers `https://eu.ftp.opendatasoft.com/stif/GTFS/IDFM-gtfs.zip` | transport.data.gouv.fr, ressource « Horaires au format GTFS » |
| Licence | **Licence Mobilités** selon les métadonnées actuelles d’IDFM et de transport.data.gouv.fr (`mobility-licence`). Un ancien PDF d’IDFM parle d’ODbL. Attribution « Île-de-France Mobilités » exigée. Conditions exactes de réutilisation et d’affichage : **à vérifier** dans le texte de la licence | Métadonnées IDFM, transport.data.gouv.fr, PDF `opendata_gtfs` |
| Fréquence de mise à jour | Le fichier téléchargé le 5 novembre 2026 portait `Last-Modified: Thu, 05 Nov 2026 15:23:59 GMT` et les métadonnées une modification à 16:00 UTC. Le listing Opendatasoft annonce trois mises à jour par jour (8 h, 13 h et 17 h) ; l’ancien PDF annonce mardi et vendredi. Rythme réel : **à vérifier** en observant `Last-Modified` pendant une semaine | En-têtes HTTP, métadonnées |
| Taille | 115 307 844 octets compressés, 985 529 546 octets décompressés. `stop_times.txt` pèse 715 612 953 octets ; `shapes.txt` (132 Mo) et `object_codes_extension.txt` (80 Mo) ne sont pas nécessaires au calcul | Mesure locale, 5 novembre 2026 |
| Période de validité | `calendar.txt` du 2 novembre au 4 décembre 2026, `calendar_dates.txt` du 5 novembre au 4 décembre 2026. IDFM décrit une couverture d’environ 30 jours glissants | Mesure locale |

L’attribution dans l’application devra citer Île-de-France Mobilités, comme OpenStreetMap pour les lieux. Formulation exacte : **à vérifier** avec la licence.

### Contenu mesuré

Mesure du 5 novembre 2026 sur le fichier téléchargé ce jour-là (empreinte SHA-256 commençant par `6052982fae53ee86`).

| Élément | Valeur |
| --- | --- |
| Arrêts | 53 405 : 15 406 stations (`location_type=1`), 35 484 quais (`0`), 2 515 entrées (`2`). Tous les quais ont une station parente |
| Lignes | 2 027 : 1 967 bus, 25 trains (RER et Transilien), 17 tramways, 16 métros, 1 funiculaire, 1 téléphérique |
| Courses | 400 653 sur toute la période |
| Passages (`stop_times`) | 8 663 914 sur toute la période. 211 415 passages après minuit, jusqu’à 32 h. Montée interdite (`pickup_type=1`) sur 411 647 passages, montée sur réservation (`2`) sur 57 729 |
| Volume d’un jour de service | Vendredi 13 novembre : 146 039 courses, 3 171 028 passages. Samedi 14 : 97 942 courses, 2 222 237 passages. Dimanche 15 : 67 118 courses, 1 529 396 passages. Vendredi 25 décembre : aucun service, date hors période |
| Transport à la demande | Colonnes `start_pickup_drop_off_window`, `booking_rules.txt` et réservation par téléphone présentes. Proposition : exclure ces passages au départ, car le moteur ne peut pas garantir une réservation |

### Correspondance des stations

Le catalogue actuel de Supabase, importé depuis PRIM, compte 15 382 stations actives d’identifiant `stop_area:IDFM:<n>`. Le GTFS identifie ses stations par `IDFM:<n>`.

| Mesure | Résultat |
| --- | --- |
| Stations actives retrouvées en retirant le préfixe `stop_area:` | **15 382 sur 15 382, soit 100 %** |
| Écart de coordonnées entre catalogue et GTFS | médiane 0,0 m, 99e centile 0,1 m, maximum 130,4 m |
| Stations retrouvées et desservies par au moins une course | 15 382 |
| Stations GTFS absentes du catalogue actuel | 24 |

Conséquence : aucune table de correspondance n’est nécessaire. Le moteur accepte les identifiants du catalogue tels quels. Le nouvel import des stations depuis le GTFS (phase 3) peut garder le format `stop_area:IDFM:<n>` et ajouter les 24 stations manquantes sans invalider les sorties en cours. Les sorties stockent des identifiants de stations, donc ce choix évite toute migration de données.

### Correspondances et cheminements

| Fichier | Constat | Usage proposé |
| --- | --- | --- |
| `transfers.txt` | 191 184 correspondances, toutes de type 2 (temps minimal), toutes entre quais. 92 900 dans une même station, 98 284 entre stations voisines. 99,9 % symétriques. 97,9 % des quais en ont au moins une. Distance médiane 181 m, 95e centile 293 m, maximum 847 m. Temps minimal médian 377 s, jamais nul, maximum 5 507 s. Vitesse implicite médiane 0,52 m/s | Seule source des correspondances à pied. La vitesse implicite, plus lente qu’une marche réelle, montre que le temps inclut une marge. Les correspondances valent dans les deux sens seulement si le fichier les décrit |
| `pathways.txt` | 5 024 cheminements, tous des couloirs (`pathway_mode=1`), uniquement entre entrées et quais, sur 761 stations. Longueur et temps de parcours toujours renseignés, médiane 83 s, maximum 675 s | Pas utile aux correspondances. Utilisable plus tard pour la marche entre la sortie de station et le lieu |
| Correspondance sur un même quai | Aucune ligne `from_stop_id = to_stop_id` | Proposition : autoriser un changement sur le même quai avec un temps minimal configurable, 60 s par défaut, **à vérifier** contre des itinéraires de référence |

### Écarts avec PRIM à connaître

- **Horaires théoriques seulement.** Le GTFS ne contient ni temps réel ni perturbations du jour. Les travaux planifiés présents dans le flux au moment de la compilation sont pris en compte. `PRODUCT.md` présentait les perturbations IDFM comme une différence du produit : ce point doit être reformulé.
- **Horizon d’environ 30 jours.** Une sortie au-delà de la fin du flux ne peut pas être calculée. Le moteur refusera ces dates avec un message clair. Décision produit à prendre : limiter la date de création, ou prévenir l’organisateur.
- **Marche finale estimée.** Sans graphe piéton, la marche de la station au lieu reste une estimation, comme aujourd’hui dans PostGIS.

## Contrat proposé pour le service moteur

Proposition à valider avant d’écrire le moteur. Les schémas Zod iront dans `packages/shared/src/engine.ts`, validés par le service et par l’Edge Function.

### Conventions

- Heures en secondes Unix UTC, comme `Journey` aujourd’hui. Le moteur convertit vers le jour de service de Paris, y compris les heures GTFS au-delà de 24 h.
- Stations au format du catalogue, `stop_area:IDFM:<n>`. Aucune adresse, aucune position, aucun identifiant de sortie ni d’utilisateur.
- Chaque réponse porte `snapshot` : identifiant de l’instantané (empreinte du flux), utilisé dans les clés de cache côté Supabase.
- Départ d’une station : on peut monter à n’importe quel quai de la station sans temps d’accès. Hypothèse **à vérifier** contre les références ; un temps d’accès par défaut pourra être ajouté.
- Durée maximale d’un trajet : 4 h. Correspondances maximales : 8. Valeurs **à vérifier** au banc d’essai.

### `POST /v1/one-to-all`

Entrée : `{ origin, arriveBy, window, targets? }`, avec `window` en secondes (par défaut 4 h, maximum 6 h) et `targets` facultatif (liste de stations, 20 000 au plus).

Sémantique : pour chaque station cible `s`, `latestDeparture(s)` est la dernière heure de départ depuis `origin`, comprise dans `[arriveBy - window, arriveBy]`, qui permet d’atteindre `s` au plus tard à `arriveBy`. La durée renvoyée vaut `arriveBy - latestDeparture(s)` : elle inclut la marche, l’attente au départ et aux correspondances, et l’éventuelle avance à l’arrivée. Calcul par RAPTOR par plage (rRAPTOR) sur les départs de l’origine, du plus tardif au plus précoce. Résultat sur l’offre théorique, présenté comme tel, jamais comme une garantie.

Sortie : `{ snapshot, origin, arriveBy, durations: [{ stationId, latestDeparture, duration, transfers }], unreachable: number }`. Pas de plafond de 1 000 entrées : toutes les stations atteignables sont renvoyées.

### `POST /v1/journeys`

Entrée : `{ items: [{ key, from, to, time, direction: 'arriveBy' | 'departAfter' }] }`, 64 éléments au plus. Dix personnes, trois lieux, aller et retour donnent 60 éléments.

Sémantique :
- `arriveBy` : itinéraire qui part le plus tard possible en arrivant à `to` au plus tard à `time`. À égalité, le moins de correspondances.
- `departAfter` : itinéraire qui arrive le plus tôt possible en partant de `from` à partir de `time`. À égalité, le moins de correspondances. Sert aux retours après la fin de soirée.

Sortie par élément : `{ key, status: 'ok', journey }`, avec `journey` conforme au type `Journey` de `packages/shared` (sections marche, attente, trajet, ligne, noms d’arrêts, nuit), ou `{ key, status: 'none', reason: 'no-service' | 'too-long' }`. Un retour `none` exclut le lieu, comme aujourd’hui.

La marche finale vers le lieu reste ajoutée côté Supabase à partir de l’estimation existante, pour qu’aucune position de lieu ne soit nécessaire au moteur. Interface prévue pour un graphe piéton plus tard.

### `GET /v1/meta` et `GET /health`

`meta` : `{ snapshot, feedSha256, validFrom, validUntil, builtAt, stations, trips }`. `health` : 200 seulement quand un instantané est chargé, 503 sinon.

### Erreurs

| Code | Cas |
| --- | --- |
| 400 | Entrée invalide selon Zod, station inconnue |
| 401 | Jeton absent ou faux, comparé en temps constant |
| 413 | Corps au-delà de 256 Ko ou lot au-delà de 64 éléments |
| 422 | Date hors de la période de validité, avec `validFrom` et `validUntil` dans la réponse. Jamais de calcul implicite « pour maintenant » |
| 503 | Instantané non chargé ou rechargement en échec sans version précédente |
| 504 | Délai maximal dépassé, 5 s par requête, **à vérifier** au banc d’essai |

Aucun corps de requête n’est journalisé. Les journaux contiennent seulement la route, le code, la durée et l’instantané.

## Structure prévue

```
packages/
  transit-engine/          Compilation GTFS, instantané binaire, RAPTOR et rRAPTOR, sans réseau ni base
apps/
  engine/                  Service HTTP sans état, Dockerfile multi-architecture, compose.yaml
scripts/
  engine/
    build-network.ts       GTFS vers instantané binaire versionné
    bench.ts               Mémoire, chargement, oneToAll et journey sur le GTFS réel
    import-stations.ts     Catalogue des stations depuis le GTFS, activation atomique
```

Commandes prévues : `pnpm engine:build-network`, `pnpm engine:dev`, `pnpm engine:bench`.

## État

- Phase 0 : terminée, en attente de validation du contrat.
- Phases 1 à 5 : à faire. PRIM reste le fournisseur actif jusqu’à la phase 3.
