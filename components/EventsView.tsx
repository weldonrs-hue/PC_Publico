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
    color: '#7C3AED',
    icon: Landmark,
    inactive: false
  },
  {
    id: 'circuit_assembly_supt',
    title: 'ASSEMBLEIA DE CIRCUITO COM O SUPERINTENDENTE',
    color: '#8B5CF6',
    icon: Store,
    inactive: true
  },
  {
    id: 'circuit_assembly_branch',
    title: 'ASSEMBLEIA DE CIRCUITO COM REPRESENTANTE DE BETEL',
    color: '#A78BFA',
    icon: Store,
    inactive: true
  },
  {
    id: 'special_meeting',
    title: 'REUNIÃO ESPECIAL COM OS PIONEIROS E MISSIONÁRIOS',
    color: '#6D28D9',
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
        <h2 className="text-2xl font-bold text-gray-800 tracking-tight">
          Eventos do Circuito
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {events.map((event, index) => (
          <motion.div
            key={event.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            onClick={() => handleEventClick(event)}
            className={`relative group h-28 ${
              event.inactive 
                ? 'cursor-not-allowed grayscale-[0.5] opacity-60' 
                : 'cursor-pointer'
            }`}
          >
            {/* Background Glow */}
            {!event.inactive && (
              <div 
                className="absolute inset-0 blur-xl opacity-0 group-hover:opacity-10 transition-opacity duration-500 rounded-3xl"
                style={{ backgroundColor: event.color }}
              />
            )}
            
            <div className="relative flex bg-white/80 backdrop-blur-sm rounded-3xl overflow-hidden shadow-sm border border-white hover:border-violet-100 hover:bg-white transition-all duration-300 h-full group">
              <div className="w-1.5 h-full opacity-30 group-hover:opacity-100 transition-opacity" style={{ backgroundColor: event.inactive ? '#9ca3af' : event.color }}></div>
              <div className="flex-1 flex items-center px-6 gap-6">
                <div 
                  className="w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300 group-hover:scale-105"
                  style={{ backgroundColor: `${event.color}10`, color: event.inactive ? '#9ca3af' : event.color }}
                >
                  <event.icon size={26} strokeWidth={2.5} />
                </div>
                <div className="text-left flex flex-col justify-center overflow-hidden">
                  <div className="font-black text-[11px] leading-tight tracking-[0.05em] uppercase text-gray-800">
                    {event.title}
                  </div>
                  {event.inactive && (
                    <span className="text-[9px] font-black text-gray-400 mt-2 uppercase tracking-[0.2em]">
                      Em breve
                    </span>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
