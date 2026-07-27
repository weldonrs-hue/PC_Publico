'use client';

import { Contact, Store, UserRound, Map, BarChart3, ClipboardList, Mail, UserCheck } from 'lucide-react';
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
  hasPendingInvites?: boolean;
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
  hasGuestInvites = false,
  hasPendingInvites = false
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
    <div className="flex flex-col gap-6">
      {hasPendingInvites && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          onClick={() => onCardClick?.('Ajustes')}
          className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-[2rem] p-6 text-white shadow-xl shadow-emerald-500/20 cursor-pointer flex items-center justify-between group overflow-hidden relative"
        >
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
             <UserCheck size={120} />
          </div>
          <div className="relative z-10 flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center animate-pulse">
              <Mail size={24} />
            </div>
            <div>
              <h3 className="font-black text-base uppercase tracking-tight">Convite Pendente!</h3>
              <p className="text-white/80 text-[10px] font-bold uppercase tracking-widest">Você recebeu um novo acesso. Clique para aceitar.</p>
            </div>
          </div>
          <div className="relative z-10 bg-white text-emerald-600 px-4 py-2 rounded-lg font-black text-[10px] uppercase tracking-widest shadow-lg active:scale-95 transition-all">
            Ver Agora
          </div>
        </motion.div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
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
            className="absolute -inset-0.5 blur-md opacity-20 group-hover:opacity-40 transition-opacity duration-500 rounded-2xl"
            style={{ backgroundColor: card.color }}
          />
          
          <div className="relative flex bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 hover:border-transparent transition-all duration-300 h-20 group">
            {/* Vibrant Vertical Accent */}
            <div className={`w-1.5 h-full bg-gradient-to-b ${card.gradient}`}></div>
            
            <div className="flex-1 flex items-center px-4 gap-4">
              <div 
                className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-500 group-hover:scale-105 group-hover:rotate-2 shadow-lg shadow-black/5 bg-gradient-to-br ${card.gradient}`}
              >
                <card.icon size={22} strokeWidth={2.5} className="text-white drop-shadow-md" />
              </div>

              <div className="text-left flex flex-col justify-center overflow-hidden pr-2">
                <div className="font-black text-xs md:text-sm leading-tight text-gray-900 uppercase truncate mb-0.5 group-hover:text-black transition-colors">
                  {card.title === 'Congregações' && isPioneer ? 'Congregação' : card.title}
                </div>
                
                <div className="flex flex-col">
                  {card.title === 'Congregações' ? (
                    <div className="flex gap-2">
                      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">
                        {isPioneer ? 'SUA CONGREGAÇÃO' : `CONG: ${congregationCount}`}
                      </p>
                      {!isPioneer && (
                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">
                          GRUPOS: <span className="text-amber-600 font-black">{groupCount}</span>
                        </p>
                      )}
                    </div>
                  ) : card.title === 'Dados Pessoais' ? (
                    <div className="flex flex-col">
                      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wide truncate">
                        {personalData?.nome || user?.usuario || 'usuário'}
                      </p>
                      {user?.role === 'admin' && (
                        <p className="inline-block self-start text-[8px] font-black text-emerald-500 tracking-widest uppercase mt-0.5">Admin</p>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400 font-bold text-[9px] uppercase truncate">
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
    </div>
  );
}
