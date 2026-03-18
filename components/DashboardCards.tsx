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
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4 md:gap-8">
      {cards.map((card, index) => (
        <motion.div
          key={card.title}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
          onClick={() => onCardClick?.(card.title)}
          className="flex bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-md transition-all cursor-pointer h-full"
        >
          <div className="w-4 md:w-6" style={{ backgroundColor: card.color }}></div>
          <div className="flex-1 p-4 md:p-6 flex items-start">
            <div className="w-12 h-12 md:w-16 md:h-16 flex-shrink-0 flex items-center justify-center rounded-xl bg-gray-50">
              <card.icon size={32} className="md:w-10 md:h-10" style={{ color: card.color }} />
            </div>
            <div className="ml-3 md:ml-4 flex-1">
              <h4 className="font-bold text-right text-sm md:text-lg uppercase leading-tight" style={{ color: card.color }}>
                {card.title}
              </h4>
              <div className="mt-2 md:mt-4">
                {card.title === 'Congregações' ? (
                  <div className="flex justify-between text-[10px] md:text-sm text-black font-medium">
                    <p>Congregações: <span className="font-normal">{congregationCount}</span></p>
                    <p>Grupos: <span className="font-normal">{groupCount}</span></p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {card.action && (
                      <p className="text-right text-[10px] md:text-sm font-bold mb-1 md:mb-2" style={{ color: card.color }}>
                        {card.action}
                      </p>
                    )}
                    <p className="text-[10px] md:text-sm text-black font-medium">
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
