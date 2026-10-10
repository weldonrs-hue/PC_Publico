'use client';

import React from 'react';
import { FileText, ChevronRight, Mail } from 'lucide-react';
import { motion } from 'motion/react';

interface CartasDashboardProps {
  onViewChange: (view: string) => void;
}

export default function CartasDashboard({ onViewChange }: CartasDashboardProps) {
  const cards = [
    {
      id: 'esp',
      title: 'Cartas ESP',
      description: 'Anfitriã, refeições e convites para a ESP.',
      badge: 'E.S.P.',
      icon: Mail,
      view: 'cartas_esp',
      color: '#10B981',
      iconBorder: 'border-emerald-500/40 dark:border-emerald-400/50',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
    },
    {
      id: 'emr',
      title: 'Cartas EMR',
      description: 'Anfitriãs, convites e instrutores para a EMR.',
      badge: 'E.M.R.',
      icon: Mail,
      view: 'cartas_emr',
      color: '#3B82F6',
      iconBorder: 'border-blue-500/40 dark:border-blue-400/50',
      iconColor: 'text-blue-600 dark:text-blue-400',
    },
    {
      id: 'congresso',
      title: 'Cartas Congresso',
      description: 'Oração, Presidente e Treinamentos.',
      badge: 'Congresso',
      icon: Mail,
      view: 'cartas_congresso',
      color: '#8B5CF6',
      iconBorder: 'border-violet-500/40 dark:border-violet-400/50',
      iconColor: 'text-violet-600 dark:text-violet-400',
    },
    {
      id: 'assembleias',
      title: 'Cartas Assembleias',
      description: 'Anciãos, Oradores, Presidentes, Orações e Pioneiros.',
      badge: 'Assembleias',
      icon: Mail,
      view: 'cartas_assembleias',
      color: '#F59E0B',
      iconBorder: 'border-amber-500/40 dark:border-amber-400/50',
      iconColor: 'text-amber-600 dark:text-amber-400',
    },
    {
      id: 'programacoes',
      title: 'Programações',
      description: 'Gestão de templates de programações especiais.',
      badge: 'Em Breve',
      icon: FileText,
      view: 'cartas_programacoes',
      color: '#EC4899',
      iconBorder: 'border-pink-500/40 dark:border-pink-400/50',
      iconColor: 'text-pink-600 dark:text-pink-400',
      inactive: true
    },
  ];

  return (
    <div className="space-y-8 pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-transparent border border-primary-200/40 dark:border-primary-200/50 text-primary-200 flex items-center justify-center shrink-0">
              <FileText size={20} strokeWidth={1.8} />
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-typography-900 tracking-tight">
              Painel de Templates
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-typography-500">
            Gerencie os modelos DOCX e ferramentas de documentos do circuito.
          </p>
        </div>
      </div>

      {/* Grid de Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
        {cards.map((card, index) => {
          const Icon = card.icon;

          return (
            <motion.div
              key={card.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.06 }}
              onClick={() => !card.inactive && onViewChange(card.view)}
              className={`group relative flex flex-col justify-between p-5 sm:p-6 rounded-3xl bg-surface-100 border border-surface-300 hover:border-primary-200/40 shadow-xs hover:shadow-xl transition-all duration-300 overflow-hidden ${
                card.inactive 
                  ? 'opacity-60 cursor-not-allowed' 
                  : 'cursor-pointer hover:-translate-y-0.5'
              }`}
            >
              {/* Brilho suave */}
              <div 
                className="absolute -top-16 -right-16 w-32 h-32 rounded-full blur-3xl opacity-10 group-hover:opacity-25 transition-opacity pointer-events-none"
                style={{ backgroundColor: card.color }}
              />

              {/* Barra superior de destaque */}
              <div 
                className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r opacity-80 group-hover:opacity-100 transition-opacity"
                style={{ backgroundImage: `linear-gradient(to right, ${card.color}, transparent)` }}
              />

              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${card.iconBorder} ${card.iconColor} bg-transparent transition-all duration-300 group-hover:scale-105 group-hover:bg-surface-200/50`}>
                    <Icon size={24} strokeWidth={1.8} />
                  </div>

                  <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-surface-200 text-typography-500 border border-surface-300">
                    {card.badge}
                  </span>
                </div>

                <div className="space-y-1">
                  <h3 className="text-base sm:text-lg font-black text-typography-900 group-hover:text-primary-200 transition-colors">
                    {card.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-typography-500 leading-relaxed">
                    {card.description}
                  </p>
                </div>
              </div>

              <div className="pt-4 mt-4 border-t border-surface-300/60 flex items-center justify-between text-xs font-bold text-typography-500 group-hover:text-primary-200 transition-colors">
                <span className="tracking-wide">
                  {card.inactive ? 'Em breve' : 'Gerenciar Modelos'}
                </span>
                <div className="w-7 h-7 rounded-full bg-surface-200 group-hover:bg-primary-200/10 flex items-center justify-center transition-all group-hover:translate-x-1">
                  <ChevronRight size={15} />
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
