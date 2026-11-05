# Historique : plan B du moteur de transport

Cette note est conservée pour l’historique. Le 6 novembre 2026, le plan B est devenu le plan principal : voir [docs/engine.md](engine.md).

Le runtime de novembre 2026 utilisait PRIM et Supabase. Le service Node de routage, le package RAPTOR, Drizzle, les fichiers Docker et les unités Oracle avaient été retirés de la stack active. Le plan B consistait à réintroduire un calculateur derrière la même frontière Supabase si les quotas, la disponibilité ou les conditions de PRIM devenaient incompatibles avec le produit. C’est ce qui a été décidé, après le constat des isochrones tabulaires tronquées à 1 000 entrées décrit dans [docs/prim.md](prim.md).

L’ancien prototype chargeait un extrait daté GTFS IDFM, construisait un réseau indexé en mémoire et calculait les allers à l’arrivée avec un réseau inversé, ainsi que les retours après le départ. Il incluait marche, attente, correspondances, restrictions de montée et descente, exceptions calendaires et services après minuit. Son classement utilisait maximum, somme et écart, avec exclusion des retours impossibles.

Une mesure historique locale sur les données du 2 novembre 2026 obtenait douze suggestions pour dix participants en 826 ms après préparation du réseau. Ce scénario utilisait cinq départs distincts répétés et 190 lieux. Il ne démontrait ni un optimum sur toute la région, ni une validation indépendante IDFM, ni les performances d’une VM. Cette mesure ne sert pas de preuve pour le nouveau moteur, qui est mesuré à nouveau dans `docs/engine.md`.
