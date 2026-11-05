# Brainstorming : Onyva (ex-Mi-chemin)

**Date :** 2026-10-15 et 2026-10-16
**Méthode :** BMAD, atelier de brainstorming (techniques recommandées)
**Sources :** `Idée Mi-chemin.pdf`, puis `PRODUCT.md`, `DESIGN.md`, `AGENTS.md` (ajoutés en cours de séance)
**Objectif :** idées classées par priorité, puis prochaines étapes

## Cadrage

- **Sujet :** Mi-chemin, une appli qui organise une sortie entre amis en Île-de-France (lieu équitable en transport, suivi des arrivées, retour vérifié).
- **Focus :** ouvert (valider le problème, élargir, différenciation et adoption, risques).
- **Techniques prévues :** Role Playing, What If, SCAMPER, Reverse Brainstorming, puis convergence.

## Technique 1 : Role Playing

### Yanis, l'organisateur

- **Douleur principale :** choisir le lieu, personne ne se décide jamais.
- **Five Whys :** du coup, la sortie n'a souvent **pas lieu du tout**.

**Insights (numérotation continue sur toute la séance)**

1. Personne ne propose de lieu par peur de paraître égoïste ou de se tromper. Un arbitre neutre (« l'algo a tranché, voilà la preuve ») lève ce frein. L'équité sert à clore le débat.
2. **Le vrai concurrent est l'annulation**, pas hugpoint. Promesse possible : « la sortie a vraiment lieu ».

**Idées**

1. « Décide pour nous » : 1 lieu proposé au lieu de 3, avec un bouton « autre ».
2. Validation automatique : sans objection en 20 min, le lieu est validé.
3. Veto plutôt que vote : chacun peut rejeter une fois, personne ne propose.
4. Découpler la station (équité, tranchée par l'algo) et le bar (goût, choix rapide). Mode « RDV sortie du métro ».
5. Filtres d'ambiance en un tap : terrasse, pas cher, calme, ouvert tard.
6. Mémoire du groupe (lieux aimés). En tension avec « aucun compte / tout effacé ».
7. Message prêt à coller dans WhatsApp, qui annonce la décision et fait la publicité de l'appli.
8. Quorum : « ça se fait dès 3 confirmés ». Sous le seuil à l'heure limite, la sortie est annulée proprement ou reportée.
9. Heure limite de décision affichée (« on décide avant 18 h 30 »), qui crée l'élan.
10. Le lien de l'organisateur contient déjà une proposition : on part d'une décision à contester, jamais d'une page blanche.
11. Statut visible « 4 viennent, 2 n'ont pas répondu » + relance d'un tap par l'organisateur (message pré-écrit).
12. Engagement léger : « je viens » plutôt que « peut-être ». Pas de bouton « peut-être ».

### Inès, l'invitée de banlieue

- **Constat :** elle décline souvent parce que « c'est trop loin ». L'éloignement est une cause directe des sorties annulées.

**Insights**

3. « Trop loin » est un **refus a priori**, sur une estimation au jugé. Le premier écran doit remplacer ce ressenti par un chiffre : « pour toi : 26 min ».
4. « Trop loin » cache souvent « je ne pourrai pas rentrer ». Le retour garanti est un argument d'adhésion, pas un bonus de V3.

**Idées**

13. Après la saisie de la station : « pour toi : 26 min, retour possible jusqu'à 0 h 47 », avant même de confirmer.
14. Temps maximal acceptable par personne (« pas plus de 30 min ») : une contrainte dure pour l'algo.
15. Contre-proposition : « si on décale de 30 min / si on choisit un café plutôt qu'un resto, Inès passe à 20 min ».
16. Rotation de l'équité : « la dernière fois Inès a fait le plus long trajet, cette fois on la favorise ». Nécessite une mémoire du groupe.
17. Pondération volontaire : « ce soir, on vient vers Inès » (anniversaire, fatigue, elle n'a pas de voiture…).
18. Inviter Inès en priorité : l'organisateur peut créer la sortie *autour* de quelqu'un.
19. Afficher le gain pour Inès : « 26 min au lieu de 52 si on avait dit Châtelet », comme preuve de l'équité.

### Léa, le retour de nuit

- **Constat :** certains partent tôt pour ne pas rater le dernier métro.

**Insights**

5. Le dernier métro est **l'heure de fin réelle de la soirée**. Les gens partent tôt *par marge de sécurité* parce qu'ils ne connaissent pas l'heure exacte. Une heure précise et fiable fait gagner du temps ensemble.
6. Nouveau critère d'équité possible : maximiser **le temps passé ensemble** (l'heure de départ commune la plus tardive), pas seulement minimiser le trajet.

**Idées**

20. Affichage du groupe : « vous avez jusqu'à 0 h 40 ensemble » (le premier dernier départ du groupe).
21. Choisir le lieu en tenant compte de la ligne de celui qui part le plus tôt (lieu sur sa ligne directe = il reste plus longtemps).
22. Heure de départ personnelle précise et rassurante : « pars à 0 h 32, tu as 4 min de marche, train à 0 h 41 ». Elle évite de partir 45 min trop tôt « au cas où ».
23. Alerte douce, discrète (vibration), pour ne pas casser l'ambiance.
24. « Qui rentre avec qui » : regrouper les personnes qui partagent une partie du trajet.
25. Plan B affiché d'office : Noctilien, Uber partagé à X personnes, « dormir chez Yanis ».
26. Avancer l'heure de début pour allonger la soirée : « si on se voit à 19 h 30 plutôt qu'à 20 h 30, tout le monde a 3 h ensemble ».
27. Indicateur de lieu « rentre tard » : lieux près des lignes qui ferment tard (RER, métro le week-end).

## Changements apportés par PRODUCT.md / AGENTS.md / DESIGN.md

- Nom : **Onyva**. Appli native Expo (iOS/Android) au lieu d'une PWA.
- **Connexion Apple/Google obligatoire** (le PDF disait « aucun compte »). L'invité sans l'appli passe par une page web, puis le store.
- Contrainte transverse : **tout doit rester gratuit** (Supabase, VM Oracle, OpenStreetMap via Overpass).
- Le compte rend possibles la mémoire du groupe et « Refaire avec ce groupe » (idées 6 et 16 débloquées).

**Insight**

7. **Tension majeure :** l'invité doit installer une appli et se connecter. C'est la friction maximale pour Inès, qui décline déjà au premier prétexte. Le lien d'invitation est le moment le plus fragile du produit.

**Idées**

28. Rejoindre depuis la page web sans installer : prénom + station, le résultat s'affiche. L'installation est proposée seulement pour les notifications et le suivi en direct.
29. Connexion anonyme Supabase (gratuite) pour l'invité web, convertible en compte Apple/Google plus tard.
30. L'organisateur ajoute lui-même « Inès, Montreuil » (déjà prévu) : utiliser ce mécanisme comme parcours par défaut pour les invités réticents.

## Technique 2 : What If

### C. Et si l'organisateur ne choisissait même pas la date ?

- **Constat :** tout le monde dit « dispo », mais personne ne lance.

**Insight**

8. Il manque **le rôle de celui qui lance**, pas l'envie. Onyva peut tenir ce rôle : transformer un « dispo » en sortie sans que personne ait à endosser la responsabilité de l'organisation.

**Idées**

31. Bouton « Dispo ce soir ? » : un seul tap, un lien envoyé au groupe, sans date ni lieu.
32. Lancement automatique au quorum : dès 3 « oui », la sortie est créée avec les défauts (ce soir, un verre, prochain créneau rond) et le lieu calculé.
33. Disponibilités permanentes : « je suis souvent dispo jeudi soir ». Onyva propose quand plusieurs personnes du groupe coïncident.
34. Rituel de groupe : « le jeudi de la bande », relancé automatiquement chaque semaine (désactivable).
35. Onyva signe l'invitation (« Onyva propose : ce soir 20 h ? ») : personne ne porte la responsabilité, personne ne se sent rejeté si ça ne prend pas.
36. Relance unique et sans pression aux silencieux, une heure avant la limite.

## Point d'étape : un MVP est-il possible ? (2026-10-16)

**Avis :** oui, assez de matière pour un MVP, mais **pas la V1 de `PRODUCT.md`**, trop lourde pour tester l'hypothèse principale.

**Hypothèse à tester :** un lien qui décide pour le groupe (lieu juste + retour garanti) fait que la sortie a vraiment lieu, et qu'Inès vient.

**MVP proposé**

- Organisateur : création avec les défauts, lien partagé sur WhatsApp.
- Invité : rejoint depuis le navigateur, sans installation ni compte (prénom + station).
- Calcul : minimax aller + exclusion des lieux sans retour possible, « vous avez jusqu'à 0 h 40 ensemble ».
- 1 lieu recommandé (+ 2 alternatives repliées), barres de temps par personne.
- Validation par l'organisateur, message prêt à coller dans le groupe.

**Reporté :** appli native et stores, connexion Apple/Google, position en direct, push, perturbations en temps réel, vote de créneaux, moteur RAPTOR maison (remplaçable au début par OpenTripPlanner auto-hébergé sur le GTFS IDFM ou par l'API d'itinéraires PRIM, quotas à vérifier).

**Mesures de succès :** part des sorties lancées qui ont lieu, part des invités qui rejoignent, délai entre le lien et la décision.

**À faire avant de coder :** confirmer les douleurs auprès de 3 à 5 autres groupes (les réponses de la séance viennent d'un seul groupe), trancher la question du compte pour l'invité, choisir la source d'itinéraires.

## Technique 4 : Reverse Brainstorming

**Question :** comment garantir que le MVP échoue ?

1. L'invité doit installer une appli pour répondre.
2. **Le lieu proposé est fermé ou nul : plus personne ne fait confiance à l'algo.** (piste creusée)
3. L'organisateur doit penser à ouvrir Onyva alors qu'il discute déjà sur WhatsApp.

### Creusement : « le lieu est nul »

**Façons d'échouer**

- Horaires OpenStreetMap faux ou absents : le bar est fermé à l'arrivée.
- La station optimale tombe dans un quartier mort le soir (zone de bureaux, gare de banlieue sans bar).
- Le bar est plein le vendredi, ou le resto exige une réservation.
- Le lieu est trop cher ou ne correspond pas à l'ambiance du groupe.

**Insight**

9. Le minimax pur choisit une station, pas un quartier où il fait bon sortir. **Un lieu juste mais nul tue la confiance plus vite qu'un lieu un peu moins juste mais bien.**

**Idées (retournement)**

37. Ne retenir comme candidates que des stations « de sortie » (densité minimale de bars, cafés et restos ouverts le soir).
38. Tolérance d'équité : accepter quelques minutes de plus sur le trajet maximal pour un quartier nettement meilleur, et l'afficher (« +3 min, mais Oberkampf »).
39. Proposer un **quartier** plutôt qu'un bar précis : « RDV métro Parmentier, 5 bars ouverts à 2 min ».
40. Afficher la fiabilité des horaires (« horaires non vérifiés »), sans jamais affirmer « ouvert » sans source.
41. Avis éclair après la sortie (« c'était bien ? » en un tap), qui enrichit une liste de lieux validés par les utilisateurs.
42. Liste de départ de lieux sûrs, constituée à la main, pour les quartiers les plus fréquents.

**Réponse :** le groupe se donne rendez-vous à **une adresse précise**, pas dans un quartier.

**Insight**

10. La qualité du lieu précis est donc critique, et elle repose sur des données (OpenStreetMap) gratuites mais incomplètes. L'idée 39 (quartier) passe au second plan. Compromis possible : **l'algo choisit la station, un humain valide le bar** parmi une courte liste filtrée (horaires renseignés, bon type), ce qui limite le risque de lieu fermé ou nul.

43. L'algo choisit la station, l'organisateur choisit le bar dans une courte liste filtrée (horaires renseignés, bon type, à moins de 5 min).

## Convergence : tri des idées (proposition, à valider)

### MVP
- 1. Un lieu recommandé, deux alternatives repliées.
- 7. Message prêt à coller dans WhatsApp.
- 10. Le lien arrive avec une proposition déjà faite.
- 11. Statut « 4 viennent, 2 n'ont pas répondu ».
- 12. Pas de bouton « peut-être ».
- 13. « Pour toi : 26 min, retour possible jusqu'à 0 h 47 » dès la saisie.
- 19. « 26 min au lieu de 52 si on avait dit Châtelet ».
- 20. « Vous avez jusqu'à 0 h 40 ensemble ».
- 22. Heure de départ précise pour rentrer.
- 28. Rejoindre depuis le navigateur, sans installer.
- 30. L'organisateur ajoute un invité lui-même.
- 37. Seulement des stations « de sortie ».
- 40. Fiabilité des horaires affichée.
- 43. L'algo choisit la station, l'organisateur choisit le bar.

### À creuser (à tester juste après le MVP)
- 2, 3, 8, 9. Mécanismes de décision : validation automatique, veto, quorum, heure limite.
- 14, 15. Temps maximal par personne, contre-proposition.
- 21. Critère « temps passé ensemble » (ligne directe de celui qui part le plus tôt).
- 29. Connexion anonyme pour l'invité.
- 31, 32, 35. « Dispo ce soir ? », lancement au quorum, invitation signée Onyva (peut devenir le cœur du produit).
- 38. Tolérance de quelques minutes pour un meilleur quartier.
- 41, 42. Avis éclair et liste de lieux sûrs.

### Plus tard
- 5. Filtres d'ambiance.
- 6, 16, 17, 18. Mémoire du groupe, rotation et pondération de l'équité.
- 23, 24, 25, 26, 27. Confort du retour : alerte discrète, trajets partagés, plan B, avancer le début, badge « rentre tard ».
- 33, 34, 36. Dispos permanentes, rituel hebdomadaire, relance.

### Écartées
- 4, 39. RDV à la sortie du métro ou dans un quartier : le groupe veut une adresse précise.
