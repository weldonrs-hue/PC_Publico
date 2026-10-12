'use client';

import { useEffect, useState, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Tooltip } from 'react-leaflet';
import L from 'leaflet';
// CSS is already imported in globals.css
import { Maximize, Navigation, Type } from 'lucide-react';

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

// Paleta de cores vibrantes e contrastantes para cada congregação
const PIN_COLORS = [
  '#2563eb', // Azul Real
  '#dc2626', // Vermelho
  '#16a34a', // Verde Esmeralda
  '#d97706', // Âmbar / Laranja
  '#7c3aed', // Roxo Violeta
  '#0891b2', // Ciano / Azul Petróleo
  '#db2777', // Rosa Magenta
  '#4f46e5', // Índigo
  '#059669', // Verde Mar
  '#ea580c', // Laranja Queimado
  '#9333ea', // Roxo Forte
  '#0284c7', // Azul Claro Céu
  '#e11d48', // Carmim
  '#65a30d', // Lima
  '#475569', // Ardósia
];

// Gera um hash estável a partir do ID ou Nome da congregação para que a cor nunca mude entre renders
const getCongregationColor = (cong: { id?: string; nome?: string }, index: number): string => {
  if (index < PIN_COLORS.length) {
    return PIN_COLORS[index];
  }
  const str = cong.id || cong.nome || `${index}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colorIndex = Math.abs(hash) % PIN_COLORS.length;
  return PIN_COLORS[colorIndex];
};

// Cria um marcador SVG personalizado do Leaflet com a cor específica da congregação
// Se houver mais de uma congregação no mesmo local, exibe um badge indicando a quantidade
const createColorPinIcon = (color: string, count: number = 1) => {
  const badgeHtml = count > 1 ? `
    <span style="position: absolute; top: -4px; right: -6px; background-color: #1e293b; color: #ffffff; font-size: 10px; font-weight: 800; border-radius: 9999px; min-width: 17px; height: 17px; display: flex; align-items: center; justify-content: center; padding: 0 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.4); border: 1.5px solid #ffffff;">
      ${count}
    </span>
  ` : '';

  return L.divIcon({
    className: 'custom-colored-pin',
    html: `
      <div style="position: relative; width: 30px; height: 42px; display: flex; align-items: center; justify-content: center; filter: drop-shadow(0 3px 5px rgba(0,0,0,0.35)); transition: transform 0.2s;">
        <svg viewBox="0 0 24 34" width="30" height="42" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 0C5.372 0 0 5.372 0 12c0 9.25 10.45 20.9 10.9 21.4.28.31.69.49 1.1.49s.82-.18 1.1-.49C13.55 32.9 24 21.25 24 12 24 5.372 18.628 0 12 0z" fill="${color}" stroke="#ffffff" stroke-width="1.5"/>
          <circle cx="12" cy="11.5" r="4.5" fill="#ffffff" />
          <circle cx="12" cy="11.5" r="2.5" fill="${color}" />
        </svg>
        ${badgeHtml}
      </div>
    `,
    iconSize: [30, 42],
    iconAnchor: [15, 42],
    popupAnchor: [0, -38],
  });
};

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
function MapControls({ congregations, showNames, setShowNames }: { congregations: any[], showNames: boolean, setShowNames: (v: boolean) => void }) {
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
    <div className="leaflet-top leaflet-right !m-2.5">
      <div className="leaflet-bar leaflet-control shadow-md border border-surface-300 dark:border-surface-600 rounded-[4px] overflow-hidden bg-surface-100 dark:bg-surface-800">
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleResetView();
          }}
          className="w-[30px] h-[30px] sm:w-[34px] sm:h-[34px] flex items-center justify-center bg-surface-100 dark:bg-surface-800 hover:bg-surface-200 dark:hover:bg-surface-700 text-typography-700 dark:text-typography-200 transition-colors border-b border-surface-300 dark:border-surface-600 cursor-pointer"
          title="Centralizar Visualização"
          type="button"
          aria-label="Centralizar Visualização"
        >
          <Maximize size={16} />
        </button>

        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setShowNames(!showNames);
          }}
          className={`w-[30px] h-[30px] sm:w-[34px] sm:h-[34px] flex items-center justify-center transition-colors cursor-pointer ${
            showNames 
              ? 'bg-primary-200 text-white hover:bg-primary-150' 
              : 'bg-surface-100 dark:bg-surface-800 hover:bg-surface-200 dark:hover:bg-surface-700 text-typography-700 dark:text-typography-200'
          }`}
          title={showNames ? "Ocultar Nomes" : "Mostrar Nomes"}
          type="button"
          aria-label={showNames ? "Ocultar Nomes" : "Mostrar Nomes"}
        >
          <Type size={16} />
        </button>
      </div>
    </div>
  );
}

export default function CongregationsMap({ congregations, onEdit }: CongregationsMapProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [showNames, setShowNames] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMounted(true);
  }, []);

  if (!isMounted) return <div className="h-full w-full bg-surface-200 animate-pulse rounded-xl" />;

  // Agrupa congregações com as mesmas coordenadas exatas (ex: congregações que usam o mesmo Salão do Reino)
  // para exibir um único pino com os nomes empilhados um abaixo do outro
  const validCongregations = congregations.map(c => ({
    ...c,
    rawCoords: parseGPS(c.gps)
  })).filter(c => c.rawCoords !== null) as (Congregation & { rawCoords: [number, number] })[];

  // Agrupa por coordenadas arredondadas em ~1 metro (5 casas decimais)
  const groupedLocations = validCongregations.reduce((acc, cong, originalIndex) => {
    const key = `${cong.rawCoords[0].toFixed(5)},${cong.rawCoords[1].toFixed(5)}`;
    const color = getCongregationColor(cong, originalIndex);
    const congWithColor = { ...cong, color, originalIndex };

    if (!acc[key]) {
      acc[key] = {
        key,
        coords: cong.rawCoords,
        congregations: [congWithColor],
        primaryColor: color,
      };
    } else {
      acc[key].congregations.push(congWithColor);
    }
    return acc;
  }, {} as { [key: string]: { key: string; coords: [number, number]; congregations: (Congregation & { rawCoords: [number, number]; color: string; originalIndex: number })[]; primaryColor: string } });

  const locationList = Object.values(groupedLocations);

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
        
        {locationList.map((location) => {
          const count = location.congregations.length;
          const pinIcon = createColorPinIcon(location.primaryColor, count);

          return (
            <Marker key={location.key} position={location.coords} icon={pinIcon}>
              {showNames && (
                <Tooltip permanent direction="top" offset={[0, -38]} opacity={1}>
                  <div className="flex flex-col gap-1 py-0.5 max-w-[200px]">
                    {location.congregations.map((c) => (
                      <span 
                        key={c.id}
                        className="font-bold uppercase tracking-tight text-[10px] px-1.5 py-0.5 rounded shadow-sm border border-black/10 bg-surface-100 dark:bg-surface-800 whitespace-nowrap overflow-hidden text-ellipsis"
                        style={{ color: c.color }}
                      >
                        {c.nome}
                      </span>
                    ))}
                  </div>
                </Tooltip>
              )}
              <Popup>
                <div className="p-1 space-y-2.5 min-w-[200px] max-w-[270px]">
                  {count > 1 && (
                    <div className="text-[11px] font-semibold text-primary-200 uppercase tracking-wider pb-1 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                      <span>{count} Congregações neste local</span>
                    </div>
                  )}

                  {location.congregations.map((cong, idx) => (
                    <div 
                      key={cong.id} 
                      className={`space-y-1.5 ${idx > 0 ? 'pt-2.5 border-t border-dashed border-gray-200 dark:border-gray-700' : ''}`}
                    >
                      <div className="flex items-center gap-2">
                        <span 
                          className="w-3 h-3 rounded-full shrink-0 shadow-xs" 
                          style={{ backgroundColor: cong.color }} 
                        />
                        <h3 className="font-bold text-gray-900 dark:text-gray-100 text-sm leading-tight truncate">
                          {cong.nome}
                        </h3>
                      </div>
                      
                      <div className="text-xs text-gray-600 dark:text-gray-300 space-y-0.5 pl-5">
                        <p><strong>Nº:</strong> {cong.numero} • <strong>Parte:</strong> {cong.parte}</p>
                        <p className="truncate"><strong>Endereço:</strong> {cong.endereco}</p>
                        <p><strong>Cidade:</strong> {cong.cidade} - {cong.estado}</p>
                      </div>

                      {onEdit && (
                        <div className="pl-5 pt-1">
                          <button 
                            onClick={() => onEdit(cong)}
                            className="w-full py-1.5 bg-surface-200 hover:bg-surface-300 dark:bg-surface-700 dark:hover:bg-surface-600 text-typography-800 dark:text-typography-100 text-[10px] font-bold rounded-md transition-colors shadow-xs cursor-pointer flex items-center justify-center gap-1 border border-surface-300 dark:border-surface-600"
                          >
                            Editar Detalhes de {cong.nome}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}

                  <div className="pt-1">
                    <button 
                      onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${location.coords[0]},${location.coords[1]}`, '_blank')}
                      className="w-full py-2 bg-sky-600 text-white text-[10px] font-bold rounded-lg hover:bg-sky-700 transition-colors flex items-center justify-center gap-1 shadow-sm cursor-pointer"
                    >
                      <Navigation size={12} />
                      Como Chegar ao Local
                    </button>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
        
        <MapControls 
          congregations={locationList.map(l => ({ coords: l.coords }))} 
          showNames={showNames} 
          setShowNames={setShowNames} 
        />
      </MapContainer>
    </div>
  );
}
