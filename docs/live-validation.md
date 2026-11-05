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
