import React, { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Location } from '@/types/location';

interface MapProps {
  locations: Location[];
  center: [number, number];
  onLocationClick: (location: Location) => void;
  onMapClick?: (lat: number, lng: number) => void;
  apiKey?: string;
  onMapReady?: (map: mapboxgl.Map) => void;
  onMapMoved?: (lat: number, lng: number) => void;
  onUserDragStart?: () => void;
}

const getBusynessColor = (busyness: string) => {
  switch (busyness) {
    case 'low':
      return '#22c55e';
    case 'moderate':
      return '#eab308';
    case 'high':
      return '#ef4444';
    default:
      return '#0ea5e9';
  }
};

const Map: React.FC<MapProps> = ({ locations, center, onLocationClick, onMapClick, apiKey, onMapReady, onMapMoved, onUserDragStart }) => {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || !apiKey) return;

    mapboxgl.accessToken = apiKey;

    if (!mapRef.current) {
      mapRef.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/light-v11',
        center: [center[1], center[0]],
        zoom: 14,
      });

      mapRef.current.addControl(
        new mapboxgl.NavigationControl({ visualizePitch: true }),
        'top-right',
      );

      // Add click handler for map
      if (onMapClick) {
        mapRef.current.on('click', (e) => {
          const { lat, lng } = e.lngLat;
          onMapClick(lat, lng);
        });
      }

      // Notify parent when map is ready
      if (onMapReady) {
        mapRef.current.on('load', () => {
          onMapReady(mapRef.current!);
        });
      }

      // Track when user starts dragging
      if (onUserDragStart) {
        mapRef.current.on('dragstart', () => {
          onUserDragStart();
        });
      }

      // Add moveend event to fetch new places when user drags map
      if (onMapMoved) {
        mapRef.current.on('moveend', () => {
          const center = mapRef.current!.getCenter();
          onMapMoved(center.lat, center.lng);
        });
      }
    } else {
      mapRef.current.easeTo({ center: [center[1], center[0]], zoom: 14, duration: 800 });
    }
  }, [center, apiKey, onMapClick, onMapReady, onMapMoved, onUserDragStart]);

  // Update markers when locations change
  useEffect(() => {
    if (!mapRef.current || !apiKey) return;

    // Clear old markers
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    // Add user location marker (different style to avoid overlap)
    const userEl = document.createElement('div');
    userEl.style.width = '20px';
    userEl.style.height = '20px';
    userEl.style.borderRadius = '9999px';
    userEl.style.backgroundColor = '#3b82f6';
    userEl.style.border = '3px solid white';
    userEl.style.boxShadow = '0 4px 10px rgba(59, 130, 246, 0.5)';
    userEl.style.zIndex = '10';
    
    const userMarker = new mapboxgl.Marker(userEl)
      .setLngLat([center[1], center[0]])
      .addTo(mapRef.current!);
    
    markersRef.current.push(userMarker);

    // Add location markers
    locations.forEach((location) => {
      const el = document.createElement('div');
      const color = getBusynessColor(location.busyness);
      el.style.width = '28px';
      el.style.height = '28px';
      el.style.borderRadius = '9999px';
      el.style.backgroundColor = color;
      el.style.display = 'flex';
      el.style.alignItems = 'center';
      el.style.justifyContent = 'center';
      el.style.color = 'white';
      el.style.fontSize = '14px';
      el.style.boxShadow = '0 10px 25px rgba(15,23,42,0.35)';
      el.style.border = '2px solid white';
      el.style.cursor = 'pointer';

      el.innerText = location.type === 'cafe' ? '☕' : '📚';

      el.addEventListener('click', () => {
        onLocationClick(location);
        mapRef.current?.easeTo({
          center: [location.lng, location.lat],
          zoom: 14,
          duration: 800,
        });
      });

      const marker = new mapboxgl.Marker(el)
        .setLngLat([location.lng, location.lat])
        .addTo(mapRef.current!);

      markersRef.current.push(marker);
    });
  }, [locations, center, onLocationClick, apiKey]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  if (!apiKey) {
    return (
      <div className="relative h-full w-full flex items-center justify-center bg-muted">
        <div className="text-center px-6 max-w-md">
          <h2 className="text-lg font-semibold text-foreground mb-2">Map preview unavailable</h2>
          <p className="text-sm text-muted-foreground">
            Add your Mapbox public token above to see an interactive map with nearby cafes and libraries.
          </p>
        </div>
      </div>
    );
  }

  return <div ref={mapContainer} className="h-full w-full" />;
};

export default Map;
