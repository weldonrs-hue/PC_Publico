'use client';

import { useState } from 'react';
import { Landmark, Store, Users, ChevronLeft, X, ExternalLink, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface EventsViewProps {
  userId: string;
  onBack: () => void;
  onViewChange: (view: any) => void;
}

const events = [
  {
    id: 'regional_convention',
    title: 'CONGRESSO REGIONAL',
    color: '#4CAF50',
    icon: Landmark,
    inactive: false
  },
  {
    id: 'circuit_assembly_supt',
    title: 'ASSEMBLEIA DE CIRCUITO COM O SUPERINTENDENTE',
    color: '#E67E22',
    icon: Store,
    inactive: true
  },
  {
    id: 'circuit_assembly_branch',
    title: 'ASSEMBLEIA DE CIRCUITO COM REPRESENTANTE DE BETEL',
    color: '#C2185B',
    icon: Store,
    inactive: true
  },
  {
    id: 'special_meeting',
    title: 'REUNIÃO ESPECIAL COM OS PIONEIROS E MISSIONÁRIOS',
    color: '#6A1B9A',
    icon: Users,
    inactive: true
  },
];

export default function EventsView({ userId, onBack, onViewChange }: EventsViewProps) {
  const handleEventClick = (event: typeof events[0]) => {
    if (!event.inactive && event.id === 'regional_convention') {
      onViewChange('regional_convention_program');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-800">
          Eventos do Circuito
        </h2>
      </div>

      <div className="grid grid-cols-1 landscape:grid-cols-2 md:grid-cols-2 gap-6">
        {events.map((event, index) => (
          <motion.div
            key={event.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            onClick={() => handleEventClick(event)}
            className={`flex bg-white rounded-2xl overflow-hidden shadow-sm transition-all h-24 border border-gray-100 group ${
              event.inactive 
                ? 'cursor-not-allowed grayscale opacity-50' 
                : 'hover:shadow-md cursor-pointer'
            }`}
          >
            <div className="w-4 h-full flex-shrink-0" style={{ backgroundColor: event.inactive ? '#9ca3af' : event.color }}></div>
            <div className="flex-1 flex items-center px-6 gap-6">
              <div className={`transition-transform flex-shrink-0 ${!event.inactive && 'group-hover:scale-110'}`} style={{ color: event.inactive ? '#9ca3af' : event.color }}>
                <event.icon size={32} />
              </div>
              <div className="text-left flex flex-col justify-center overflow-hidden">
                <div className="font-extrabold text-sm leading-tight tracking-wider uppercase" style={{ color: event.inactive ? '#9ca3af' : event.color }}>
                  {event.title}
                </div>
                {event.inactive && (
                  <span className="text-[10px] font-bold text-gray-400 mt-1 uppercase tracking-widest">
                    Em breve
                  </span>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
