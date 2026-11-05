# Catalogue local OpenStreetMap

`preview-source.json` contient de vrais établissements OSM avec leurs horaires documentés et leur date d’extraction initiale, `fetchedAt`. Aucune position de participant ni adresse privée. Les identifiants de stations sont des alias utilisés uniquement pour la simulation locale.

Données : © les contributeurs OpenStreetMap, sous [licence ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/). [Attribution et source](https://www.openstreetmap.org/copyright).

L’extraction initiale provient de zones OSM autour de République, Châtelet, Oberkampf, Bastille et Nation. Les identifiants des objets, noms commerciaux et cuisines documentées sont conservés.

`pnpm preview:prepare` évalue les horaires enregistrés pour les neuf prochains jours et génère `apps/mobile/src/catalog/venues.json`. Il ne change jamais la date de provenance et ne prétend pas rafraîchir les établissements. Les trajets et retours de cet aperçu restent simulés.

Le mode connecté utilise un catalogue différent : l’extrait régional PBF importé chaque semaine dans Supabase. Aucune requête Overpass ni ancien cache de six heures ne reste nécessaire. Ne jamais modifier une date de provenance pour faire paraître un ancien catalogue actuel.
