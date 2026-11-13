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

### Décisions validées le 6 novembre 2026

1. **Perturbations.** Le GTFS ne contient que les horaires théoriques, travaux planifiés inclus au moment de la compilation. Les perturbations viennent de l’API PRIM `disruptions_bulk/disruptions/v2`, testée avec la clé réelle (voir plus bas). Règles appliquées à chaque portion de trajet dont la période recouvre une perturbation sur la ligne ou le tronçon utilisé :
   - `BLOQUANTE` : trajet non vérifié, lieu non confirmable ;
   - `PERTURBEE` : lieu confirmable, avertissement visible ;
   - `INFORMATION` : message simple, sans effet sur le choix.
   Si l’API est indisponible, les trajets restent calculés sur l’offre théorique avec le message « Info trafic indisponible, vérifie avant de partir ». Récupération partagée, au plus une fois toutes les 10 minutes et seulement quand un calcul en a besoin, soit 144 appels par jour au maximum. Données de référence, non liées à une sortie, sans donnée personnelle. Cette API reste utilisée après le retrait du calculateur PRIM.
2. **Horizon.** La date d’une sortie est limitée à la période de validité du flux, avec un message clair à la création. Le moteur refuse toute date hors période.
3. **Transport à la demande.** Les passages sur réservation (`pickup_type=2`, `drop_off_type=2` ou fenêtres de réservation) sont exclus du calcul. Quand aucun trajet n’existe sans eux, l’application l’explique au lieu d’afficher seulement « aucun trajet ».

La marche finale de la station au lieu reste une estimation tant qu’aucun graphe piéton n’est branché, comme aujourd’hui dans PostGIS.

### API des perturbations, mesure du 5 novembre 2026

Trois appels réels, chacun réservé dans le compteur PRIM partagé. `GET /marketplace/disruptions_bulk/disruptions/v2` répond 200 en 182 ms, 1 338 999 octets : 864 perturbations, 734 lignes touchées, champ `lastUpdatedDate`. Les 734 identifiants de lignes (`line:IDFM:<id>`) correspondent aux `route_id` du GTFS en retirant `line:`. Les tronçons (`impactedSections`) utilisent les identifiants de stations du catalogue. Répartition observée : causes 510 travaux, 302 perturbations, 52 informations ; gravités 385 `PERTURBEE`, 383 `BLOQUANTE`, 96 `INFORMATION`. Périodes au format `AAAAMMJJTHHMMSS`, fuseau **à vérifier** (Paris supposé). `GET /marketplace/v2/navitia/line_reports` répond aussi (200, 136 ms) mais ne renvoyait aucune perturbation à cet instant. Ces mesures ponctuelles ne sont ni une médiane ni un p95.

## Contrat du service moteur

Contrat validé le 6 novembre 2026, fenêtre ajustée le 10 novembre. Les schémas Zod sont dans `packages/shared/src/engine.ts` (`@onyva/shared/engine`), validés par le service et, en phase 3, par l’Edge Function.

### Conventions

- Heures en secondes Unix UTC, comme `Journey` aujourd’hui. Le moteur convertit vers le jour de service de Paris, y compris les heures GTFS au-delà de 24 h.
- Stations au format du catalogue, `stop_area:IDFM:<n>`. Aucune adresse, aucune position, aucun identifiant de sortie ni d’utilisateur.
- Chaque réponse porte `snapshot` : identifiant de l’instantané (empreinte du flux), utilisé dans les clés de cache côté Supabase.
- Départ d’une station : on peut monter à n’importe quel quai de la station sans temps d’accès. Hypothèse **à vérifier** contre les références ; un temps d’accès par défaut pourra être ajouté.
- Durée maximale d’un trajet : 4 h. Correspondances maximales : 8. Correspondance sur un même quai : 300 s depuis le 10 novembre 2026 (voir phase 2). Valeurs par défaut retenues pour le MVP, à ajuster avec de nouvelles références.

### `POST /v1/one-to-all`

Entrée : `{ origin, arriveBy, window?, targets? }`, avec `window` en secondes (par défaut 2 h, maximum 4 h, décision du 10 novembre 2026) et `targets` facultatif (liste de stations, 20 000 au plus, dans la limite de 512 Ko par corps). Le maximum suit la durée maximale d’un trajet : une fenêtre plus large ne trouverait rien de plus.

