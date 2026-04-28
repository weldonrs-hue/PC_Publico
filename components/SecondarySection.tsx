'use client';

import dynamic from 'next/dynamic';
import { motion } from 'motion/react';
import { MapPin } from 'lucide-react';

// Dynamically import map to avoid SSR issues
const CongregationsMap = dynamic(() => import('./CongregationsMap'), { 
  ssr: false,
  loading: () => <div className="h-[600px] w-full bg-gray-100 animate-pulse rounded-xl flex items-center justify-center text-gray-400">Carregando Mapa...</div>
});

interface SecondarySectionProps {
  congregations: any[];
  onEdit?: (cong: any) => void;
}

export default function SecondarySection({ congregations, onEdit }: SecondarySectionProps) {
  return (
    <div className="grid grid-cols-1 gap-6">
      {/* Map Section replacing Activity Feed */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white/50 rounded-2xl p-4 md:p-6 space-y-4 border border-white/20"
      >
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <MapPin className="text-violet-600" size={20} />
            <h5 className="font-headline font-bold text-lg text-gray-800 tracking-tight">Visão Geográfica do Circuito</h5>
          </div>
        </div>
        
        <div className="bg-white p-2 rounded-3xl shadow-sm border border-gray-100 h-[600px] hover:shadow-lg transition-shadow duration-500">
          <CongregationsMap congregations={congregations} onEdit={onEdit} />
        </div>

        <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50/80 backdrop-blur-sm p-3 rounded-2xl border border-gray-100/50">
          <MapPin size={14} className="text-violet-500" />
          <span>
            Mostrando {
              congregations.filter(c => {
                const gps = c.gps?.trim();
                return gps && (gps.includes(',') || gps.includes(' '));
              }).length
            } de {congregations.length} congregações no mapa.
          </span>
        </div>
      </motion.div>
    </div>
  );
}
