'use client';

import { useEffect, useState, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
// CSS is already imported in globals.css
import { Maximize, Navigation } from 'lucide-react';

// Fix for Leaflet marker icons in Next.js
const DefaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

interface Congregation {
  id: string;
  nome: string;
  numero: string;
  gps?: string;
  cidade: string;
  estado: string;
  endereco: string;
}

interface CongregationsMapProps {
  congregations: any[];
  onEdit?: (cong: any) => void;
}

// Helper to parse GPS coordinates from string
const parseGPS = (gpsStr?: string): [number, number] | null => {
  if (!gpsStr) return null;
  
  let clean = gpsStr.replace(/[^0-9.,\s-]/g, '').trim().replace(/\s+/g, ' ');
  
  let parts: string[] = [];
  if (clean.includes(',')) {
    parts = clean.split(',').map(p => p.trim());
  } else if (clean.includes(' ')) {
    parts = clean.split(' ').map(p => p.trim());
  }
  
  if (parts.length >= 2) {
    const numbers = parts.map(p => parseFloat(p)).filter(n => !isNaN(n));
    if (numbers.length >= 2) {
      return [numbers[0], numbers[1]];
    }
  }
  return null;
};

// Component to handle map centering and bounds
function MapControls({ congregations }: { congregations: any[] }) {
  const map = useMap();

  const handleResetView = useCallback(() => {
    if (!congregations || congregations.length === 0 || !map) return;

    const validPoints = congregations
      .map(c => c.coords)
      .filter(p => p !== null) as [number, number][];

    if (validPoints.length > 0) {
      try {
        const bounds = L.latLngBounds(validPoints);
        // Disable animation to prevent '_leaflet_pos' errors during rapid updates or unmounting
        map.fitBounds(bounds, { 
          padding: [50, 50],
          maxZoom: 15,
          animate: false
        });
      } catch (err) {
        console.warn('Error fitting map bounds:', err);
      }
    }
  }, [congregations, map]);

  useEffect(() => {
    if (!congregations || congregations.length === 0 || !map) return;

    const timer = setTimeout(() => {
      if (map) {
        map.invalidateSize();
        handleResetView();
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [congregations.length, map, handleResetView, congregations]);

  return (
    <div className="leaflet-top leaflet-right" style={{ marginTop: '80px', marginRight: '10px' }}>
      <div className="leaflet-control leaflet-bar">
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleResetView();
          }}
          className="bg-white hover:bg-gray-100 text-gray-700 w-[34px] h-[34px] flex items-center justify-center transition-colors shadow-md border-none rounded-sm"
          title="Centralizar Visualização"
          type="button"
        >
          <Maximize size={18} />
        </button>
      </div>
    </div>
  );
}

export default function CongregationsMap({ congregations, onEdit }: CongregationsMapProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMounted(true);
  }, []);

  if (!isMounted) return <div className="h-full w-full bg-gray-100 animate-pulse rounded-xl" />;

  const validCongregations = congregations.map(c => ({
    ...c,
    coords: parseGPS(c.gps)
  })).filter(c => c.coords !== null) as (Congregation & { coords: [number, number] })[];

  const defaultCenter: [number, number] = [-14.235, -51.9253];

  return (
    <div className="h-full w-full rounded-xl overflow-hidden relative">
      <MapContainer 
        center={defaultCenter} 
        zoom={4} 
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={true}
        doubleClickZoom={true}
        dragging={true}
        zoomControl={true}
        touchZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {validCongregations.map((cong) => {
          return (
            <Marker key={cong.id} position={cong.coords}>
              <Popup>
                <div className="p-1 space-y-2 min-w-[150px]">
                  <h3 className="font-bold text-gray-900 border-b border-gray-100 pb-1">{cong.nome}</h3>
                  <div className="text-xs text-gray-600 space-y-1">
                    <p><strong>Nº:</strong> {cong.numero}</p>
                    <p><strong>Cidade:</strong> {cong.cidade} - {cong.estado}</p>
                    <p className="truncate"><strong>Endereço:</strong> {cong.endereco}</p>
                  </div>
                  <div className="grid grid-cols-1 gap-2 mt-2">
                    {onEdit && (
                      <button 
                        onClick={() => onEdit(cong)}
                        className="w-full py-2 bg-amber-600 text-white text-[10px] font-bold rounded-lg hover:bg-amber-700 transition-colors shadow-sm"
                      >
                        Editar Detalhes
                      </button>
                    )}
                    <button 
                      onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${cong.coords[0]},${cong.coords[1]}`, '_blank')}
                      className="w-full py-2 bg-blue-600 text-white text-[10px] font-bold rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-1 shadow-sm"
                    >
                      <Navigation size={12} />
                      Como Chegar
                    </button>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
        
        <MapControls congregations={validCongregations} />
      </MapContainer>
    </div>
  );
}
