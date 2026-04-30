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
      id: 'workshops',
      title: 'Workshops',
      description: 'Gerador de Documentos e Templates para Treinamentos.',
      icon: Wrench,
      view: 'docx_demo',
      color: 'bg-blue-500',
      textColor: 'text-blue-500',
      bgColor: 'bg-blue-50'
    },
    // Future cards can be added here
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Painel de Cartas</h2>
          <p className="text-gray-500">Gerencie templates e gere documentos oficiais.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {cards.map((card, index) => (
          <motion.button
            key={card.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            onClick={() => onViewChange(card.view)}
            className="group relative flex flex-col items-start p-6 bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-md hover:border-blue-200 transition-all text-left w-full"
          >
            <div className={`p-3 rounded-xl ${card.bgColor} ${card.textColor} mb-4 group-hover:scale-110 transition-transform`}>
              <card.icon size={24} />
            </div>
            <h3 className="text-lg font-bold text-gray-800 mb-2">{card.title}</h3>
            <p className="text-sm text-gray-500 mb-6">{card.description}</p>
            
            <div className="mt-auto flex items-center text-xs font-bold uppercase tracking-widest text-[#37616b]">
              Acessar
              <ChevronRight size={14} className="ml-1 group-hover:translate-x-1 transition-transform" />
            </div>

            {/* Decorative background element */}
            <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity">
              <Mail size={80} />
            </div>
          </motion.button>
        ))}
        
        {/* Placeholder for future features */}
        <div className="flex flex-col items-center justify-center p-6 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 opacity-50">
          <FileText size={32} className="text-gray-300 mb-2" />
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Em Breve</p>
        </div>
      </div>
    </div>
  );
}
