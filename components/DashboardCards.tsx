'use client';

import { Contact, Store, UserRound, Map, BarChart3, ClipboardList } from 'lucide-react';
import { motion } from 'motion/react';

const cards = [
  {
    title: 'Dados Pessoais',
    color: '#4CAF50',
    icon: Contact,
    content: 'Início no Circuito:',
  },
  {
    title: 'Congregações',
    color: '#E67E22',
    icon: Store,
    stats: { congregações: '', grupos: '' },
  },
  {
    title: 'Substitutos',
    color: '#C2185B',
    icon: UserRound,
    content: 'Registrados:',
  },
  {
    title: 'Itinerários',
    color: '#7B1FA2',
    icon: Map,
    content: 'Evento:',
  },
  {
    title: 'Estatísticas',
    color: '#03A9F4',
    icon: BarChart3,
    content: 'Congregações contabilizadas:',
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
    <div className="grid grid-cols-1 landscape:grid-cols-2 md:grid-cols-2 gap-6">
      {cards.map((card, index) => (
        <motion.div
          key={card.title}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
          onClick={() => onCardClick?.(card.title)}
          className="flex bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all cursor-pointer h-24 border border-gray-100 group"
        >
          <div className="w-4 h-full flex-shrink-0" style={{ backgroundColor: card.color }}></div>
          <div className="flex-1 flex items-center px-6 gap-6">
            <div className="group-hover:scale-110 transition-transform flex-shrink-0" style={{ color: card.color }}>
              <card.icon size={32} />
            </div>
            <div className="text-left flex flex-col justify-center overflow-hidden">
              <div className="font-extrabold text-sm leading-tight tracking-wider uppercase truncate" style={{ color: card.color }}>
                {card.title}
              </div>
              <div className="mt-0.5">
                {card.title === 'Congregações' ? (
                  <div className="flex flex-col text-[10px] font-bold leading-tight tracking-wide uppercase opacity-80" style={{ color: card.color }}>
                    <p>Congregações: <span className="font-normal">{congregationCount}</span></p>
                    <p>Grupos: <span className="font-normal">{groupCount}</span></p>
                  </div>
                ) : card.title === 'Dados Pessoais' ? (
                  <div className="flex flex-col text-[10px] font-bold leading-tight tracking-wide uppercase opacity-80" style={{ color: card.color }}>
                    <p>Viajante: <span className="font-normal lowercase">{user?.usuario || '---'}@progcir.app</span></p>
                    {user?.role === 'admin' && (
                      <p className="text-amber-600 font-black mt-0.5">Administrador</p>
                    )}
                  </div>
                ) : (
                  <div className="font-bold text-[10px] leading-tight tracking-wide uppercase opacity-80 truncate" style={{ color: card.color }}>
                    {card.title === 'Itinerários' ? 'EVENTO ATUAL: ' : card.content} 
                    <span className="font-normal">
                      {card.title === 'Substitutos' ? substituteCount : 
                       card.title === 'Itinerários' ? (currentEvent || 'Nenhum evento') : 
                       card.title === 'Estatísticas' ? analyzedCongregationsCount : ''}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
