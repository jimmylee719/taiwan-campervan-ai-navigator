import React, { useEffect, useRef } from 'react';
import { Poi, Waypoint } from '../types';

// Declare the Leaflet global object, which is loaded from a script in index.html
declare var L: any;

interface MapComponentProps {
  waypoints: Waypoint[];
  pois: Poi[];
}

export const MapComponent: React.FC<MapComponentProps> = ({ waypoints, pois }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const featureLayer = useRef<any>(null); // To hold markers and polylines

  // Initialize map
  useEffect(() => {
    if (mapRef.current && !mapInstance.current) {
      mapInstance.current = L.map(mapRef.current, {
          center: [23.9, 121.5],
          zoom: 7,
          zoomControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(mapInstance.current);

      featureLayer.current = L.layerGroup().addTo(mapInstance.current);
    }
  }, []);

  // Update map when waypoints or POIs change
  useEffect(() => {
    if (!mapInstance.current || !featureLayer.current) return;

    // Clear previous features
    featureLayer.current.clearLayers();

    const hasWaypoints = waypoints.length >= 2;
    const hasPois = pois.length > 0;

    if (!hasWaypoints && !hasPois) {
      // Reset map view if there's nothing to show
      mapInstance.current.setView([23.9, 121.5], 7);
      return;
    }

    const bounds = L.latLngBounds([]);

    // Add POI markers
    pois.forEach(poi => {
      if (poi.lat && poi.lng) {
        const latLng: [number, number] = [poi.lat, poi.lng];
        const marker = L.marker(latLng).addTo(featureLayer.current);
        marker.bindPopup(`<b>${poi.name}</b><br>${poi.address}`);
        bounds.extend(latLng);
      }
    });
    
    // Add waypoint polyline
    if (waypoints.length >= 2) {
      const waypointCoords = waypoints.map(wp => [wp.lat, wp.lng] as [number, number]);
      L.polyline(waypointCoords, { color: '#1a73e8', weight: 5 }).addTo(featureLayer.current);
      // Extend bounds to include waypoints as well
      waypointCoords.forEach(coord => bounds.extend(coord));
    }

    // Fit map to show all features
    if (bounds.isValid()) {
      mapInstance.current.fitBounds(bounds, { padding: [50, 50] });
    }

  }, [waypoints, pois]);


  return <div ref={mapRef} className="w-full h-full" />;
};
