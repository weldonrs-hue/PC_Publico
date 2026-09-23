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

interface CartaOption {
  id: string;
  title: string;
  subtitle: string;
  icon: any;
  color: string;
  gradient: string;
  view: string;
  active: boolean;
  uploadKey: string;
  forceManager?: boolean;
}

export default function CartasSeletorView({ onViewChange, isAdmin, appConfig }: CartasSeletorViewProps) {
  const options: CartaOption[] = [
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
      subtitle: 'ANCIÃOS, ORADORES E PIONEIROS',
      icon: Mail,
      color: '#F59E0B', // Amber
      gradient: 'from-amber-500 to-orange-600',
      view: 'cartas_assembleias',
      active: true,
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {options.map((option, index) => {
          const canManage = isAdmin || (option.uploadKey && (appConfig as any)?.[option.uploadKey]) || (option.id === 'esp' || option.id === 'congresso');
          
          return (
            <motion.div
              key={option.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className={`relative group h-16 ${
                !option.active 
                  ? 'cursor-not-allowed opacity-60 grayscale' 
                  : 'cursor-pointer'
              }`}
            >
              {/* Background Glow */}
              {option.active && (
                <div 
                  className="absolute -inset-0.5 blur-md opacity-0 group-hover:opacity-20 transition-opacity duration-500 rounded-3xl"
                  style={{ backgroundColor: option.color }}
                />
              )}
              
              <div 
                className="relative flex bg-white rounded-[24px] overflow-hidden shadow-sm border border-gray-200 hover:border-transparent transition-all duration-300 h-full group"
                onClick={() => {
                  if (option.active) {
                    if (option.forceManager) {
                      onViewChange(`${option.view}:manager`);
                    } else {
                      onViewChange(option.view);
                    }
                  }
                }}
              >
                <div className={`w-1.5 h-full bg-gradient-to-b ${option.gradient} opacity-40 group-hover:opacity-100 transition-opacity`}></div>
                
                <div className="flex-1 flex items-center px-3 gap-3">
                  <div 
                    className={`w-10 h-10 rounded-[14px] flex items-center justify-center transition-all duration-500 shadow-lg shadow-black/5 ${
                      !option.active 
                        ? 'bg-gray-100 text-gray-400' 
                        : `bg-gradient-to-br ${option.gradient} group-hover:scale-105 group-hover:rotate-2`
                    }`}
                  >
                    <option.icon size={22} strokeWidth={2.5} className={`${!option.active ? 'text-gray-300' : 'text-white drop-shadow-md'}`} />
                  </div>

                  <div className="flex-1 text-left flex flex-col justify-center overflow-hidden pr-2">
                    <div className={`font-black text-[11px] leading-tight uppercase mb-0 transition-colors ${!option.active ? 'text-gray-400' : 'text-gray-900 group-hover:text-black'}`}>
                      {option.title}
                    </div>
                    <div className={`text-[7px] font-bold uppercase tracking-widest transition-opacity ${!option.active ? 'text-gray-300' : 'text-gray-400 opacity-60 group-hover:opacity-100'}`}>
                      {option.subtitle}
                    </div>
                  </div>

                  {option.active && canManage && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); onViewChange(`${option.view}:manager`); }}
                      className="p-2 rounded-xl bg-gray-50 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all border border-transparent hover:border-emerald-100 group/btn shrink-0"
                      title="Gerenciar Templates"
                    >
                      <Settings2 size={16} className="group-hover/btn:rotate-90 transition-transform duration-500" />
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