Sémantique : pour chaque station cible `s`, `latestDeparture(s)` est la dernière heure de départ depuis `origin`, comprise dans `[arriveBy - window, arriveBy]`, qui permet d’atteindre `s` au plus tard à `arriveBy`. La durée renvoyée vaut `arriveBy - latestDeparture(s)` : elle inclut la marche, l’attente au départ et aux correspondances, et l’éventuelle avance à l’arrivée. Calcul par RAPTOR par plage (rRAPTOR) sur les départs de l’origine, du plus tardif au plus précoce. Résultat sur l’offre théorique, présenté comme tel, jamais comme une garantie.

Sortie : `{ snapshot, origin, arriveBy, durations: [{ stationId, latestDeparture, duration, transfers }], unreachable: number }`. Pas de plafond de 1 000 entrées : toutes les stations atteignables sont renvoyées.

### `POST /v1/journeys`

Entrée : `{ items: [{ key, from, to, time, direction: 'arriveBy' | 'departAfter' }] }`, 64 éléments au plus. Dix personnes, trois lieux, aller et retour donnent 60 éléments.

Sémantique :
- `arriveBy` : itinéraire qui part le plus tard possible en arrivant à `to` au plus tard à `time`. À égalité, le moins de correspondances.
- `departAfter` : itinéraire qui arrive le plus tôt possible en partant de `from` à partir de `time`. À égalité, le moins de correspondances. Sert aux retours après la fin de soirée.

Sortie par élément : `{ key, status: 'ok', journey }`, avec `journey` conforme au type `Journey` de `packages/shared` (sections marche, attente, trajet, ligne, noms d’arrêts, nuit), ou `{ key, status: 'none', reason: 'no-service' | 'on-demand-only' }`. Un trajet au-delà de la durée maximale compte comme `no-service`. Un retour `none` exclut le lieu, comme aujourd’hui.

Chaque portion en transport porte aussi l’identifiant de ligne GTFS et la liste des stations traversées, pour que Supabase applique les règles de perturbation sans que le moteur dépende de PRIM. Ajout facultatif au type `Leg`, sans changement pour l’application.

La marche finale vers le lieu reste ajoutée côté Supabase à partir de l’estimation existante, pour qu’aucune position de lieu ne soit nécessaire au moteur. Interface prévue pour un graphe piéton plus tard.

### `POST /v1/rank`

Ajoutée en phase 5. Classement équitable des stations pour un groupe, fait dans le moteur pour que seules les meilleures stations traversent le réseau.

Entrée : `{ origins: [{ key, station }], arriveBy, window?, targets, limit? }`. `origins` : de 2 à 10 entrées, une par personne, `key` opaque et unique choisie par l’appelant. `targets` : stations à classer, 20 000 au plus, en pratique celles qui ont un lieu ouvert. `limit` : 20 par défaut, 50 au plus.

Sémantique : un `oneToAll` par station de départ distincte, réparti sur les fils, puis l’ordre de `packages/fairness` : trajet maximum, puis somme, puis écart. Une station qu’une personne n’atteint pas est exclue. Une cible absente de l’instantané est ignorée et comptée. Une station de départ inconnue renvoie 400.

Sortie : `{ snapshot, arriveBy, candidates: [{ stationId, maximum, sum, spread, durations: [{ key, duration }] }], reachable, unknownTargets }`. Environ 8 Ko pour dix personnes, au lieu de dix listes d’environ 15 000 stations.

### `GET /v1/meta` et `GET /health`

`meta` : `{ snapshot, feedSha256, validFrom, validUntil, builtAt, stations, trips }`. `health` : 200 seulement quand un instantané est chargé, 503 sinon.

### Erreurs

| Code | Cas |
| --- | --- |
| 400 | Entrée invalide selon Zod, station inconnue |
| 401 | Jeton absent ou faux, comparé en temps constant |
| 413 | Corps au-delà de 512 Ko ou lot au-delà de 64 éléments |
| 422 | Date hors de la période de validité, avec `validFrom` et `validUntil` dans la réponse. Jamais de calcul implicite « pour maintenant » |
| 503 | Instantané non chargé ou rechargement en échec sans version précédente |
| 504 | Délai maximal dépassé, 5 s par requête, attente dans la file comprise |

Aucun corps de requête n’est journalisé. Les journaux contiennent seulement la route (`other` pour une route inconnue), le code, la durée et l’instantané.

Authentification : `Authorization: Bearer <ENGINE_SECRET>`, comparaison en temps constant sur les empreintes SHA-256. `/health` reste sans jeton pour la surveillance et ne renvoie que l’identifiant de l’instantané. Les réponses de plus de 1 Ko sont compressées en gzip quand le client l’accepte.

## Phase 1 : package `packages/transit-engine`

### Contenu

