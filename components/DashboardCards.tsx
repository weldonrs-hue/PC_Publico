'use client';

import { Contact, Store, UserRound, Map, BarChart3, ClipboardList } from 'lucide-react';
import { motion } from 'motion/react';

const cards = [
  {
    title: 'Dados Pessoais',
    color: '#7C3AED', // Violet
    icon: Contact,
  },
  {
    title: 'Congregações',
    color: '#8B5CF6', // Indigo
    icon: Store,
  },
  {
    title: 'Substitutos',
    color: '#A78BFA', // Soft Purple
    icon: UserRound,
  },
  {
    title: 'Itinerários',
    color: '#6D28D9', // Deep Purple
    icon: Map,
  },
  {
    title: 'Estatísticas',
    color: '#4C1D95', // Darker Purple
    icon: BarChart3,
  },
];

interface DashboardCardsProps {
  onCardClick?: (title: string) => void;
  congregationCount?: number;
  groupCount?: number;
  substituteCount?: number;
  analyzedCongregationsCount?: number;
  currentEvent?: string;
  user?: any;
}

export default function DashboardCards({ 
  onCardClick, 
  congregationCount = 0, 
  groupCount = 0,
  substituteCount = 0,
  analyzedCongregationsCount = 0,
  currentEvent = '',
  user
}: DashboardCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
      {cards.map((card, index) => (
        <motion.div
          key={card.title}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
          onClick={() => onCardClick?.(card.title)}
          className="relative group cursor-pointer"
        >
          {/* Background Glow */}
          <div 
            className="absolute inset-0 blur-xl opacity-0 group-hover:opacity-15 transition-opacity duration-500 rounded-3xl"
            style={{ backgroundColor: card.color }}
          />
          
          <div className="relative flex bg-white/80 backdrop-blur-sm rounded-3xl overflow-hidden shadow-sm border border-white/50 hover:border-violet-200/50 hover:bg-white transition-all duration-300 h-28 group">
            {/* Accent Line */}
            <div className="w-1.5 h-full opacity-40 group-hover:opacity-100 transition-opacity" style={{ backgroundColor: card.color }}></div>
            
            <div className="flex-1 flex items-center px-6 gap-5">
              <div 
                className="w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:rotate-3 shadow-inner"
                style={{ backgroundColor: `${card.color}15`, color: card.color }}
              >
                <card.icon size={28} strokeWidth={2.5} />
              </div>

              <div className="text-left flex flex-col justify-center overflow-hidden">
                <div className="font-black text-xs leading-none tracking-[0.15em] uppercase truncate mb-2 opacity-60 group-hover:opacity-100 transition-opacity">
                  {card.title}
                </div>
                
                <div className="flex flex-col">
                  {card.title === 'Congregações' ? (
                    <div className="space-y-0.5">
                      <p className="text-[11px] font-bold text-gray-700 leading-none">
                        CONG: <span className="text-violet-600">{congregationCount}</span>
                      </p>
                      <p className="text-[11px] font-bold text-gray-700 leading-none">
                        GRUPOS: <span className="text-violet-600">{groupCount}</span>
                      </p>
                    </div>
                  ) : card.title === 'Dados Pessoais' ? (
                    <div className="space-y-0.5">
                      <p className="text-[11px] font-bold text-gray-700 truncate leading-none">
                        {user?.usuario || 'usuário'}
                      </p>
                      {user?.role === 'admin' && (
                        <p className="text-[9px] text-violet-500 font-extrabold tracking-widest uppercase">Admin</p>
                      )}
                    </div>
                  ) : (
                    <div className="text-[11px] font-bold text-gray-700 leading-none">
                      <span className="opacity-50 uppercase text-[9px] block mb-0.5">
                        {card.title === 'Itinerários' ? 'EVENTO ATUAL' : 'TOTAL'}
                      </span>
                      <span className="text-violet-600 truncate block">
                        {card.title === 'Substitutos' ? `${substituteCount} Registrados` : 
                         card.title === 'Itinerários' ? (currentEvent || 'Nenhum evento') : 
                         card.title === 'Estatísticas' ? `${analyzedCongregationsCount} Analisadas` : ''}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
