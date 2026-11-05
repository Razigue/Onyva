# Plan B : moteur de transport autonome

Le runtime courant utilise PRIM et Supabase. Le service Node de routage, le package RAPTOR, Drizzle, les fichiers Docker et les unités Oracle ont été retirés de la stack active.

Le plan B consiste à réintroduire un calculateur derrière la même frontière Supabase si les quotas, la disponibilité ou les conditions de PRIM deviennent incompatibles avec le produit. L’application ne doit pas changer de contrat pour ce basculement.

L’ancien prototype chargeait un extrait daté GTFS IDFM, construisait un réseau indexé en mémoire et calculait les allers à l’arrivée avec un réseau inversé, ainsi que les retours après le départ. Il incluait marche, attente, correspondances, restrictions de montée et descente, exceptions calendaires et services après minuit. Son classement utilisait maximum, somme et écart, avec exclusion des retours impossibles.

Une mesure historique locale sur les données du 2 novembre 2026 obtenait douze suggestions pour dix participants en 826 ms après préparation du réseau. Ce scénario utilisait cinq départs distincts répétés et 190 lieux. Il ne démontrait ni un optimum sur toute la région, ni une validation indépendante IDFM, ni les performances d’une VM. Il ne mesure pas PRIM.

Pour réactiver ce plan : choisir explicitement un hébergement gratuit disponible, restaurer ou reconstruire l’adaptateur GTFS et le moteur, ajouter des itinéraires de référence indépendants, mesurer la mémoire et la latence sur la machine cible, puis brancher l’adaptateur dans l’Edge Function. Conserver les schémas Zod, les RPC, le résultat progressif et les règles pures existantes. Aucun déploiement Oracle ni téléchargement GTFS quotidien ne reste nécessaire à la version courante.

Ce plan n’est ni activé automatiquement lors d’un dépassement de quota, ni une autorisation d’utiliser un service payant.
