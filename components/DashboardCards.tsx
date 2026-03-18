'use client';

import { Contact, Store, UserRound, Map, BarChart3 } from 'lucide-react';
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
    action: '(Visualizar)',
    content: 'Congregações contabilizadas:',
  },
];

interface DashboardCardsProps {
  onCardClick?: (title: string) => void;
  congregationCount?: number;
  groupCount?: number;
  substituteCount?: number;
}

export default function DashboardCards({ 
  onCardClick, 
  congregationCount = 0, 
  groupCount = 0,
  substituteCount = 0
}: DashboardCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
      {cards.map((card, index) => (
        <motion.div
          key={card.title}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
          onClick={() => onCardClick?.(card.title)}
          className="flex bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-md transition-all cursor-pointer h-full"
        >
          <div className="w-2 md:w-3" style={{ backgroundColor: card.color }}></div>
          <div className="flex-1 p-3 md:p-4 flex items-start">
            <div className="w-10 h-10 md:w-12 md:h-12 flex-shrink-0 flex items-center justify-center rounded-lg bg-gray-50">
              <card.icon size={24} className="md:w-6 md:h-6" style={{ color: card.color }} />
            </div>
            <div className="ml-2 md:ml-3 flex-1">
              <h4 className="font-bold text-right text-[10px] md:text-sm uppercase leading-tight" style={{ color: card.color }}>
                {card.title}
              </h4>
              <div className="mt-1 md:mt-2">
                {card.title === 'Congregações' ? (
                  <div className="flex flex-col text-[9px] md:text-xs text-black font-medium">
                    <p>Congregações: <span className="font-normal">{congregationCount}</span></p>
                    <p>Grupos: <span className="font-normal">{groupCount}</span></p>
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    {card.action && (
                      <p className="text-right text-[9px] md:text-xs font-bold mb-0.5 md:mb-1" style={{ color: card.color }}>
                        {card.action}
                      </p>
                    )}
                    <p className="text-[9px] md:text-xs text-black font-medium">
                      {card.content} <span className="font-normal">{card.title === 'Substitutos' ? substituteCount : ''}</span>
                    </p>
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
