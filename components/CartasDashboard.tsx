'use client';

import React from 'react';
import { FileText, Wrench, ChevronRight, Mail } from 'lucide-react';
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
      icon: Mail,
      view: 'cartas_esp',
      color: '#10B981',
      gradient: 'from-emerald-500 to-teal-600',
    },
    {
      id: 'emr',
      title: 'Cartas EMR',
      description: 'Modelos para Escola de Evangelizadores.',
      icon: Mail,
      view: 'cartas_emr',
      color: '#3B82F6',
      gradient: 'from-blue-500 to-indigo-600',
      inactive: true
    },
    {
      id: 'congresso',
      title: 'Cartas Congresso',
      description: 'Oração, Presidente e Treinamentos.',
      icon: Mail,
      view: 'cartas_congresso',
      color: '#8B5CF6',
      gradient: 'from-violet-500 to-purple-600',
    },
    {
      id: 'assembleias',
      title: 'Cartas Assembleias',
      description: 'Documentação para Assembleias de Circuito.',
      icon: Mail,
      view: 'cartas_assembleias',
      color: '#F59E0B',
      gradient: 'from-amber-500 to-orange-600',
      inactive: true
    },
    {
      id: 'programacoes',
      title: 'Programações',
      description: 'Gestão de templates de programações.',
      icon: FileText,
      view: 'cartas_programacoes',
      color: '#EC4899',
      gradient: 'from-pink-500 to-rose-600',
      inactive: true
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 uppercase tracking-tight">Painel de Uploads</h2>
          <p className="text-gray-500 text-sm font-medium uppercase tracking-widest leading-none">Gerencie templates e ferramentas de docs.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {cards.map((card, index) => (
          <motion.div
            key={card.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            onClick={() => !card.inactive && onViewChange(card.view)}
            className={`relative group ${card.inactive ? 'opacity-50 grayscale cursor-not-allowed' : 'cursor-pointer'}`}
          >
            {/* Static Background Glow */}
            <div 
              className="absolute -inset-0.5 blur-md opacity-10 group-hover:opacity-30 transition-opacity duration-500 rounded-[2rem]"
              style={{ backgroundColor: card.color }}
            />
            
            <div className="relative flex bg-white rounded-3xl overflow-hidden shadow-lg border border-gray-100 hover:border-transparent transition-all duration-300 h-28 group">
              {/* Vibrant Vertical Accent */}
              <div className={`w-2 h-full bg-gradient-to-b ${card.gradient}`}></div>
              
              <div className="flex-1 flex items-center px-6 gap-5">
                <div 
                   className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-500 shadow-lg shadow-black/5 bg-gradient-to-br ${card.gradient} ${!card.inactive && 'group-hover:scale-110 group-hover:rotate-3'}`}
                >
                  <card.icon size={30} strokeWidth={2.5} className="text-white drop-shadow-md" />
                </div>

                <div className="text-left flex flex-col justify-center overflow-hidden pr-2">
                  <div className="font-black text-[13px] md:text-sm leading-tight text-gray-900 uppercase truncate mb-1 group-hover:text-black transition-colors">
                    {card.title}
                  </div>
                  
                  <p className="text-[9px] font-bold text-gray-500 uppercase tracking-tighter line-clamp-2">
                    {card.inactive ? 'EM DESENVOLVIMENTO' : card.description}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
