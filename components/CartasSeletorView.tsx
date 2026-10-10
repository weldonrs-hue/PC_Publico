'use client';

import React from 'react';
import { Mail, ChevronRight, FileText, Settings2 } from 'lucide-react';
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
  badge: string;
  icon: any;
  color: string;
  iconBorder: string;
  iconColor: string;
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
      subtitle: 'Convites, anfitriã e refeições para a Escola de Pioneiros.',
      badge: 'E.S.P.',
      icon: Mail,
      color: '#10B981', // Emerald
      iconBorder: 'border-emerald-500/40 dark:border-emerald-400/50',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      view: 'cartas_esp',
      active: true,
      uploadKey: 'allowESPUploadForAll'
    },
    {
      id: 'emr',
      title: 'Cartas EMR',
      subtitle: 'Designações, cartas e convites para anciãos e servos ministeriais.',
      badge: 'E.M.R.',
      icon: Mail,
      color: '#3B82F6', // Blue
      iconBorder: 'border-blue-500/40 dark:border-blue-400/50',
      iconColor: 'text-blue-600 dark:text-blue-400',
      view: 'cartas_emr',
      active: true,
      uploadKey: 'allowEMRUploadForAll'
    },
    {
      id: 'congresso',
      title: 'Cartas Congresso',
      subtitle: 'Convites de oração, presidente de sessão e avisos de treinamentos.',
      badge: 'Congresso',
      icon: Mail,
      color: '#8B5CF6', // Violet
      iconBorder: 'border-violet-500/40 dark:border-violet-400/50',
      iconColor: 'text-violet-600 dark:text-violet-400',
      view: 'cartas_congresso',
      active: true,
      uploadKey: 'allowCongressoUploadForAll'
    },
    {
      id: 'assembleias',
      title: 'Cartas Assembleias',
      subtitle: 'Designações para anciãos, oradores, orações e pioneiros.',
      badge: 'Assembleias',
      icon: Mail,
      color: '#F59E0B', // Amber
      iconBorder: 'border-amber-500/40 dark:border-amber-400/50',
      iconColor: 'text-amber-600 dark:text-amber-400',
      view: 'cartas_assembleias',
      active: true,
      uploadKey: 'allowAssembleiasUploadForAll'
    },
    {
      id: 'programacoes',
      title: 'Programações',
      subtitle: 'Gestão de modelos e documentos para programações especiais.',
      badge: 'Em Breve',
      icon: FileText,
      color: '#EC4899', // Pink
      iconBorder: 'border-pink-500/40 dark:border-pink-400/50',
      iconColor: 'text-pink-600 dark:text-pink-400',
      view: 'cartas_programacoes',
      active: false,
      uploadKey: 'allowProgramacoesUploadForAll'
    },
  ];

  return (
    <div className="space-y-8 pb-20">
      {/* Cabeçalho da Página — Idêntico ao padrão de Escolas e Eventos */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-transparent border border-primary-200/40 dark:border-primary-200/50 text-primary-200 flex items-center justify-center shrink-0">
              <Mail size={20} strokeWidth={1.8} />
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-typography-900 tracking-tight">
              Cartas e Documentos
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-typography-500">
            Módulo unificado de geração, modelos e templates oficiais para eventos e escolas.
          </p>
        </div>
      </div>

      {/* Grid de Opções de Cartas — Padrão Escolas/Eventos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
        {options.map((option, index) => {
          const Icon = option.icon;
          const canManage = isAdmin || (option.uploadKey && (appConfig as any)?.[option.uploadKey]) || (option.id === 'esp' || option.id === 'congresso' || option.id === 'emr' || option.id === 'assembleias');

          return (
            <motion.div
              key={option.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.06 }}
              onClick={() => {
                if (option.active) {
                  if (option.forceManager) {
                    onViewChange(`${option.view}:manager`);
                  } else {
                    onViewChange(option.view);
                  }
                }
              }}
              className={`group relative flex flex-col justify-between p-5 sm:p-6 rounded-3xl bg-surface-100 border border-surface-300 hover:border-primary-200/40 shadow-xs hover:shadow-xl transition-all duration-300 overflow-hidden ${
                !option.active
                  ? 'cursor-not-allowed opacity-60'
                  : 'cursor-pointer hover:-translate-y-0.5'
              }`}
            >
              {/* Brilho decorativo suave */}
              <div 
                className="absolute -top-16 -right-16 w-32 h-32 rounded-full blur-3xl opacity-10 group-hover:opacity-25 transition-opacity pointer-events-none"
                style={{ backgroundColor: option.color }}
              />

              {/* Barra superior de destaque sutil */}
              <div 
                className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r opacity-80 group-hover:opacity-100 transition-opacity"
                style={{ backgroundImage: `linear-gradient(to right, ${option.color}, transparent)` }}
              />

              <div className="space-y-4">
                {/* Top Row: Icon + Badge + Settings button */}
                <div className="flex items-start justify-between gap-3">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${option.iconBorder} ${option.iconColor} bg-transparent transition-all duration-300 group-hover:scale-105 group-hover:bg-surface-200/50`}>
                    <Icon size={24} strokeWidth={1.8} />
                  </div>

                  <div className="flex items-center gap-1.5">
                    {option.active && canManage && (
                      <button 
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          onViewChange(`${option.view}:manager`); 
                        }}
                        className="p-1.5 rounded-lg border border-surface-300/80 bg-surface-200/50 hover:bg-surface-300 text-typography-400 hover:text-primary-200 transition-colors"
                        title="Gerenciar Templates"
                      >
                        <Settings2 size={14} />
                      </button>
                    )}
                    <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-surface-200 text-typography-500 border border-surface-300">
                      {option.badge}
                    </span>
                  </div>
                </div>

                {/* Título & Descrição */}
                <div className="space-y-1">
                  <h3 className="text-base sm:text-lg font-black text-typography-900 group-hover:text-primary-200 transition-colors">
                    {option.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-typography-500 leading-relaxed">
                    {option.subtitle}
                  </p>
                </div>
              </div>

              {/* Rodapé do Card com CTA */}
              <div className="pt-4 mt-4 border-t border-surface-300/60 flex items-center justify-between text-xs font-bold text-typography-500 group-hover:text-primary-200 transition-colors">
                <span className="tracking-wide">
                  {option.active ? 'Acessar Modelos' : 'Em breve'}
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