- `compile.ts` : lit le GTFS ligne à ligne et produit un réseau en tableaux typés. Les courses sont regroupées par ligne et suite d’arrêts, triées, puis séparées quand une course en dépasse une autre, pour garantir l’ordre exigé par RAPTOR. Calendrier résolu par jour, `calendar_dates` inclus. Heures au-delà de 24 h conservées sur le jour de service précédent. Restrictions de montée et de descente gardées par passage. Courses à fenêtre de réservation (`start_pickup_drop_off_window`) exclues entièrement.
- `snapshot.ts` : instantané binaire (en-tête JSON, puis tableaux alignés sur 8 octets), relu sans copie. Identifiant `<format>-<12 premiers caractères du SHA-256 du zip>`.
- `engine.ts` : RAPTOR vers l’avant pour `departAfter`, RAPTOR inversé pour `arriveBy`, RAPTOR par plage pour `oneToAll`. Jour de service selon la définition GTFS (midi moins 12 h, heure de Paris), avec les jours voisins pour les services après minuit. Passages sur réservation exclus ; quand seul un tel passage permet le trajet, la réponse vaut `on-demand-only`. Correspondance sur un même quai : 60 s à l’origine, 300 s depuis la phase 2. Au plus 8 correspondances et 4 h de trajet.
- `walk.ts` : marche station vers lieu **estimée** (distance à vol d’oiseau × 1,5, à 1,2 m/s, mêmes facteurs que la recherche PostGIS), derrière une interface `PedestrianRouter` prête pour un graphe piéton.
- Période de validité : un jour compte seulement s’il a au moins la moitié du nombre médian de courses. Le flux du 5 novembre gardait environ 5 600 courses par jour du 2 au 4 novembre, contre environ 145 000 en semaine ensuite (métro 8 absent). Validité retenue : du 5 novembre au 4 décembre 2026.

### Tests

- 15 tests sur des réseaux **synthétiques**, identifiés comme tels : correspondance ratée, changement sur le même quai, service après minuit, jour férié par `calendar_dates`, montée interdite, transport à la demande seul, course qui en dépasse une autre, dates hors période, jours passés partiels, `oneToAll` (attente incluse, fenêtre, cibles, cohérence avec `arriveBy`), aller-retour de l’instantané, lecture CSV et jour de service lors du changement d’heure.
- Références indépendantes : les trois portions en transport des captures PRIM du 4 novembre 2026 (`packages/fairness/fixtures`). Le flux du 5 novembre ne décrit plus le 4 novembre en entier : chaque référence est rejouée le même jour de semaine deux semaines plus tard, le mercredi 18 novembre, en supposant un horaire régulier inchangé (**à vérifier**). Tolérance fixée à 5 minutes sur l’arrivée. Résultat : écart de 0 s sur les trois (RER C à l’aller, RER C au retour, bus 111 puis métro 8 avec une correspondance). Trois trajets ne suffisent pas à valider le moteur : de nouvelles captures PRIM datées dans la période du flux sont à faire.
- Le test de référence est ignoré quand aucun instantané n’est compilé, notamment en CI.

### Mesures du 6 novembre 2026

Machine : ordinateur portable Intel Core i5-7300U, 4 cœurs, 17 Go, Node 24.15.0, x86_64. Pendant les mesures, l’application Expo, la page d’invitation et Supabase local tournaient sur la même machine (charge moyenne de 8,4 sur 4 cœurs lors de la dernière série) : les temps sont pessimistes et bruités. Ce n’est pas la VM cible.

| Mesure | Résultat |
| --- | --- |
| Compilation du GTFS complet | 110 à 122 s, pic de mémoire 986 Mo |
| Instantané | 87 238 600 octets : 15 406 stations, 35 484 quais, 12 699 routes RAPTOR, 400 637 courses, 8 661 900 passages, 16 courses flexibles exclues, 66 966 passages sur réservation |
| Chargement de l’instantané | 117 à 155 ms, mémoire du processus 174 à 191 Mo après chargement |
| Première vue d’un jour de service | 217 à 221 ms, environ 40 Mo de plus, gardée en cache (4 jours au plus) |
| `oneToAll`, fenêtre 2 h, 10 origines × 3 | médiane 0,85 à 1,10 s, p95 2,5 à 2,7 s, 13 174 stations atteintes au plus |
| `oneToAll`, fenêtre 4 h | médiane 2,7 à 3,1 s, p95 5,5 à 6,6 s, 14 912 stations atteintes au plus |
| `journey` seul | médiane 16 à 24 ms, p95 55 à 68 ms |
| Lot de 60 trajets (10 personnes, 3 lieux, aller et retour), en série | 1,3 à 1,8 s |
| Trajets sans résultat dans le scénario | 0 |
| Cohérence `oneToAll` et `arriveBy` sur 14 stations tirées | 14 identiques |

