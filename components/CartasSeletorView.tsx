'use client';

import React from 'react';
import { Mail, ArrowLeft, Send, Sparkles, Layout, FileText, Wrench, Settings2 } from 'lucide-react';
import { motion } from 'motion/react';

interface CartasSeletorViewProps {
  onViewChange: (view: string) => void;
  isAdmin?: boolean;
  appConfig?: {
    allowESPUploadForAll: boolean;
    allowEMRUploadForAll: boolean;
    allowCongressoUploadForAll: boolean;
    allowAssembleiasUploadForAll: boolean;
    allowProgramacoesUploadForAll: boolean;
    allowPSSUploadForAll: boolean;
  };
}

export default function CartasSeletorView({ onViewChange, isAdmin, appConfig }: CartasSeletorViewProps) {
  const options = [
    {
      id: 'esp',
      title: 'Cartas ESP',
      subtitle: 'ANFITRIÃ E REFEIÇÕES',
      icon: Mail,
      color: '#10B981', // Emerald
      gradient: 'from-emerald-500 to-teal-600',
      view: 'cartas_esp',
      active: true,
      uploadKey: 'allowESPUploadForAll'
    },
    {
      id: 'emr',
      title: 'Cartas EMR',
      subtitle: 'EM BREVE',
      icon: Mail,
      color: '#3B82F6', // Blue
      gradient: 'from-blue-200 to-indigo-300',
      view: 'cartas_emr',
      active: false,
      uploadKey: 'allowEMRUploadForAll'
    },
    {
      id: 'congresso',
      title: 'Cartas Congresso',
      subtitle: 'ORATÓRIA E TREINAMENTO',
      icon: Mail,
      color: '#8B5CF6', // Violet
      gradient: 'from-violet-500 to-purple-600',
      view: 'cartas_congresso',
      active: true,
      uploadKey: 'allowCongressoUploadForAll'
    },
    {
      id: 'assembleias',
      title: 'Cartas Assembleias',
      subtitle: 'EM BREVE',
      icon: Mail,
      color: '#F59E0B', // Amber
      gradient: 'from-amber-200 to-orange-300',
      view: 'cartas_assembleias',
      active: false,
      uploadKey: 'allowAssembleiasUploadForAll'
    },
    {
      id: 'programacoes',
      title: 'Programações',
      subtitle: 'EM BREVE',
      icon: FileText,
      color: '#EC4899', // Pink
      gradient: 'from-pink-200 to-rose-300',
      view: 'cartas_programacoes',
      active: false,
      uploadKey: 'allowProgramacoesUploadForAll'
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="bg-emerald-100 p-3 rounded-none text-emerald-600 shadow-inner">
            <Mail size={24} strokeWidth={2.5} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-800 tracking-tight">
              Cartas e Documentos
            </h2>
            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em] mt-0.5 opacity-70">
              Módulo Unificado de Geração e Templates
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {options.map((option, index) => {
          const canManage = isAdmin || (option.uploadKey && (appConfig as any)?.[option.uploadKey]) || (option.id === 'esp' || option.id === 'congresso');
          
          return (
            <motion.div
              key={option.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className={`group relative flex flex-col bg-white rounded-none transition-all duration-500 overflow-hidden border ${
                option.active 
                  ? 'shadow-xl border-gray-100 hover:shadow-2xl' 
                  : 'opacity-60 grayscale border-gray-200'
              }`}
            >
              {/* Main Button Area */}
              <button
                onClick={() => {
                  if (option.active) {
                    if (option.forceManager) {
                      onViewChange(`${option.view}:manager`);
                    } else {
                      onViewChange(option.view);
                    }
                  }
                }}
                disabled={!option.active}
                className={`flex-1 p-8 flex flex-col items-center justify-center text-center w-full relative h-full ${!option.active ? 'cursor-not-allowed' : 'cursor-pointer'}`}
              >
                {/* Background Accent */}
                <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${option.gradient} opacity-5 rounded-none ${option.active ? 'group-hover:scale-150 transition-transform duration-700' : ''}`} />
                
                <div className={`w-20 h-20 rounded-none flex items-center justify-center bg-gradient-to-br ${option.gradient} text-white shadow-lg shadow-black/10 transition-all duration-500 mb-6 ${option.active ? 'group-hover:scale-110 group-hover:rotate-6' : ''}`}>
                  <option.icon size={40} strokeWidth={2.5} />
                </div>

                <div className="relative z-10">
                  <h3 className={`text-xl font-black uppercase tracking-tight transition-colors ${option.active ? 'text-gray-900 group-hover:text-emerald-600' : 'text-gray-400'}`}>
                    {option.title}
                  </h3>
                  <p className={`text-[10px] font-black uppercase tracking-[0.2em] mt-2 opacity-70 ${option.active ? 'text-gray-400' : 'text-gray-300'}`}>
                    {option.subtitle}
                  </p>
                </div>
              </button>

              {/* Status Indicator */}
              {option.active && (
                <div className="border-t border-gray-50 p-4 bg-gray-50/30 flex items-center justify-between px-8">
                  <div className="flex items-center gap-1.5 font-black uppercase text-gray-400 tracking-wider">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[9px]">Ativo</span>
                  </div>
                  {canManage && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); onViewChange(`${option.view}:manager`); }}
                      className="flex items-center gap-1.5 py-1.5 px-3 rounded-xl bg-white border border-gray-100 shadow-sm text-emerald-600 hover:shadow-md hover:bg-emerald-50 transition-all text-[9px] font-black uppercase tracking-widest group/btn"
                    >
                      <Settings2 size={12} className="group-hover/btn:rotate-90 transition-transform duration-500" />
                      Gerenciar
                    </button>
                  )}
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
