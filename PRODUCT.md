# Onyva

Onyva accompagne une sortie entre amis en Île-de-France : trouver un lieu équitable selon les vrais trajets en transports, suivre les arrivées et vérifier que chacun peut rentrer.

## Pourquoi

- Problème : le lieu est choisi au hasard, quelqu’un se retrouve avec 50 minutes de trajet et le retour tardif est oublié.
- Promesse : un lien dans le groupe, aucun compte à créer, un lieu juste pour tout le monde.
- Public : groupes de 2 à 10 amis, pour un verre, un dîner ou un café.
- Différence : horaires et perturbations IDFM, retour pris en compte, saisie par station et partage temporaire de la position pendant la sortie.

## Principes d’usage

L’application demande le minimum nécessaire : trois gestes pour créer une sortie et deux pour la rejoindre, sans compte.

1. Aucun compte requis. Au premier lancement, le téléphone reçoit une session anonyme invisible et la personne saisit seulement son prénom. Relier un compte Apple ou Google reste facultatif : il sert à retrouver ses sorties sur un autre téléphone ou après une réinstallation.
2. Des valeurs préremplies : ce soir, le prochain créneau rond au moins une heure plus tard, un verre et le dernier départ utilisé.
3. Une station plutôt qu’une adresse. « Ma position » devient la station la plus proche. Aucune adresse exacte n’est montrée aux autres.
4. Une preuve visible de l’équité : une barre de temps par personne et l’écart maximum.
5. Des résultats dès deux participants, actualisés à chaque arrivée. L’organisateur peut ajouter un ami manuellement.
6. Peu de notifications, uniquement utiles : lieu confirmé, perturbation, moment de partir. Aucun message publicitaire.
7. Une application utilisable d’une main et sur une mauvaise connexion, avec la sortie courante gardée en cache local.
8. Du tutoiement, des phrases courtes et aucun jargon de transport.

## Parcours

Une sortie va de la création à l’expiration en sept étapes.

1. **Créer, pour l’organisateur.** Un assistant en quatre écrans, avec progression et retour :
   - Quand : ce soir, demain, ce week-end ou une date, puis l’heure. Jusqu’à trois créneaux soumis au vote si la date n’est pas fixée.
   - Quoi : un verre, un dîner, un café ou autre chose.
   - D’où : la station de départ de l’organisateur.
   - Résumé : le lien, le partage natif ou WhatsApp et l’ajout manuel des participants.

   Chaque écran est prérempli : « Suivant », « Suivant », « Créer » suffit.
2. **Rejoindre, pour l’invité.** Si l’application est installée, le lien ouvre la sortie. Sinon, la page montre qui invite, quand et qui a déjà rejoint, avec les liens vers les boutiques. Sur Android, le lien Google Play transporte le code par Install Referrer ; l’application le récupère au premier lancement. Sur iOS, la page affiche un code court et un bouton pour le copier avant l’installation ; l’application propose de le coller ou de le saisir au premier lancement. Aucune lecture automatique du presse-papier. L’invité saisit son prénom, choisit son départ et son retour, identiques par défaut, puis vote si nécessaire. Contraintes facultatives inchangées : budget et accessibilité en fauteuil.
3. **Choisir le lieu.** Résultats progressifs, avec un objectif d’environ trois secondes pour dix personnes. Une isochrone par participant à l’heure du rendez-vous sert au classement des stations. La station minimise le trajet le plus long, puis la somme, puis l’écart. Les allers à l’heure d’arrivée et les retours sont vérifiés pour les trois meilleurs lieux avant confirmation. L’application propose jusqu’à douze restaurants ou six lieux pour les autres activités ; ce sont des plafonds, seuls les lieux effectivement vérifiés sont affichés comme confirmables. Les alternatives de dîner favorisent les cuisines documentées, en conservant le meilleur choix et l’ordre d’équité. Chaque carte montre les temps individuels, l’écart, le dernier horaire de retour possible et les perturbations prises en compte. Une carte montre départs et lieux. Chacun peut réagir, l’organisateur confirme.
4. **Après confirmation.** Chacun reçoit le lieu, son itinéraire personnel et un ajout au calendrier en un geste.
5. **Avant de partir.** Rappel « pars dans 10 min » calculé sur l’itinéraire en temps réel. Si une perturbation rend le lieu clairement inéquitable, une nouvelle suggestion est envoyée à l’organisateur.
6. **Pendant.** « Je suis en route » active un partage temporaire qui continue écran verrouillé. La tâche de fond envoie chaque position par HTTP à Supabase, sans WebSocket. Seules les cartes ouvertes au premier plan s’abonnent en temps réel. La carte montre les arrivées ; sans GPS, elles sont estimées depuis l’itinéraire. Messages rapides : « J’ai du retard », « Commandez sans moi », « Je suis arrivé ».
7. **Rentrer.** À la fin prévue ou via « On rentre », chacun voit son dernier départ possible, un compte à rebours et les portions de retour partagées. Alerte quinze minutes avant le dernier métro. Le lendemain, la sortie expire, avec une option « Refaire avec ce groupe ».