Ces temps sont du **calcul pur** sur un seul fil. Ils n’incluent ni HTTP ni Supabase. Les plages donnent la plus basse et la plus haute de plusieurs séries.

### Lecture

- Pour dix personnes, `oneToAll` sur 2 h coûte environ 10 s en série sur cette machine. L’objectif de trois secondes demande le parallélisme prévu en phase 2 (un fil par cœur, instantané partagé) et une fenêtre de 2 h. Une fenêtre de 4 h triple le coût pour un gain limité : un trajet de plus de 2 h ne sert pas à choisir un lieu équitable. Proposition : fenêtre de 2 h par défaut.
- Les trajets détaillés sont rapides : 60 trajets en 1,3 à 1,8 s en série, donc moins d’une demi-seconde sur 4 fils.
- La mémoire tient sous 250 Mo par processus. Avec 4 fils et un instantané partagé, l’estimation est d’environ 400 à 600 Mo, **à vérifier** en phase 2. L’offre Always Free d’Oracle (ARM) suffirait largement, **à vérifier** sur la machine réelle. Note du 12 novembre 2026 : Oracle a refusé l’inscription, le moteur part sur un VPS OVHcloud (phase 3).
- Pistes d’optimisation non faites : arrêter la plage dès que toutes les stations utiles sont fixées, réutiliser un `oneToAll` entre participants partant de la même station, préparer les événements de départ une fois par jour de service.

## Phase 2 : service `apps/engine`

### Contenu

- `server.ts` : `node:http`, sans framework. Routes `GET /health`, `GET /v1/meta`, `POST /v1/one-to-all`, `POST /v1/journeys`, codes d’erreur du contrat. Validation Zod de chaque corps.
- `pool.ts` et `worker.ts` : un fil `worker_threads` par cœur (4 au plus par défaut), une file commune, une tâche à la fois par fil. L’instantané est copié une fois dans un `SharedArrayBuffer` : tous les fils lisent la même mémoire. Un lot de trajets est réparti sur tous les fils, dans l’ordre de la requête. Une tâche au-delà du délai est retirée de la file, ou son fil est arrêté puis remplacé, car une recherche RAPTOR ne s’interrompt pas de l’extérieur.
- `main.ts` : configuration par variables d’environnement (`.env.example`). `SIGHUP` recharge l’instantané le plus récent du dossier : le nouveau pool est prêt avant de remplacer l’ancien, qui termine ses tâches puis s’arrête. Un rechargement raté garde l’instantané en service. `SIGTERM` arrête proprement.
- `Dockerfile` : bundle esbuild construit une seule fois sur la machine de build, image `node:24.15.0-bookworm-slim` pour `linux/amd64` et `linux/arm64`, utilisateur `node`. L’instantané n’est jamais dans l’image : il est monté en lecture seule sur `/data/engine`. `compose.yaml` : système de fichiers en lecture seule, aucune capacité, mémoire limitée à 1 Go, port publié sur la boucle locale seulement. Le frontal HTTPS joignable depuis Supabase est prévu avec le déploiement.
- Tests : 9 tests du service sur un réseau **synthétique** (jeton, codes 400, 401, 404, 413, 422, 503, ordre des lots, compression, journaux sans corps) et un test de délai avec un fil qui ne répond jamais.

### Références PRIM du 10 novembre 2026

20 trajets réels capturés le 10 novembre 2026 par `pnpm engine:record-references`, de station à station, sur les horaires théoriques, pour des dates du 12 au 20 novembre. 20 appels réservés dans le compteur PRIM partagé, latence PRIM de 181 à 1 884 ms (mesures ponctuelles). L’extrait est dans `packages/transit-engine/fixtures/prim-references-2026-11-10.json`, les réponses brutes dans `data/prim-references` (non versionné). Les cas couvrent RER A, B et D, Transilien L, N et R, métros 4 à 9 et 14, tramway T2, bus 181, la nuit, le samedi, le dimanche, un départ à 6 h, des derniers retours et trois arrivées imposées.

Comparaison sur le cœur en transport de chaque trajet PRIM, de la première montée à la dernière descente, avec l’instantané compilé le même jour (flux du 10 novembre, `1-7999332c62ec`). Navitia ne renvoie pas toujours l’arrivée la plus tôt : le test vérifie que le moteur ne fait jamais plus de 5 minutes moins bien que PRIM.

