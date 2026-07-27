'use client';

import { useState } from 'react';
import { Landmark, Store, Users, ChevronLeft, X, ExternalLink, Loader2, UserCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface EventsViewProps {
  userId: string;
  acceptedCongressInvites?: any[];
  onBack: () => void;
  onViewChange: (view: any) => void;
}

const events = [
  {
    id: 'regional_convention',
    title: 'CONGRESSO REGIONAL',
    color: '#10B981', // Emerald
    gradient: 'from-emerald-500 to-teal-600',
    icon: Landmark,
    inactive: false
  },
  {
    id: 'circuit_assembly_supt',
    title: 'Assembleia com o Viajante',
    color: '#F59E0B', // Amber
    gradient: 'from-amber-500 to-orange-600',
    icon: Store,
    inactive: false
  },
  {
    id: 'circuit_assembly_branch',
    title: 'Assembleia com Representante',
    color: '#F43F5E', // Rose
    gradient: 'from-rose-500 to-pink-600',
    icon: Store,
    inactive: false
  },
  {
    id: 'special_meeting',
    title: 'REUNIÃO ESPECIAL COM OS PIONEIROS E MISSIONÁRIOS',
    color: '#8B5CF6', // Violet
    gradient: 'from-violet-500 to-purple-600',
    icon: Users,
    inactive: true
  },
];

export default function EventsView({ userId, acceptedCongressInvites = [], onBack, onViewChange }: EventsViewProps) {
  const handleEventClick = (event: typeof events[0]) => {
    if (event.inactive) return;
    
    if (event.id === 'regional_convention') {
      onViewChange('regional_convention_program');
    } else if (event.id === 'circuit_assembly_supt') {
      onViewChange('circuit_assembly_supt_program');
    } else if (event.id === 'circuit_assembly_branch') {
      onViewChange('circuit_assembly_branch_program');
    }
  };

  return (
    <div className="space-y-10 pb-20">
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold text-gray-800 tracking-tight">
            Eventos do Circuito
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {events.map((event, index) => (
            <motion.div
              key={event.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              onClick={() => handleEventClick(event)}
              className={`relative group h-20 ${
                event.inactive 
                  ? 'cursor-not-allowed grayscale-[0.8] opacity-60' 
                  : 'cursor-pointer'
              }`}
            >
              {/* Background Glow */}
              {!event.inactive && (
                <div 
                  className="absolute -inset-0.5 blur-md opacity-20 group-hover:opacity-40 transition-opacity duration-500 rounded-2xl"
                  style={{ backgroundColor: event.color }}
                />
              )}
              
              <div className="relative flex bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 hover:border-transparent transition-all duration-300 h-full group">
                <div className={`w-1.5 h-full bg-gradient-to-b ${event.inactive ? 'from-gray-400 to-gray-600' : event.gradient} opacity-40 group-hover:opacity-100 transition-opacity`}></div>
                <div className="flex-1 flex items-center px-4 gap-4">
                  <div 
                    className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-500 shadow-lg shadow-black/5 ${
                      event.inactive 
                        ? 'bg-gray-100 text-gray-400' 
                        : `bg-gradient-to-br ${event.gradient} group-hover:scale-105 group-hover:rotate-2`
                    }`}
                  >
                    <event.icon size={22} strokeWidth={2.5} className={`${event.inactive ? 'text-gray-300' : 'text-white drop-shadow-md'}`} />
                  </div>
                  <div className="text-left flex flex-col justify-center overflow-hidden pr-2">
                    <div className={`font-black text-[10px] md:text-xs leading-tight uppercase mb-0.5 transition-colors ${event.inactive ? 'text-gray-400' : 'text-gray-900 group-hover:text-black'}`}>
                      {event.title}
                    </div>
                    {event.inactive ? (
                      <span className="text-[8px] font-black text-violet-500/60 uppercase tracking-[0.3em] font-mono">
                        Em breve
                      </span>
                    ) : (
                      <span className={`text-[8px] font-bold uppercase tracking-widest ${event.inactive ? 'text-gray-300' : 'text-gray-400'}`}>
                        Ver Programação
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Shared Congresses Section */}
      {acceptedCongressInvites.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <div className="bg-violet-100 p-1.5 rounded-lg text-violet-600">
              <UserCheck size={18} />
            </div>
            <h3 className="text-lg font-bold text-gray-800 tracking-tight">
              Congressos Compartilhados (Assistente)
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {acceptedCongressInvites.map((inv, index) => (
              <motion.div
                key={inv.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                onClick={() => onViewChange(`regional_convention_guest:${inv.ownerId}`)}
                className="relative group h-20 cursor-pointer"
              >
                <div className="absolute -inset-0.5 blur-md opacity-20 group-hover:opacity-40 transition-opacity duration-500 rounded-2xl bg-violet-500" />
                
                <div className="relative flex bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 hover:border-transparent transition-all duration-300 h-full group">
                  <div className="w-1.5 h-full bg-gradient-to-b from-violet-500 to-purple-600 opacity-40 group-hover:opacity-100 transition-opacity"></div>
                  <div className="flex-1 flex items-center px-4 gap-4">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-500 shadow-lg shadow-black/5 bg-gradient-to-br from-violet-500 to-purple-600 group-hover:scale-105 group-hover:rotate-2">
                      <Landmark size={22} strokeWidth={2.5} className="text-white drop-shadow-md" />
                    </div>
                    <div className="text-left flex flex-col justify-center overflow-hidden pr-2">
                      <div className="font-black text-[10px] md:text-xs leading-tight uppercase mb-0.5 text-gray-900 group-hover:text-black">
                        Congresso de: {inv.ownerName}
                      </div>
                      <span className="text-[8px] font-bold uppercase tracking-widest text-violet-500">
                        Acesso Assistente
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
