'use client';

import dynamic from 'next/dynamic';
import { MapPin } from 'lucide-react';

// Dynamically import map to avoid SSR issues
const CongregationsMap = dynamic(() => import('./CongregationsMap'), { 
  ssr: false,
  loading: () => <div className="h-[300px] w-full bg-gray-100 animate-pulse rounded-xl flex items-center justify-center text-gray-400">Carregando Mapa...</div>
});

interface SecondarySectionProps {
  congregations: any[];
  onEdit?: (cong: any) => void;
}

export default function SecondarySection({ congregations, onEdit }: SecondarySectionProps) {
  return (
    <div className="grid grid-cols-1 gap-6">
      {/* Map Section replacing Activity Feed */}
      <div className="bg-white/50 rounded-2xl p-4 md:p-6 space-y-4 border border-white/20">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <MapPin className="text-[#E67E22]" size={20} />
            <h5 className="font-headline font-bold text-lg">Visão Geográfica do Circuito</h5>
          </div>
          <div className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
            {congregations.filter(c => c.gps).length} Congregações Mapeadas
          </div>
        </div>
        
        <div className="bg-white p-1 rounded-xl shadow-sm border border-gray-100 overflow-hidden h-[600px]">
          <div className="h-full w-full rounded-lg overflow-hidden">
            <CongregationsMap congregations={congregations} onEdit={onEdit} />
          </div>
        </div>
      </div>
    </div>
  );
}
