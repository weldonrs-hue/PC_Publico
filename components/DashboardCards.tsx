'use client';

import { Contact, Store, UserRound, Map, BarChart3, ClipboardList } from 'lucide-react';
import { motion } from 'motion/react';

const cards = [
  {
    title: 'Dados Pessoais',
    color: '#10B981', // Emerald
    gradient: 'from-emerald-500 to-teal-600',
    icon: Contact,
  },
  {
    title: 'Congregações',
    color: '#F59E0B', // Amber
    gradient: 'from-amber-500 to-orange-600',
    icon: Store,
  },
  {
    title: 'Substitutos',
    color: '#F43F5E', // Rose
    gradient: 'from-rose-500 to-pink-600',
    icon: UserRound,
  },
  {
    title: 'Itinerários',
    color: '#8B5CF6', // Violet
    gradient: 'from-violet-500 to-purple-600',
    icon: Map,
  },
  {
    title: 'Estatísticas',
    color: '#0EA5E9', // Sky
    gradient: 'from-sky-500 to-blue-600',
    icon: BarChart3,
  },
  {
    title: 'Estatísticas Cong.',
    color: '#6366F1', // Indigo
    gradient: 'from-indigo-500 to-blue-700',
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
  personalData?: any;
  hasGuestInvites?: boolean;
}

export default function DashboardCards({ 
  onCardClick, 
  congregationCount = 0, 
  groupCount = 0,
  substituteCount = 0,
  analyzedCongregationsCount = 0,
  currentEvent = '',
  user,
  personalData,
  hasGuestInvites = false
}: DashboardCardsProps) {
  const role = personalData?.role || 'viajante';
  const isPioneer = role === 'pioneiro_especial' || role === 'pioneiro_regular';

  const filteredCards = cards.filter(card => {
    if (isPioneer) {
      // For pioneers, within "Circuito" dashboard:
      // Only "Dados Pessoais" and "Congregações"
      if (['Substitutos', 'Itinerários', 'Estatísticas', 'Estatísticas Cong.'].includes(card.title)) return false;
    }
    return true;
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
      {filteredCards.map((card, index) => (
        <motion.div
          key={card.title}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
          onClick={() => onCardClick?.(card.title)}
          className="relative group cursor-pointer"
        >
          {/* Static Background Glow for better presence */}
          <div 
            className="absolute -inset-0.5 blur-md opacity-20 group-hover:opacity-40 transition-opacity duration-500 rounded-[2rem]"
            style={{ backgroundColor: card.color }}
          />
          
          <div className="relative flex bg-white rounded-3xl overflow-hidden shadow-lg border border-gray-100 hover:border-transparent transition-all duration-300 h-28 group">
            {/* Vibrant Vertical Accent */}
            <div className={`w-2 h-full bg-gradient-to-b ${card.gradient}`}></div>
            
            <div className="flex-1 flex items-center px-6 gap-5">
              <div 
                className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-500 group-hover:scale-110 group-hover:rotate-3 shadow-lg shadow-black/5 bg-gradient-to-br ${card.gradient}`}
              >
                <card.icon size={30} strokeWidth={2.5} className="text-white drop-shadow-md" />
              </div>

              <div className="text-left flex flex-col justify-center overflow-hidden pr-2">
                <div className="font-black text-sm md:text-base leading-tight text-gray-900 uppercase truncate mb-1 group-hover:text-black transition-colors">
                  {card.title === 'Congregações' && isPioneer ? 'Congregação' : card.title}
                </div>
                
                <div className="flex flex-col">
                  {card.title === 'Congregações' ? (
                    <div className="flex gap-3">
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter">
                        {isPioneer ? 'SUA CONGREGAÇÃO' : `CONG: ${congregationCount}`}
                      </p>
                      {!isPioneer && (
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter">
                          GRUPOS: <span className="text-amber-600 font-black">{groupCount}</span>
                        </p>
                      )}
                    </div>
                  ) : card.title === 'Dados Pessoais' ? (
                    <div className="flex flex-col">
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide truncate">
                        {user?.usuario || 'usuário'}
                      </p>
                      {user?.role === 'admin' && (
                        <p className="inline-block self-start text-[8px] font-black text-emerald-600 tracking-widest uppercase mt-0.5">Administrador</p>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-gray-800 font-bold text-[10px] uppercase truncate">
                        {card.title === 'Substitutos' ? `${substituteCount} Ativos` : 
                         card.title === 'Itinerários' ? (currentEvent || 'Nenhum planejado') : 
                         card.title === 'Estatísticas' ? `${analyzedCongregationsCount} Analisadas` :
                         card.title === 'Estatísticas Cong.' ? 'Últimas 4 Visitas' : ''}
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