## Parcours provisoire sans recherche du juste milieu

La recherche automatique est mise en attente à la demande de l’utilisateur. La création et l’adhésion restent possibles. L’organisateur choisit une station de rendez-vous, consulte les établissements du bon type ouverts pendant toute la sortie à cinq minutes de marche estimée, puis choisit un lieu. Aucun optimum d’équité n’est annoncé pour ce choix manuel.

À partir de deux participants, PRIM vérifie les allers à l’heure du rendez-vous et les retours après la fin vers ce lieu précis. Une confirmation exige tous les trajets vérifiés. Un ajout de participant conserve le lieu choisi, invalide le résultat de groupe et réutilise les trajets individuels encore frais. Les droits de modification, les horaires, la confidentialité et les limites du groupe restent les mêmes. Les règles de recherche automatique ci-dessous restent documentées pour sa reprise ultérieure.

## Règles métier

Le meilleur lieu minimise le trajet le plus long du groupe, à condition que chacun puisse rentrer.

- Équité : minimum du maximum, puis de la somme, puis de l’écart entre le plus long et le plus court trajet.
- Retour : exclusion dès qu’une personne ne peut pas rentrer en transports après la fin prévue, par défaut 2 h 30 après le début. Un Noctilien est accepté et signalé.
- Heure du calcul : heure du rendez-vous, jamais maintenant par défaut. Travaux prévus inclus. Temps réel dans les deux heures avant le rendez-vous.
- Trajet complet : marche vers la station, attente, correspondances et marche jusqu’au lieu.
- Candidats : station optimale, puis lieux du bon type, ouverts pendant la sortie et à moins de cinq minutes à pied. La recherche de proximité utilise PostGIS ; l’itinéraire détaillé vérifie la marche finale.
- Recalcul : à chaque ajout ou modification d’un participant. Cache court des temps individuels : tant qu’ils sont frais, seul le nouvel arrivant provoque une nouvelle isochrone. Un changement de date, de départ ou de fraîcheur invalide l’entrée correspondante. Après confirmation, nouvelle suggestion seulement en cas de perturbation si le maximum augmente de plus de dix minutes.
- Limites : 2 à 10 personnes, départs en Île-de-France uniquement. Transports en commun et marche en V1, Vélib en V2.
- Performance : affichage progressif, objectif d’environ trois secondes pour dix personnes. La latence PRIM réelle et les quotas ne sont pas garantis par cet objectif.

## Données et confidentialité

Le compte est conservé ; tout ce qui est lié à une sortie est supprimé 24 h après sa fin.

| Données | Source ou stockage | Conservation |
| --- | --- | --- |
| Isochrones, itinéraires, horaires et perturbations | API PRIM IDFM, calculateur Navitia, clé serveur | Cache court des temps individuels et trajets, lié à la sortie |
| Stations | Catalogue de référence PRIM dans Supabase | Données de référence, actualisées lors d’un import explicite |
| Bars, restaurants, cafés, cuisines et horaires | Extrait OpenStreetMap régional importé chaque semaine par GitHub Actions, recherche PostGIS | Catalogue de référence dans Supabase, remplacé atomiquement ; anciens imports supprimés |
| Sortie, participants et stations de départ/retour | Supabase | Suppression 24 h après la fin |
| Position en direct | Envoi HTTP puis relais Supabase Realtime privé | Aucun stockage en base ou dans les logs ; arrêt à l’arrivée ou après 90 min |
| Identité | Session anonyme : identifiant technique et prénom saisi. Si un compte Apple ou Google est relié : prénom, adresse électronique, relais privé Apple accepté | Jusqu’à la suppression du compte ou des données |
| Invitation après installation | Install Referrer Google Play ou code court copié par l’invité sur iOS | Jusqu’à utilisation ou expiration de l’invitation |