| Résultat | Cas |
| --- | --- |
| Horaires identiques à la seconde, mêmes lignes | 18 sur 20 |
| Moteur plus rapide, mêmes lignes | 2 : Saint-Denis vers Massy - Palaiseau (−4 min), Cergy le Haut vers Châtelet - Les Halles (−5 min) |
| Moteur moins bon que PRIM | 0 |

Les deux écarts ont la même cause : une correspondance sur un même quai GTFS. Le moteur prend le RER B 3 min 30 après le RER D à Gare du Nord, et le RER A 1 min 45 après la ligne L à Nanterre Université. PRIM refuse ces correspondances et prend le train suivant. Avec le même quai à 240 s, 19 cas sur 20 sont identiques ; à 300 s, 20 sur 20. Décision du 10 novembre 2026 : 300 s par défaut. Vingt trajets ne prouvent pas que cette valeur convient partout : de nouvelles références restent utiles, notamment sur des correspondances quai à quai réellement courtes.

### Mesures du 10 novembre 2026

Même machine que la phase 1 (Intel Core i5-7300U, 4 cœurs, Node 24.15.0), cette fois sans Expo ni Supabase local, charge moyenne de 0,5 à 0,8. Service lancé avec 4 fils, appelé en HTTP local par `pnpm engine:bench-http`, scénario à dix personnes du 13 novembre. Ce n’est pas la VM cible et le réseau entre Supabase et la VM n’est pas compté.

| Mesure | Résultat |
| --- | --- |
| Compilation du flux du 10 novembre | 39 s, pic de mémoire 1,07 Go |
| Instantané | 88 250 744 octets, 15 407 stations, 407 397 courses, validité du 10 novembre au 9 décembre 2026 |
| Démarrage du pool, 4 fils | 262 ms |
| Dix `oneToAll` en parallèle, fenêtre de 2 h | médiane 2,8 à 3,0 s, de 2,2 à 3,5 s sur 5 séries |
| Lot de 60 trajets réparti sur 4 fils | médiane 0,36 s, de 0,34 à 0,75 s |
| Trajets sans résultat | 0 |
| Mémoire du processus, 4 fils | 505 Mo après les mesures, pic 582 Mo |
| Image Docker | 323 Mo, construite pour amd64 et arm64 |

### Lecture

- L’objectif d’environ trois secondes pour dix personnes est atteint de justesse en calcul pur sur 4 cœurs anciens. La latence réseau vers la VM et le temps de Supabase s’ajoutent : **à vérifier** en phase 3. Les optimisations de la phase 1 restent possibles si la VM est plus lente.
- La mémoire tient dans l’estimation de la phase 1 et dans la limite de 1 Go du conteneur.

## Phase 3 : branchement dans Supabase

### Contenu

- `supabase/functions/_shared/engine-client.ts` : client HTTP du moteur. Secret dans l’en-tête `Authorization`, délai de 8 s, réponses validées par les schémas Zod du contrat. HTTPS obligatoire, sauf pour un service sur la machine locale. Toute erreur devient un message montrable : date hors période (« Les horaires sont publiés jusqu’au 9 décembre. Choisis une date plus proche. »), station inconnue, ou service indisponible.
- `supabase/functions/_shared/recommendation.ts` : les deux calculs (lieu choisi et juste milieu) passent par un fournisseur de trajets, `primRouter` ou `engineRouter`. Les règles d’équité ne changent pas.
- `packages/fairness/src/engine.ts` : fonction pure `venueJourney`. Le moteur calcule de station à station. La marche estimée du catalogue (5 minutes au plus) est ajoutée de chaque côté, et aucune position de lieu n’est envoyée au moteur. L’aller doit atteindre la station du lieu avant `début - marche`, le retour doit partir de cette station après `fin + marche`. Un trou entre deux portions, une arrivée trop tardive ou une marche de plus de 5 minutes rejettent le trajet.
- Aller et retour d’un lieu : un seul lot `POST /v1/journeys` de 2 éléments par personne, 20 pour dix personnes. Un `on-demand-only` ajoute l’avertissement « transport à la demande ». Le résultat porte `source: 'gtfs'` et l’avertissement « Horaires théoriques d’Île-de-France Mobilités, sans info trafic pour l’instant ».
- Isochrones : `POST /v1/one-to-all` à l’heure du rendez-vous, mis en cache 10 minutes dans `prim_cache`, lié à la sortie. Clé : origine et heure d’arrivée. Forme compacte (`<n>:<secondes>`) pour limiter la taille. Les lots de trajets ne sont pas mis en cache : le moteur les calcule en moins d’une seconde, sans quota.
- `recommend` : `TRANSIT_PROVIDER=engine` active le moteur. Il faut aussi `ENGINE_URL` et `ENGINE_SECRET`. Sans cette variable, PRIM reste le fournisseur. Avec le moteur, l’action `coverage` appelle `GET /v1/meta` : un moteur injoignable désactive le calcul, et la réponse donne `validFrom` et `validUntil`. Aucun appel PRIM ni compteur PRIM n’est utilisé.
- Création : `timetableLimit` refuse une sortie qui se termine après le dernier jour publié (décision 2 de la phase 0).
- `scripts/engine/import-stations.ts` (`pnpm engine:import-stations [instantané] [--apply]`) : catalogue depuis l’instantané, sans PRIM. Simulation par défaut. Les stations existantes gardent leur nom (libellé PRIM avec la commune) et leur position. Seules leurs lignes changent : rail d’abord, puis bus dans l’ordre numérique, 10 au plus (`M4`, `RER B`, `T3a`, `38`). Les stations desservies absentes sont ajoutées. Aucune station n’est désactivée.
- Déploiement : `apps/engine/Caddyfile` et le profil `https` de `compose.yaml` ajoutent Caddy en frontal HTTPS (certificat Let’s Encrypt automatique, corps limité à 300 Ko). `scripts/engine/refresh-snapshot.sh` télécharge le flux, reconstruit l’instantané s’il a changé, garde les deux plus récents et recharge le service par `SIGHUP`.

