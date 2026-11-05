# PRIM : vérifications et limites

État de la consultation et des premiers appels réels : 3 novembre 2026. Sources prioritaires : documentation PRIM et documentation Navitia vers laquelle PRIM renvoie. Aucun quota ni temps de réponse non mesuré n’est présenté comme acquis.

## Ce qui est établi

- Le [catalogue PRIM Isochrones v2](https://prim.iledefrance-mobilites.fr/fr/apis/idfm-navitia-isochrones-v2) décrit le service d’accessibilité et renvoie au compte pour l’accès et à « Ma consommation API » pour les quotas.
- Le [guide officiel du Playground](https://prim.iledefrance-mobilites.fr/fr/aide-et-contact/documentation/prise-en-main-des-api/prise-en-main-des-api-calculateur-ile-de-france-mobilites/utilisation-du-playground) décrit la base `https://prim.iledefrance-mobilites.fr/marketplace/v2` et les chemins Navitia. L’API graphique dédiée répète `isochrones` dans son chemin.
- La [documentation Navitia](https://doc.navitia.io/#journey-planning) décrit le mode tabulaire d’isochrones : `/journeys` avec une seule origine ou une seule destination. Le service `/isochrones` renvoie des polygones ; il ne fournit pas un temps exact par station. Le code utilise le mode tabulaire pour classer des temps plutôt que des classes de polygones.
- Les requêtes précisent date, direction, marche et fraîcheur. Les allers détaillés demandent une arrivée au rendez-vous ; les retours demandent un départ après la fin de soirée. L’attente et les sections de marche sont conservées.

## À vérifier avant activation réelle

| Sujet | État |
| --- | --- |
| Quota gratuit de l’API générique | Offre PRIM transmise par l’utilisateur : 1 000 requêtes par jour par défaut, augmentation gratuite possible à 20 000 sur demande. Plafond local fixé à 1 000 ; attribution effective visible dans le compte encore à vérifier |
| Quota de l’API graphique Isochrones v2 | Offre transmise : 10 requêtes par mois, y compris avec quota augmenté. Inadapté au runtime envisagé. Partage éventuel des budgets : à vérifier |
| Débit autorisé, pics, remise à zéro et blocage sans facturation au dépassement | **À vérifier** dans le compte ou auprès de PRIM. Le compteur local utilise la journée de Paris ; adapter si le contrat du compte diffère |
| Conditions de cache et de réutilisation de la Licence Mobilité | **À vérifier** pour le compte et l’usage. Cache technique configuré à 180 secondes |
| Latence médiane et p95 pour dix personnes | **À vérifier**. Premiers appels isolés : isochrone 2 385 ms et 2 155 ms, aller détaillé 460 ms. Ces observations ne mesurent pas un groupe ni le bout en bout |
| Complétude des isochrones tabulaires | **Bloquant constaté** : `count=1000` et `count=20000` renvoient tous deux exactement 1 000 entrées, sans pagination, sur le départ testé. Pas de preuve de complétude. Le code rejette cette saturation |
| En-tête `apiKey` et chemins | Testés : `/marketplace/v2/navitia/stop_areas` et `/marketplace/v2/navitia/journeys` répondent 200. Le chemin comportant `/coverage/idfm` répond 400 « unknown type: coverage » et a été corrigé |
| Horizon de dates, travaux planifiés, temps réel et retours Noctilien | **À vérifier** sur des itinéraires de référence datés, notamment après minuit et aux changements d’heure |
| Captures PRIM et références | Premiers allers/retours réels et fragment d’isochrone enregistrés avec provenance. Le rejeu complet de groupe et les comparaisons avec le calculateur officiel restent **à vérifier** |

## Coût d’un calcul

Pour N personnes, un cache froid utilise N isochrones tabulaires. Pour chacun des trois lieux présélectionnés, un aller détaillé par personne vérifie l’arrivée à l’heure et la marche finale, puis un retour détaillé vérifie le retour après la soirée. Maximum nominal : `N + 3 × N × 2`, soit 70 requêtes pour dix personnes. Ce total n’est pas un quota gratuit.

Les vérifications détaillées sont nécessaires : un isochrone au départ à l’heure du rendez-vous ne démontre pas qu’un trajet arrivera avant cette heure. Les temps de présélection ne certifient donc pas à eux seuls l’optimum global des itinéraires à l’arrivée. Le classement maximum, somme, écart est appliqué aux données reçues, puis aux trois lieux vérifiés. La garantie d’un optimum global exact avec un seul appel par personne reste **à vérifier** et ne doit pas être annoncée sans preuve.

Les résultats individuels restent dans un cache partagé lié à la sortie. Si les trois lieux restent identiques et que le cache est frais, un nouvel arrivant nécessite au maximum une nouvelle isochrone et six trajets détaillés ; les appels des autres sont réutilisés. Un changement de lieu présélectionné, de date, de station, de sens, de fraîcheur ou une expiration du cache peut demander d’autres appels. Aucune promesse de gratuité illimitée.

## Garde-fous

`PRIM_API_KEY`, `PRIM_DAILY_LIMIT` et `PRIM_QUOTA_CONFIRMED=true` sont requis côté serveur. Aucun plafond gratuit n’est choisi automatiquement. Le compteur PostgreSQL est partagé et atomique ; chaque appel réel réserve une unité avant le réseau. Les tâches d’import des stations utilisent le même budget. Une erreur ou un quota atteint ne déclenche pas une bascule vers une API payante.

Les clés de cache comprennent les paramètres et la date, pas la composition complète du groupe. Les révisions des sorties et un verrou temporaire empêchent les résultats obsolètes. Les sorties publient leur progression en base ; les positions GPS n’utilisent jamais ce mécanisme.

L’objectif d’environ trois secondes concerne l’expérience progressive. Le benchmark Vitest mesure seulement le classement pur. Le réseau PRIM, le démarrage d’une Edge Function, les vérifications de retour et les appels de base doivent être mesurés séparément. Aucune mesure du moteur retiré n’est utilisée comme preuve pour PRIM.

Les requêtes ne limitent pas arbitrairement les trajets à deux heures : elles utilisent `max_duration=86400`, valeur par défaut documentée par Navitia, et demandent le français. Un trajet théorique signalé comme perturbé n’est pas accepté lorsque ses horaires corrigés ne sont pas vérifiés. Le mode `adapted_schedule` est obsolète dans la documentation Navitia et n’est pas envoyé. La couverture effective des travaux prévus et des alternatives reste à vérifier avec PRIM.

La commande `pnpm prim:record`, après import des stations et configuration des variables `PRIM_FIXTURE_*`, enregistre de vraies réponses et des latences ponctuelles. Chaque appel est réservé dans le même compteur. Elle ne remplace pas une mesure de bout en bout pour dix personnes.

## Blocage observé le 3 novembre 2026

La clé réelle autorise l’accès générique. Le catalogue a fourni 15 404 stations, importées localement. Une tentative d’import a subi une erreur réseau ; la relance a terminé. Tous les essais réservent une unité dans le compteur partagé, même en cas d’échec.

Pour un départ public de test à Paris le 4 novembre à 18 h, le mode tabulaire renvoie des `stop_point`, sans `stop_area` parent, même avec `depth=3`. Le dernier trajet de la réponse saturée dure 1 620 secondes malgré `max_duration=86400`. Augmenter `count` à 20 000 n’a pas augmenté le nombre reçu. Ce constat ponctuel ne démontre pas un plafond contractuel universel ; il empêche de considérer ces réponses comme un catalogue complet de temps par station.

Le package pur rejette les réponses saturées à 1 000 entrées et les points sans station parente. Ne pas activer les recommandations réelles en production avant résolution. À demander à PRIM : paramètres permettant une réponse tabulaire complète, plafond effectif, relation stop_point/stop_area, consommation de ce mode sur le quota générique, débit et heure de remise à zéro. L’API graphique à 10 appels mensuels ne constitue pas un remplacement viable. Aucun repli payant ni changement de règle produit n’a été ajouté.

## Mode manuel provisoire

La mise en attente de la recherche automatique ne bloque pas les trajets détaillés. Un établissement choisi explicitement près d’une station est validé contre le catalogue ouvert actuel, puis vérifié avec deux appels par participant à froid : aller à l’arrivée et retour au départ après la fin. Aucun appel isochrone, aucun classement minimax annoncé. Les mêmes caches, quotas, verrous et contrôles de révision s’appliquent. Un nouvel arrivant réutilise les trajets frais des autres ; un lieu sans retour vérifiable n’est pas confirmable.

### Mesure réelle du mode manuel, 4 novembre 2026

Un essai distant Supabase et PRIM a validé l’invitation par code court, l’adhésion d’un deuxième compte, un restaurant réel ouvert, les allers et retours et la confirmation partagée à dix participants. Les comptes et sorties temporaires ont été supprimés.

- Deux personnes à froid : réponse de progression en 325 ms, résultat vérifié observé à 2 443 ms, quatre trajets en cache.
- Dix personnes après ajout de huit amis : progression en 229 ms, résultat vérifié observé à 3 457 ms, vingt trajets en cache. Les quatre trajets précédents ont été réutilisés ; seize appels supplémentaires étaient nécessaires.

Le client du test lit la progression chaque seconde. Ces mesures ponctuelles, sur un seul lieu et des stations parisiennes, ne sont ni une médiane, ni un p95, ni un test à dix entièrement à froid. Elles ne valident pas la recherche automatique en pause.

Les essais ont révélé un raccord PRIM `crow_fly` de zéro seconde à une station. Ce raccord sans déplacement est accepté ; une portion `crow_fly` de durée positive reste refusée. Une capture authentique et des tests couvrent cette distinction. Une première sélection de référence confondait deux arrêts homonymes : le catalogue conserve désormais le libellé PRIM avec sa commune. Les trajets `NO_SERVICE` restent refusés, même si cela laisse le groupe sans résultat.
