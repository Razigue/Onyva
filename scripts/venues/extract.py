"""Extraire le PBF régional local, sans Overpass ni appel HTTP par établissement."""
import json
import sys
import osmium


class Venues:
    def write(self, entity, kind, coordinates):
        tags = dict(entity.tags)
        if tags.get('amenity') not in ('bar', 'pub', 'restaurant', 'cafe') or not tags.get('name'):
            return
        if not coordinates:
            return
        lat = sum(p[0] for p in coordinates) / len(coordinates)
        lon = sum(p[1] for p in coordinates) / len(coordinates)
        if not (48.1 <= lat <= 49.3 and 1.4 <= lon <= 3.6):
            return
        identifier = entity.orig_id() if kind == 'relation' else entity.id
        print(json.dumps({'id': f'osm-{kind}-{identifier}', 'name': tags['name'], 'kind': 'dinner' if tags['amenity'] == 'restaurant' else 'coffee' if tags['amenity'] == 'cafe' else 'drinks', 'latitude': lat, 'longitude': lon, 'openingHours': tags.get('opening_hours'), 'tags': {k: v for k, v in tags.items() if k in ('cuisine', 'diet:vegetarian', 'diet:vegan', 'outdoor_seating')}}))

    def node(self, entity):
        if entity.location.valid():
            self.write(entity, 'node', [(entity.location.lat, entity.location.lon)])

    def way(self, entity):
        if entity.tags.get('amenity') in ('bar', 'pub', 'restaurant', 'cafe'):
            points = [(n.lat, n.lon) for n in entity.nodes if n.location.valid()]
            if len(points) > 1 and points[0] == points[-1]:
                points.pop()
            self.write(entity, 'way', points)

    def area(self, entity):
        # Ways are already handled. Multipolygon relations can also be venues.
        if entity.from_way():
            return
        points = [(p.lat, p.lon) for ring in entity.outer_rings() for p in ring if p.location.valid()]
        self.write(entity, 'relation', points)


wanted = lambda: osmium.filter.TagFilter(*(('amenity', value) for value in ('bar', 'pub', 'restaurant', 'cafe')))
processor = osmium.FileProcessor(sys.argv[1]).with_locations().with_areas(wanted()).with_filter(wanted())
handler = Venues()
for entity in processor:
    if isinstance(entity, osmium.osm.Node):
        handler.node(entity)
    elif isinstance(entity, osmium.osm.Way):
        handler.way(entity)
    elif isinstance(entity, osmium.osm.Area):
        handler.area(entity)
