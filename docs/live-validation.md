# Validation de la migration PRIM

État au 4 novembre 2026. Ce rapport distingue les vérifications locales des validations qui nécessitent PRIM ou des appareils réels.

## Architecture retirée

Le service de routage, le package RAPTOR, le package de schéma Drizzle, les métadonnées Drizzle, Turborepo, les fichiers Docker applicatifs, les unités systemd et le workflow d’image ARM ont été retirés. Le processus de l’ancien calculateur a été arrêté. Les migrations SQL historiques restent versionnées pour les bases déjà utilisées. Le [plan B](plan-b.md) conserve la description du moteur et sépare ses anciennes mesures des objectifs PRIM.

## Données régionales réellement importées

L’extrait PBF Île-de-France de Geofabrik a été téléchargé et traité localement avec PyOsmium, sans Overpass. Le catalogue Supabase a été activé atomiquement avec **24 879 établissements** :

| Type | Importés | Avec intervalles d’ouverture exploitables |
| --- | ---: | ---: |
| Cafés | 4 179 | 1 570 |
| Restaurants | 17 274 | 7 841 |
| Bars et pubs | 3 426 | 1 230 |
| Total | 24 879 | 10 641 |

Les horaires inconnus restent stockés comme inconnus et exclus des suggestions. Les identifiants des relations utilisent leur identifiant OSM d’origine, pas l’identifiant interne des surfaces PyOsmium. Après plusieurs essais d’import, la table et ses index occupaient environ **42 Mo** dans le PostgreSQL local ; ce chiffre ne représente pas la taille de toute la base ni une garantie pour un projet distant. Les données partielles d’un import échoué n’ont pas remplacé le catalogue actif et ont été supprimées lors de l’activation complète suivante.

Le workflow hebdomadaire est prêt, mais n’a pas été exécuté sur un compte GitHub distant. Ses minutes gratuites, sa durée réelle sur le runner et l’occupation du projet Supabase distant restent à vérifier.

## Vérifications effectuées

- Lint et TypeScript strict valides.
- **49 tests unitaires réussis**, dont minimax, somme, écart, retours absents, attente, marche, Noctilien, horaires, cache individuel, budget, concurrence amont bornée, codes courts et progression.
- **Un test explicitement ignoré** : rejeu d’un groupe complet avec isochrones tabulaires, dont la complétude reste bloquée. Les captures réelles de trajets détaillés et du raccord de zéro seconde sont maintenant testées ; les exemples synthétiques gardent leur provenance.
- PostgreSQL/PostGIS réel dans une base temporaire isolée : migrations, RLS, compteur partagé, verrou de cache, contrôle de révision, refus de confirmation prématurée, résolution limitée des invitations, proximité et ouverture des lieux, activation atomique et suppressions en cascade.
- **Seize parcours navigateur réussis**, aux largeurs bureau et téléphone : création locale, réactions, comparaison, confirmation, cache hors connexion, calendrier, cuisines, invitation expirée, copie du code et referrer Google Play, choix manuel et confirmation, connexion Google proposée sans bouton Apple non configuré.
- Test HTTP réel sur Supabase local avec comptes jetables : réception d’un point de test sur canal privé, non-membre refusé, signature invalide refusée, droit expiré refusé, arrêt du partage et recommandations inchangées après le relais. Aucune position réelle d’utilisateur ni notification réelle n’a été envoyée.
- Vérification Deno des quatre Edge Functions.
- Builds web et exports JavaScript/Hermes Android/iOS valides. Ce sont des exports, pas des APK ou IPA signés installés sur téléphone.

Le classement pur de dix participants sur mille stations se mesure en quelques dizaines de millisecondes sur cette machine. Cela ne mesure ni la latence PRIM, ni les démarrages de fonctions, ni l’objectif d’environ trois secondes de bout en bout.

## Points encore à vérifier

- Quotas gratuits PRIM propres au compte et à l’API, débit, remise à zéro et conditions de cache.
- Acceptation et complétude du mode tabulaire, de la pagination, des identifiants et des paramètres sur les droits réels du compte.
- Compléter les captures réelles, comparer à des itinéraires indépendants de référence, vérifier les travaux prévus, retours nocturnes et changements d’heure.
- Latence à froid et à chaud pour dix participants. Le cache froid nominal peut utiliser jusqu’à 70 appels avec les vérifications détaillées des trois lieux.
- Optimum global exact à l’heure d’arrivée : l’isochrone de présélection au départ ne le prouve pas à lui seul.
- Google est configuré et une connexion réelle a été observée. Apple reste volontairement en attente ; signatures, notifications natives et associations de liens restent à tester sur appareil.
- Installation depuis Google Play et proposition de code au premier lancement iOS.
- Suivi écran verrouillé, permissions, consommation et arrêt effectif du capteur à l’arrivée ou à 90 minutes. Le serveur refuse déjà un droit expiré.
- La planification Vault/pg_cron est active sur Supabase distant. Le workflow OSM reste à publier et activer sur GitHub, dans ses quotas gratuits.

