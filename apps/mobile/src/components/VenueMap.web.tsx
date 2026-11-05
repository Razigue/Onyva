import { useEffect, useRef, useState } from 'react';
import type { LivePosition, Station, Venue } from '@onyva/shared';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

export default function VenueMap({ stations, venues, positions = [] }: { stations: Station[]; venues: Venue[]; positions?: LivePosition[] }) {
  const container = useRef<HTMLDivElement>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!container.current) return;
    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({ container: container.current, style: 'https://tiles.openfreemap.org/styles/positron', center: [2.36, 48.86], zoom: 11, attributionControl: { compact: true } });
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
      map.on('error', () => setError(true));
      const bounds = new maplibregl.LngLatBounds();
      for (const station of stations) {
        new maplibregl.Marker({ color: '#111827', scale: .7 }).setLngLat([station.longitude, station.latitude]).setPopup(new maplibregl.Popup().setText(station.name)).addTo(map);
        bounds.extend([station.longitude, station.latitude]);
      }
      for (const [i, venue] of venues.entries()) {
        const marker = document.createElement('button');
        marker.type = 'button'; marker.textContent = String(i + 1); marker.setAttribute('aria-label', venue.name);
        Object.assign(marker.style, { width: '34px', height: '34px', borderRadius: '50%', border: '3px solid white', background: '#2E5BFF', color: 'white', fontWeight: '700', cursor: 'pointer' });
        new maplibregl.Marker({ element: marker }).setLngLat([venue.longitude, venue.latitude]).setPopup(new maplibregl.Popup().setText(venue.name)).addTo(map);
        bounds.extend([venue.longitude, venue.latitude]);
      }
      for (const position of positions) new maplibregl.Marker({color:'#267479',scale:.7}).setLngLat([position.longitude,position.latitude]).addTo(map);
      if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 55, maxZoom: 13, duration: 0 });
    } catch { setError(true); }
    return () => map?.remove();
  }, [stations, venues, positions]);
  return <div style={{ position: 'relative', height: 320, borderRadius: 18, overflow: 'hidden', background: '#E8ECE7' }}><div ref={container} aria-label="Carte des stations et des lieux proposés" style={{ height: '100%', width: '100%' }} />{error && <div role="status" style={{ position: 'absolute', bottom: 32, left: 12, right: 12, padding: 12, background: 'white', borderRadius: 8, fontSize: 13 }}>Le fond de carte est indisponible. Les stations sont indiquées dans la liste.</div>}</div>;
}
