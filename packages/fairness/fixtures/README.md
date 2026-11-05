# Réponses Navitia et captures PRIM

`navitia-contract.json` contient des exemples synthétiques au format documenté par [Navitia](https://doc.navitia.io/#journey-planning). La provenance indique explicitement `capturedFromPrim: false`. Ces exemples testent les règles pures et ne constituent pas une preuve de comportement du service PRIM.

Des réponses réellement enregistrées sur PRIM sont **à vérifier** : les premiers essais du 3 novembre 2026 révèlent un blocage de complétude et de correspondance des stations, documenté dans `docs/prim.md`. Après configuration de la clé serveur et du quota gratuit, enregistrer des isochrones tabulaires et des allers/retours datés, conserver les identifiants de stations, retirer tout secret ou donnée personnelle, puis compléter les tests avec les réponses brutes et leur date de capture. Ne jamais présenter un exemple reconstitué comme une capture réelle.

La commande `pnpm prim:record` capture les réponses réelles après configuration des variables `PRIM_FIXTURE_*` de `.env.example`. Elle utilise des stations du catalogue actif, réserve chaque appel dans le compteur partagé et écrit `prim-recorded.json`. Le test de rejeu est explicitement ignoré tant que ce fichier n’existe pas. Les latences enregistrées sont des mesures ponctuelles, pas une garantie de trois secondes.

`prim-probe-recorded.json` contient les premiers allers/retours réellement capturés et un fragment explicitement identifié de la première isochrone. Ce fragment teste le refus des arrêts sans station parente. Il ne prouve ni la complétude des isochrones ni la validité du classement d’un groupe.

`prim-zero-connection.json` conserve une réponse réelle après validation du schéma, sur des stations publiques de test. Elle couvre le raccord de zéro seconde fourni par PRIM. Les estimations à vol d’oiseau de durée positive restent exclues.