Aucune VM ni prestation payante n’a été ajoutée. Voir [la configuration](live-setup.md) et [l’analyse PRIM](prim.md).

## Validation du parcours manuel, 4 novembre 2026

Le test `test:manual` a réussi contre le projet distant : données privées avant adhésion, aperçu et résolution du code court, adhésion d’un second compte, choix d’un lieu OSM ouvert, vérification PRIM à deux puis dix participants et confirmation visible par l’invité. Les quatre premiers trajets ont été réutilisés après ajout de huit participants. Les deux comptes de test et leurs données ont été supprimés. Aucune notification n’a été envoyée.

Temps observés : 2,443 s à deux et 3,457 s à dix avec quatre trajets déjà frais. Les tests SQL couvrent la sélection réservée à l’organisateur, l’exclusion des lieux fermés ou trop éloignés et le rejet des anciens résultats après changement de groupe. Les tests navigateur couvrent la confirmation manuelle sans label d’optimum. Une validation physique reste nécessaire pour GPS, notifications et installation.

## Check-list à deux téléphones

À remplir à la main pendant un vrai test, sans rien déduire d’un test automatique. Indique « OK », « KO » ou « non testé », avec une note courte en cas d’écart. Préparation : [avoir Onyva dans la main](mise-en-main.md).

| Champ | Valeur |
| --- | --- |
| Date du test | |
| Build EAS (lien ou numéro) | |
| Téléphone A (organisateur) : modèle, version d’Android | |
| Téléphone B (invité) : modèle, version d’Android | |
| Réseau (Wi-Fi, 4G, 5G) | |

### Session et compte

| # | Vérification | A | B | Notes |
| --- | --- | --- | --- | --- |
| 1 | Premier lancement : seul le prénom est demandé, aucune connexion imposée | | | |
| 2 | Relier un compte Google depuis « Mon compte », puis le retrouver après réinstallation | | | |
| 3 | Refus ou annulation de la connexion Google : message clair, l’app reste utilisable | | | |

### Invitation et adhésion

| # | Vérification | A | B | Notes |
| --- | --- | --- | --- | --- |
| 4 | Création en « Suivant », « Suivant », « Créer » avec les valeurs proposées | | | |
| 5 | Partage du lien par le partage natif ou WhatsApp | | | |
| 6 | Adhésion par lien : l’app s’ouvre directement sur la sortie | | | |
| 7 | Adhésion par code saisi à la main dans « Rejoindre avec un code » | | | |
| 8 | Lien ouvert sans l’app installée : la page d’invitation montre qui invite et quand | | | |
| 9 | Code expiré ou faux : message clair, aucune donnée de la sortie visible | | | |

### Lieu, trajets et confirmation

| # | Vérification | A | B | Notes |
| --- | --- | --- | --- | --- |
| 10 | L’organisateur choisit une station de rendez-vous et voit des lieux ouverts | | | |
| 11 | Le lieu choisi n’affiche jamais « Le plus équilibré » | | | |
| 12 | Les allers et retours de chacun s’affichent, durées cohérentes avec un trajet réel | | | |
| 13 | Aucun bouton de confirmation tant que les trajets ne sont pas vérifiés | | | |
| 14 | L’invité voit la confirmation sans relancer l’app | | | |
| 15 | Ajout au calendrier en un geste | | | |

### Notifications et hors connexion

| # | Vérification | A | B | Notes |
| --- | --- | --- | --- | --- |
| 16 | « Me prévenir du lieu choisi » : demande de permission expliquée | | | |
| 17 | Notification reçue à la confirmation, app fermée | | | |
| 18 | Le toucher de la notification ouvre la sortie | | | |
| 19 | Mode avion : la sortie courante reste lisible, avec l’heure de la dernière version | | | |
| 20 | Retour du réseau : actualisation sans perte | | | |

### Position pendant la sortie

| # | Vérification | A | B | Notes |
| --- | --- | --- | --- | --- |
| 21 | « Je suis en route » : la permission en arrière-plan est expliquée avant la demande | | | |
| 22 | Écran verrouillé 10 min : la carte de l’autre téléphone se met à jour | | | |
| 23 | « Je suis arrivé » : le partage s’arrête, l’icône de localisation disparaît | | | |
| 24 | Sans action, le partage s’arrête seul après 90 minutes | | | |
| 25 | Carte fermée : plus aucune mise à jour reçue | | | |

### Suppression

| # | Vérification | A | B | Notes |
| --- | --- | --- | --- | --- |
| 26 | « Effacer mes données » ou « Supprimer mon compte » : confirmation demandée, puis données supprimées | | | |
| 27 | Après suppression, l’ancien lien ne donne plus accès à la sortie | | | |

### Bilan

| Question | Réponse |
| --- | --- |
| Blocages rencontrés | |
| Ce qui a surpris les testeurs | |
| À corriger avant un test plus large | |
