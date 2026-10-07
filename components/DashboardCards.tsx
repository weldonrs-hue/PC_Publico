'use client';

import { Contact, Store, UserRound, Map, BarChart3, ChevronRight, Mail } from 'lucide-react';
import { motion } from 'motion/react';

const cards = [
  {
    title: 'Dados Pessoais',
    lineColor: 'bg-emerald-500',
    iconBorder: 'border-emerald-500/40 dark:border-emerald-400/50',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    icon: Contact,
  },
  {
    title: 'Congregações',
    lineColor: 'bg-amber-500',
    iconBorder: 'border-amber-500/40 dark:border-amber-400/50',
    iconColor: 'text-amber-600 dark:text-amber-400',
    icon: Store,
  },
  {
    title: 'Substitutos',
    lineColor: 'bg-rose-500',
    iconBorder: 'border-rose-500/40 dark:border-rose-400/50',
    iconColor: 'text-rose-600 dark:text-rose-400',
    icon: UserRound,
  },
  {
    title: 'Itinerários',
    lineColor: 'bg-purple-500',
    iconBorder: 'border-purple-500/40 dark:border-purple-400/50',
    iconColor: 'text-purple-600 dark:text-purple-400',
    icon: Map,
  },
  {
    title: 'Estatísticas',
    lineColor: 'bg-sky-500',
    iconBorder: 'border-sky-500/40 dark:border-sky-400/50',
    iconColor: 'text-sky-600 dark:text-sky-400',
    icon: BarChart3,
  },
  {
    title: 'Estatísticas Cong.',
    lineColor: 'bg-indigo-500',
    iconBorder: 'border-indigo-500/40 dark:border-indigo-400/50',
    iconColor: 'text-indigo-600 dark:text-indigo-400',
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
      if (['Substitutos', 'Itinerários', 'Estatísticas', 'Estatísticas Cong.'].includes(card.title)) return false;
    }
    return true;
  });

  return (
    <div className="flex flex-col gap-4">
      {hasPendingInvites && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={() => onCardClick?.('Ajustes')}
          className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl p-4 text-white shadow-sm cursor-pointer flex items-center justify-between group overflow-hidden relative transition-transform active:scale-[0.99]"
        >
          <div className="relative z-10 flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center shrink-0">
              <Mail size={20} />
            </div>
            <div>
              <h3 className="font-semibold text-sm">Convite Pendente</h3>
              <p className="text-white/80 text-xs">Você recebeu um novo acesso. Toque para aceitar.</p>
            </div>
          </div>
          <div className="relative z-10 bg-white text-emerald-700 px-3 py-1.5 rounded-lg font-medium text-xs shadow-xs group-hover:bg-emerald-50 transition-colors">
            Ver agora
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
        {filteredCards.map((card, index) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.04, duration: 0.25 }}
            onClick={() => onCardClick?.(card.title)}
            className="group relative bg-surface-100 rounded-2xl p-3.5 sm:p-4 pl-4 sm:pl-4.5 border border-surface-300 hover:border-primary-200/50 shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer flex items-center justify-between gap-3 overflow-hidden"
          >
            {/* Fine clean colored accent line on the left */}
            <div className={`absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full ${card.lineColor}`} />

            <div className="flex items-center gap-3 min-w-0 flex-1">
              {/* Clean Outline Icon (transparent bg with colored outline & stroke) */}
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${card.iconBorder} ${card.iconColor} bg-transparent transition-all duration-200 group-hover:scale-105 group-hover:bg-surface-200/50`}>
                <card.icon size={19} strokeWidth={1.8} />
              </div>

              {/* Title & Metadata */}
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-typography-900 group-hover:text-primary-200 transition-colors truncate">
                  {card.title === 'Congregações' && isPioneer ? 'Congregação' : card.title}
                </h3>
                
                <div className="mt-0.5 flex items-center gap-1.5 flex-wrap">
                  {card.title === 'Congregações' ? (
                    isPioneer ? (
                      <span className="text-[11px] font-medium text-primary-200 bg-primary-200/10 px-2 py-0.5 rounded-md">
                        Sua congregação
                      </span>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-medium text-typography-600 bg-surface-200 px-2 py-0.5 rounded-md border border-surface-300/50">
                          {congregationCount} congregações
                        </span>
                        {groupCount > 0 && (
                          <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                            {groupCount} grupos
                          </span>
                        )}
                      </div>
                    )
                  ) : card.title === 'Dados Pessoais' ? (
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="text-xs text-typography-500 truncate">
                        {personalData?.nome || user?.usuario || 'Seu perfil'}
                      </span>
                      {(user?.role === 'admin' || user?.email === 'weldonrs@gmail.com' || user?.usuario === '2283701' || user?.email === '2283701@progcir.app' || user?.email === '2283701@progcir.com') && (
                        <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded">
                          Admin
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-typography-500 truncate">
                      {card.title === 'Substitutos' ? `${substituteCount} ativos` : 
                       card.title === 'Itinerários' ? (currentEvent || 'Nenhum planejado') : 
                       card.title === 'Estatísticas' ? `${analyzedCongregationsCount} analisadas` :
                       card.title === 'Estatísticas Cong.' ? 'Últimas 4 visitas' : ''}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Subtle Chevron indicator */}
            <ChevronRight 
              size={18} 
              className="text-typography-400 group-hover:text-primary-200 group-hover:translate-x-0.5 transition-all shrink-0" 
            />
          </motion.div>
        ))}
      </div>
    </div>
  );
}
