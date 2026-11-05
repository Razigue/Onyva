# État et prochaines actions

État au 4 novembre 2026.

## Disponible

- Application locale : http://localhost:8082.
- Page d’invitation locale : http://localhost:4174. Une URL locale ne fonctionne pas chez un ami distant.
- Supabase distant : migrations jusqu’à 0014 et quatre fonctions déployées, RLS et planifications actives.
- Connexion Google réelle vérifiée. Apple reste volontairement en attente.
- Création, adhésion par code court ou lien, choix manuel d’un lieu ouvert, allers et retours PRIM, confirmation partagée et cache hors connexion.
- Catalogue de 24 879 lieux OSM et 15 382 stations actives. Les libellés des stations incluent désormais la commune quand PRIM la fournit.
- Recherche automatique du juste milieu désactivée. Les isochrones tabulaires restent à résoudre avant sa reprise.
- Tests : 49 unitaires réussis, un rejeu d’isochrones encore ignoré ; 16 tests navigateur réussis ; tests PostgreSQL/PostGIS réussis ; parcours distant à deux puis dix participants réussi.

## Besoin de l’utilisateur

1. Choisir la visibilité du dépôt GitHub avant le premier envoi du code. Le dépôt Razigue/Onyva est public et vide. Les secrets et variables Supabase nécessaires aux imports sont configurés, les workflows sont prêts localement. L’import hebdomadaire n’est pas encore actif.
2. Fournir un accès Cloudflare Pages pour publier la page d’invitation. Le workflow manuel est prêt. Un domaine gratuit pages.dev suffit. Il faudra ensuite configurer cette URL dans l’application et vérifier les associations de liens avec les vrais certificats.
3. Se connecter à Expo, lier un projet EAS gratuit et configurer Firebase/FCM pour Android. Aucun APK installable n’a encore été produit. Les exports JavaScript ne remplacent pas ce build.
4. Installer sur deux appareils et tester Google, invitation, adhésion, lieu manuel, trajets, confirmation, notifications, hors connexion et suppression du compte. Vérifier le GPS écran verrouillé, l’arrêt à l’arrivée et après 90 minutes.
5. Plus tard : Apple Sign In, signature iOS et validation physique du premier lancement avec code. Pas de publication iOS avec Google seul.

## Points techniques à surveiller

- Quota PRIM : offre transmise de 1 000 appels par jour pour l’accès générique. Débit, remise à zéro et attribution effective du compte restent à vérifier. Aucun dépassement payant automatique.
- Mesure du mode manuel : résultat à dix en 3,457 s avec quatre trajets déjà en cache, observation ponctuelle. Voir docs/prim.md.
- Les appels PRIM locaux sont désactivés dans le fichier serveur local afin de ne pas utiliser la même clé avec deux compteurs indépendants. L’application utilise le backend distant et son compteur partagé.
- Les exports et les tests web ne valident ni les notifications natives ni le suivi physique.
- Surveiller stockage Supabase, minutes GitHub Actions et quotas gratuits EAS. Ne pas activer de facturation automatique.
