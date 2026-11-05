# Décisions d’implémentation

`PRODUCT.md` reste la référence. La simplification remplace l’hébergement du transport par PRIM, conserve les règles pures et n’ajoute aucun service payant.

Les contrats sont dans `packages/shared`. Les migrations SQL Supabase définissent la base et la CLI génère les types. Les clés PRIM et de service ne sont jamais envoyées à l’application. Les RPC vérifient l’appartenance et les droits de l’organisateur ; les caches et quotas ne sont accessibles qu’au serveur.

Le calcul est progressif. L’application lit les étapes déjà enregistrées par une RPC autorisée, sans relancer une Edge Function à chaque seconde. Une entrée individuelle fraîche est réutilisée indépendamment de la composition du groupe. Les requêtes identiques sont coordonnées en base. Les résultats sont publiés seulement si la révision de la sortie est encore courante. Les réactions ne sont pas supprimées pendant une simple mise à jour partielle ; un changement de groupe invalide toujours les recommandations.

Une isochrone sert à présélectionner, pas à inventer un itinéraire. Les temps exacts, la marche finale et les retours des trois lieux sont vérifiés par des trajets détaillés. Les limites de paramètres, de quota, de latence et d’optimalité globale encore non démontrées sont indiquées dans `docs/prim.md`.

Les lieux viennent d’un extrait régional OSM importé chaque semaine. L’activation du lot est atomique et la proximité utilise PostGIS. Les horaires inconnus et les retours absents excluent un lieu. Les avis restent des liens externes.

Les positions ne sont ni persistées ni envoyées par WebSocket par la tâche native. Une Edge Function les authentifie et les relaie par HTTP sur un canal Realtime privé. Les droits signés expirent au plus tard après 90 minutes. Les cartes reçoivent uniquement lorsqu’elles sont visibles au premier plan. Le canal change avec la révision pour qu’un ancien membre ne reçoive pas les nouvelles positions.

L’installation différée utilise uniquement les mécanismes demandés : referrer Google Play sur Android, code court copié volontairement et proposé au premier lancement sur iOS. Aucun service tiers d’attribution ni lecture automatique du presse-papier.

Le cache hors connexion, la suppression après 24 h, la suppression du compte, les notifications de confirmation et le système visuel existant sont conservés. Les anciens résultats GTFS confirmés restent lisibles pour compatibilité de données, sans réintroduire le moteur dans le runtime.

Le parcours courant met la recherche automatique en pause. Le choix manuel d’un lieu utilise deux RPC autorisées et conserve son instantané dans la sortie. Une vérification détaillée par personne remplace les isochrones pour ce parcours. Le résultat est invalidé à chaque changement de groupe, sans effacer les trajets individuels encore frais. Le code court reste accessible après le premier lancement, depuis l’écran de sortie et la saisie d’invitation.