### Tests

- `packages/fairness/src/engine.test.ts` : marche ajoutée à l’aller et au retour, champs du contrat retirés, refus en cas de retard, de trou ou de marche trop longue, départ depuis la station du lieu, cache compact.
- `tests/engine-recommendation.test.ts` : service réel lancé sur un réseau **synthétique**, puis client, fournisseur et calcul du lieu choisi de bout en bout. Couvre le lieu vérifié, le retour impossible, la date hors période, la configuration, le mauvais secret, la réutilisation du cache et le transport à la demande.
- `tests/engine-stations.test.ts` : libellés et ordre des lignes.
- Les tests PRIM existants passent par `primRouter` sans changement de comportement.

### Essai local du 12 novembre 2026

Supabase local, `recommend` servie par `supabase functions serve` (edge-runtime 1.77.8, Deno 2.1.4) avec `TRANSIT_PROVIDER=engine`, moteur lancé par `pnpm engine:dev` sur l’instantané `1-7999332c62ec`, 4 fils, même machine que les phases 1 et 2. Parcours : création, adhésion, choix d’un lieu, vérification. Pour ce seul essai, la date d’import du catalogue OSM local a été avancée, puis remise à sa valeur, car l’import local date du 2 novembre. Sortie du vendredi 13 novembre, 19 h à 21 h 30.

| Mesure | Résultat |
| --- | --- |
| `coverage` | `provider: engine`, `manualReady: true`, période du 10 novembre au 9 décembre |
| Deux personnes, lieu choisi | résultat complet en 0,8 s |
| Dix personnes, lieu choisi | résultat complet en 0,4 à 0,7 s sur deux essais, trajet maximum 49 min |

Ce sont des observations ponctuelles en local, sans réseau entre Supabase et la VM. Le juste milieu automatique (`RECOMMENDATIONS_ENABLED`) n’a pas été réactivé.

Import des stations en simulation, catalogue distant, même instantané : 15 381 stations mises à jour (lignes), 4 ajouts valides, 22 stations GTFS hors des limites de l’Île-de-France du schéma `stationSchema` (ignorées), 1 station active sans desserte GTFS (`stop_area:IDFM:60142`, signalée, laissée active). Rien n’a été écrit.

### Pile locale, 12 novembre 2026

En attendant l’hébergement, toute la chaîne tourne en local, sans PRIM ni projet distant :

```bash
pnpm supabase:start
pnpm local:venues      # lieux OSM de la base locale, horaires sur 16 jours (à refaire au-delà de 8 jours)
pnpm local:stations    # lignes des stations locales depuis l’instantané
pnpm dev:local         # moteur, fonctions et application web sur http://localhost:8082
pnpm test:local        # dans un autre terminal : création, adhésion, lieu choisi, 2 puis 10 personnes
```

