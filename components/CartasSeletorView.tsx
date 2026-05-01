'use client';

import React from 'react';
import { Mail, ArrowLeft, Send, Sparkles, Layout, FileText } from 'lucide-react';
import { motion } from 'motion/react';

interface CartasSeletorViewProps {
  onBack: () => void;
  onViewChange: (view: string) => void;
}

export default function CartasSeletorView({ onBack, onViewChange }: CartasSeletorViewProps) {
  const options = [
    {
      id: 'esp',
      title: 'Cartas ESP',
      subtitle: 'ESCOLA DE PIONEIROS',
      icon: Sparkles,
      color: '#10B981', // Emerald
      gradient: 'from-emerald-500 to-teal-600',
      view: 'cartas_esp',
    },
    {
      id: 'emr',
      title: 'Cartas EMR',
      subtitle: 'ESCOLA DE EVANGELIZADORES',
      icon: Send,
      color: '#3B82F6', // Blue
      gradient: 'from-blue-500 to-indigo-600',
      view: 'cartas_emr',
    },
    {
      id: 'congresso',
      title: 'Cartas Congresso',
      subtitle: 'DOCUMENTAÇÃO DE CONGRESSO',
      icon: Layout,
      color: '#8B5CF6', // Violet
      gradient: 'from-violet-500 to-purple-600',
      view: 'cartas_congresso',
    },
    {
      id: 'assembleias',
      title: 'Cartas Assembleias',
      subtitle: 'DOCUMENTAÇÃO DE ASSEMBLEIAS',
      icon: Mail,
      color: '#F59E0B', // Amber
      gradient: 'from-amber-500 to-orange-600',
      view: 'cartas_assembleias',
    },
    {
      id: 'programacoes',
      title: 'Programações',
      subtitle: 'GESTÃO DE PROGRAMAÇÕES',
      icon: FileText,
      color: '#EC4899', // Pink
      gradient: 'from-pink-500 to-rose-600',
      view: 'cartas_programacoes',
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <button 
          onClick={onBack}
          className="p-3 hover:bg-gray-100 rounded-2xl transition-all text-gray-500 hover:text-emerald-600 hover:scale-110 active:scale-95"
        >
          <ArrowLeft size={24} />
        </button>
        <div>
          <h1 className="text-3xl font-black text-gray-900 uppercase tracking-tighter">Módulo de Cartas</h1>
          <p className="text-gray-500 font-bold uppercase tracking-widest text-[10px] bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full border border-emerald-100 w-fit mt-1">
            Selecione uma categoria
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {options.map((option, index) => (
          <motion.button
            key={option.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.05 }}
            onClick={() => onViewChange(option.view)}
            className="group relative flex flex-col items-center justify-center p-8 bg-white rounded-[2.5rem] shadow-xl border border-gray-100 hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 overflow-hidden"
          >
            {/* Background Accent */}
            <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${option.gradient} opacity-5 rounded-bl-[5rem] group-hover:scale-150 transition-transform duration-700`} />
            
            <div className={`w-20 h-20 rounded-3xl flex items-center justify-center bg-gradient-to-br ${option.gradient} text-white shadow-lg shadow-black/10 group-hover:scale-110 group-hover:rotate-6 transition-all duration-500 mb-6`}>
              <option.icon size={40} strokeWidth={2.5} />
            </div>

            <div className="text-center relative z-10">
              <h3 className="text-xl font-black text-gray-900 uppercase tracking-tight group-hover:text-emerald-600 transition-colors">
                {option.title}
              </h3>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mt-2 opacity-70">
                {option.subtitle}
              </p>
            </div>

            <div className="mt-8 flex items-center gap-2 text-emerald-600 font-bold text-[10px] uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all translate-y-4 group-hover:translate-y-0">
              Acessar Módulo
              <ArrowLeft size={14} className="rotate-180" />
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
