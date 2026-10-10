'use client';

import dynamic from 'next/dynamic';
import { motion } from 'motion/react';
import { MapPin } from 'lucide-react';

// Dynamically import map to avoid SSR issues
const CongregationsMap = dynamic(() => import('./CongregationsMap'), { 
  ssr: false,
  loading: () => <div className="h-[520px] w-full bg-surface-200 animate-pulse rounded-2xl flex items-center justify-center text-typography-400 text-sm">Carregando Mapa...</div>
});

interface SecondarySectionProps {
  congregations: any[];
  onEdit?: (cong: any) => void;
}

export default function SecondarySection({ congregations, onEdit }: SecondarySectionProps) {
  const mappedCount = congregations.filter(c => {
    const gps = c.gps?.trim();
    return gps && (gps.includes(',') || gps.includes(' '));
  }).length;

  return (
    <div className="grid grid-cols-1 gap-6">
      <motion.div 
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-surface-100 rounded-2xl p-4 md:p-5 space-y-4 border border-surface-300 shadow-xs"
      >
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary-200/10 flex items-center justify-center text-primary-200">
              <MapPin size={18} />
            </div>
            <h2 className="font-semibold text-base text-typography-900 tracking-tight">Visão Geográfica do Circuito</h2>
          </div>

          <span className="text-xs text-typography-500 font-medium hidden sm:inline">
            {mappedCount} de {congregations.length} mapeadas
          </span>
        </div>
        
        <div className="bg-surface-200/50 p-1.5 rounded-2xl border border-surface-300 overflow-hidden h-[520px]">
          <CongregationsMap congregations={congregations} onEdit={onEdit} />
        </div>

        <div className="flex items-center gap-2 text-xs text-typography-500 bg-surface-200/50 px-3 py-2 rounded-xl border border-surface-300/50">
          <MapPin size={14} className="text-primary-200 shrink-0" />
          <span>
            Mostrando {mappedCount} de {congregations.length} congregações no mapa.
          </span>
        </div>
      </motion.div>
    </div>
  );
}