- `scripts/local-stack.mjs` lance le moteur (secret aléatoire à chaque démarrage), `supabase functions serve` avec `TRANSIT_PROVIDER=engine`, et l’application web. Ctrl+C arrête tout.
- Expo fusionne toujours les fichiers `.env*` de l’application par-dessus les variables du processus en développement. Le lanceur écrit donc `apps/mobile/.env.development.local`, le fichier le plus prioritaire, avec l’adresse du Supabase local, et le supprime à l’arrêt. Tes fichiers `.env` ne sont pas modifiés. Sans ce fichier, `pnpm dev` vise de nouveau le projet distant.
- `scripts/check-local-engine.ts` crée des comptes temporaires, puis les supprime à la fin.

Résultat sur la machine des phases 1 et 2, chargée par Docker, Metro et un navigateur : lieu choisi vérifié en environ 2,3 s pour 2 et pour 10 personnes, par le moteur, sans appel PRIM.

### Limite trouvée : le juste milieu dépasse le budget processeur des Edge Functions

`pnpm dev:local --auto` active la recherche automatique. Les dix isochrones aboutissent : la fonction n’en envoie jamais plus à la fois que le moteur n’a de fils (`ENGINE_THREADS`), et `ENGINE_TIMEOUT_MS` passe à 20 s sur cette machine de développement, 5 s par défaut. Mais la fonction est ensuite arrêtée par « CPU time hard limit ». Chaque isochrone du moteur renvoie toutes les stations atteignables, environ 15 000, contre 1 000 au plus avec PRIM. Valider, décoder et croiser dix listes de cette taille dépasse le temps processeur d’une Edge Function (2 s sur l’offre Supabase actuelle, **à vérifier** pour la production).

Le mode actuel, lieu choisi, n’est pas concerné. Piste pour la phase 5 : faire le classement des stations dans le moteur, par une route qui reçoit les départs et renvoie seulement les meilleures stations, avec les règles de `packages/fairness`. La fonction ne recevrait plus qu’une vingtaine de stations.

### Hébergement : décision du 12 novembre 2026

Oracle Cloud Always Free a refusé l’inscription (carte d’une néobanque). Les offres gratuites restantes ne conviennent pas à une application : mise en veille (Hugging Face, Render, Koyeb), processeur trop faible, ou facturation à l’usage (Google Cloud). Décision : **VPS OVHcloud VPS-2**, prix mensuel fixe, centre de données en France, trafic illimité, sans option payante. Prix au moment de la commande : **à vérifier** sur la facture. 4 vCores permettent aussi le juste milieu automatique, environ 3 s pour dix personnes selon les mesures de la phase 2, **à mesurer** sur la machine.

Besoins mesurés : moins de 250 Mo pour le service à 1 fil, environ 500 Mo à 4 fils, pic de 1,1 Go pendant la compilation, 20 Go de disque suffisent. Le serveur ne garde aucune donnée propre : il se reconstruit à partir du dépôt et du flux GTFS, donc aucune sauvegarde payante n’est nécessaire.

### Déploiement sur le VPS

1. Commander le VPS, Ubuntu 24.04, centre en France, sans option. Se connecter par clé SSH.
2. Sécuriser : connexion SSH par clé seulement, pare-feu `ufw` ouvert sur 22, 80 et 443, mises à jour de sécurité automatiques (`unattended-upgrades`).
3. Installer Docker, Node 24, pnpm et `unzip`. Cloner le dépôt dans `/opt/onyva`, puis lancer `pnpm install --frozen-lockfile`.
4. Créer `apps/engine/.env` avec `ENGINE_SECRET` (`openssl rand -hex 32`) et `ENGINE_DOMAIN`. Sans domaine, utiliser `<ip-avec-tirets>.sslip.io`, gratuit et sans compte.
5. Lancer `scripts/engine/refresh-snapshot.sh`, puis `docker compose -f apps/engine/compose.yaml --profile https up -d --build`. Vérifier `https://<domaine>/health`.
6. Ajouter le script au cron, tous les jours à 18 h 30.
7. Dans Supabase : `supabase secrets set ENGINE_URL=https://<domaine> ENGINE_SECRET=<secret> TRANSIT_PROVIDER=engine`, puis déployer `recommend`. Revenir à PRIM : `TRANSIT_PROVIDER=prim`.
8. Mesurer la latence réelle depuis Supabase avec dix personnes, puis lancer `pnpm engine:import-stations --apply`.

## Phase 5 : juste milieu calculé dans le moteur

Réponse à la limite trouvée en phase 3. Avec `TRANSIT_PROVIDER=engine`, la recherche automatique de `recommend` ne charge plus les isochrones ni le catalogue des stations :