Aucune adresse exacte de participant ni traceur publicitaire. Le compte peut être supprimé depuis l’application.

## Périmètre par version

La V1 doit être testée sur de vraies sorties avant d’étendre le produit. Les adaptations techniques de position et d’installation demandées ici ne changent pas le reste de ce périmètre.

| Version | Objectif | Contenu |
| --- | --- | --- |
| V1 | Le cœur | Création, lien partagé et reprise après installation, utilisation sans compte avec Apple ou Google facultatifs, calcul aller/retour équitable, jusqu’à douze restaurants ou six autres lieux, carte, confirmation, notification et travaux prévus |
| V2 | La soirée | Rappel de départ, perturbations en temps réel, position en arrière-plan et carte en direct, messages rapides, vote de créneaux, Vélib |
| V3 | Retour et habitudes | Dernier départ, compte à rebours, retours partagés, alerte dernier métro et « Refaire avec ce groupe » |

Hors périmètre : réservation de table, partage de dépenses, discussion libre et villes hors Île-de-France.

## Coûts

Les services applicatifs doivent rester dans leurs offres gratuites au démarrage. Aucun dépassement payant automatique. Les éventuels comptes des boutiques restent l’exception déjà prévue pour la publication.

- PRIM : accès soumis au quota du compte et de l’API. Offre PRIM transmise : accès générique gratuit à 1 000 requêtes par jour par défaut, augmentation possible à 20 000 sur demande. API graphique isochrones limitée à 10 requêtes par mois. Attribution effective du compte, fréquence de remise à zéro et débit autorisé : **à vérifier** dans « Ma consommation API ». Les premiers tests du mode tabulaire générique révèlent une réponse incomplète à résoudre avant activation en production, voir `docs/prim.md`. Le plafond quotidien partagé doit être renseigné avant activation ; il inclut isochrones, allers détaillés, retours et import du catalogue de stations.
- Supabase : offre gratuite, quotas de base, de stockage, de fonctions et de Realtime à surveiller, ainsi que la mise en pause après une semaine d’inactivité.
- GitHub Actions : une importation régionale hebdomadaire, dans les minutes gratuites du dépôt. Volume et durée de l’import à surveiller.
- Cloudflare Pages, Expo et OpenStreetMap : usages dans leurs offres et limites gratuites. Aucun service payant de liens différés.
- Apple Developer Program : frais de publication déjà prévus, 99 dollars par an.
- Google Play : frais de publication déjà prévus, 25 dollars en une fois. L’Install Referrer nécessite une installation depuis Google Play. Un pilote Android peut utiliser un APK sans publication, avec réouverture manuelle du lien.

Les trajets passent à un moteur maison alimenté par le GTFS IDFM, hébergé gratuitement pour le MVP (Oracle Cloud Always Free, voir `docs/engine.md`). Aucun service payant n’est activé. PRIM reste actif jusqu’au branchement du moteur.

## Avant publication

- Vérifier la suppression du compte sur appareil.
- Justifier l’usage de la position en arrière-plan pour les boutiques.
- Confirmer le quota PRIM gratuit, capturer des réponses réelles et mesurer les latences, notamment pour dix participants.
- Tester la reprise après installation sur Google Play et sur iOS.

## Découverte des lieux

OpenStreetMap fournit les établissements et les cuisines documentées ; une cuisine absente reste inconnue. L’import régional hebdomadaire conserve les horaires, calcule leur couverture pour les prochaines sorties et active le nouveau catalogue seulement s’il est complet. Aucun appel direct à Overpass.

Les alternatives de dîner favorisent les cuisines disponibles : viande, poisson, italien, chinois, japonais, indien, français, oriental, végétarien et autres. Tous les lieux respectent les règles d’ouverture et de retour. Le meilleur choix est conservé et l’ordre reste maximum, somme, écart. Les avis Google Maps sont consultables par lien externe ; aucune note ni aucun avis n’est inventé. Google Places exige toujours une autorisation distincte, car sa facturation est à l’usage.

Il n’existe plus d’essai local avec des trajets simulés. Sans compte, la session anonyme donne accès au parcours complet : stations, lieux réels, trajets PRIM vérifiés et partage. Chaque session a un plafond quotidien d’appels PRIM (`PRIM_USER_DAILY_LIMIT`, 100 par défaut), en plus du plafond partagé. Sans compte relié, supprimer l’application fait perdre l’accès à ses sorties.