1. `venue_station_ids` (migration `0016`, réservée au serveur) liste les stations actives qui ont un lieu de l’activité ouvert pendant toute la sortie, à 240 m au plus. Environ 700 à 2 600 stations selon l’activité, 0,5 s en base locale.
2. `POST /v1/rank` classe ces stations pour le groupe et renvoie les 20 meilleures.
3. `nearby_venues` (paramètre `station_count`, migration `0017`) renvoie les lieux des trois premières stations de cette liste. La présélection prend un lieu par station, puis les trois lieux sont vérifiés par `POST /v1/journeys`, aller et retour, comme avant.

Le classement ne porte que sur des stations qui ont un lieu ouvert : il ne s’arrête plus sur une station sans lieu. PRIM garde l’ancien chemin, isochrones dans la fonction.

Compromis : le classement n’est pas mis en cache. Un nouvel arrivant change la révision de la sortie et relance les `oneToAll` de tout le groupe. Le moteur n’a pas de quota, seulement du temps processeur sur le VPS. Les verrous de calcul et le résultat récent d’une minute évitent toujours les calculs identiques en parallèle.

### Essai local du 12 novembre 2026

`pnpm dev:local --auto`, puis `pnpm test:local`, même machine que les phases précédentes, chargée par Docker, Metro et un navigateur (charge moyenne de 4 à 5 sur 4 cœurs). Sortie de dix personnes, vendredi 13 novembre, 19 h à 21 h 30, activité `drinks`.

| Mesure | Résultat |
| --- | --- |
| Juste milieu à dix, de bout en bout | 10,3 s, premier appel après le démarrage du moteur, lieu vérifié, trajet maximum 39 min |
| `POST /v1/rank` seul, premier appel | 9,7 s |
| `POST /v1/rank` seul, appels suivants, 716 cibles `drinks`, mêmes dix départs | 5,3 à 6,5 s sur 3 appels, réponse de 7,6 Ko |
| Fin de la limite processeur des Edge Functions | plus d’arrêt « CPU time hard limit » |

Lecture : presque tout le temps vient des dix `oneToAll`, déjà mesurés à 2,8 à 3,0 s sur cette machine sans charge en phase 2. Le classement lui-même est négligeable. Avec 4 fils, un appel `rank` à dix personnes dépasse le délai de 5 s du moteur sur une machine chargée : `pnpm dev:local --auto` garde 20 s. Sur le VPS, **à mesurer** ; si le délai de 5 s ne suffit pas, l’élaguer par les cibles dans `oneToAll` est la première piste.

## Structure

```
packages/
  transit-engine/          Compilation GTFS, instantané binaire, RAPTOR et rRAPTOR, sans réseau ni base
apps/
  engine/                  Service HTTP sans état, fils parallèles, Dockerfile multi-architecture, compose.yaml
scripts/
  engine/
    build-network.ts       GTFS décompressé vers instantané binaire dans data/engine
    bench.ts               Mémoire, chargement, oneToAll et journey sur le GTFS réel
    bench-http.ts          Latences HTTP d’un service lancé, scénario à dix personnes
    record-references.ts   20 captures PRIM de référence, réservées dans le compteur partagé
    import-stations.ts     Catalogue des stations depuis l’instantané, simulation par défaut
    refresh-snapshot.sh    Téléchargement du flux, compilation et rechargement, sur la VM
```

Commandes : `pnpm engine:build-network [dossierGtfs] [dossierSortie]`, `pnpm engine:bench [instantané] [AAAA-MM-JJ]`, `pnpm engine:dev`, `pnpm engine:bench-http [AAAA-MM-JJ]`, `pnpm engine:record-references [--dry-run]`, `pnpm engine:import-stations [instantané] [--apply]`.

## État

- Phase 0 : terminée. Contrat et décisions validés le 6 novembre 2026.
- Phase 1 : validée le 10 novembre 2026, fenêtre de 2 h par défaut et valeurs par défaut retenues.
- Phase 2 : service, image Docker et 20 références PRIM faits. Même quai à 300 s, validé le 10 novembre 2026.
- Phase 3 : code, tests et essai local faits le 12 novembre 2026. Restent le déploiement du VPS OVHcloud, la mesure depuis Supabase, l’import des stations (`--apply`) et le passage à `TRANSIT_PROVIDER=engine`. PRIM reste le fournisseur actif d’ici là.
- Phase 4 : à définir. Proposition : perturbations PRIM (décision 1 de la phase 0).
- Phase 5 : classement dans le moteur fait et essayé en local le 12 novembre 2026. Restent la mesure sur le VPS, puis la reprise du juste milieu en production (`RECOMMENDATIONS_ENABLED`) et le retrait du calculateur PRIM.
