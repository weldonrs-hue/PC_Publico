'use client';
// Force rebuild - 2026-10-05
import { FileText, Shapes, Calendar, Receipt, Inbox, ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';

interface MiscViewProps {
  onViewChange: (view: string) => void;
  isAdmin?: boolean;
  appConfig?: { 
    reportEnabledForAll: boolean;
  };
}

const miscItems = [
  {
    id: 'file_viewer',
    title: 'Leitor de Arquivos',
    subtitle: 'Visualize documentos DOCX, PDF e outros formatos diretamente no navegador.',
    badge: 'Visualizador',
    color: '#3B82F6', // Blue
    iconBorder: 'border-blue-500/40 dark:border-blue-400/50',
    iconColor: 'text-blue-600 dark:text-blue-400',
    icon: FileText,
    active: true,
    requiresAdmin: false,
  },
  {
    id: 'field_service_report',
    title: 'Relatório de Pregação',
    subtitle: 'Registre e acompanhe horas, metas e atividades mensais de campo.',
    badge: 'Mensal',
    color: '#D81B60', // Magenta
    iconBorder: 'border-pink-500/40 dark:border-pink-400/50',
    iconColor: 'text-pink-600 dark:text-pink-400',
    icon: Calendar,
    active: true,
    requiresAdmin: true,
  },
  {
    id: 'weekly_expenses',
    title: 'Despesas da Semana',
    subtitle: 'Controle financeiro semanal com geração de recibo para reembolso.',
    badge: 'Financeiro',
    color: '#10B981', // Emerald
    iconBorder: 'border-emerald-500/40 dark:border-emerald-400/50',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    icon: Receipt,
    active: true,
    requiresAdmin: false,
  },
  {
    id: 'inbox',
    title: 'Caixa de Entrada',
    subtitle: 'Gerencie rascunhos, compose e envie e-mails diretamente pelo sistema.',
    badge: 'E-mail',
    color: '#6366F1', // Indigo
    iconBorder: 'border-indigo-500/40 dark:border-indigo-400/50',
    iconColor: 'text-indigo-600 dark:text-indigo-400',
    icon: Inbox,
    active: true,
    requiresAdmin: false,
  },
];

export default function MiscView({ onViewChange, isAdmin, appConfig }: MiscViewProps) {
  return (
    <div className="space-y-8 pb-20">
      {/* Cabeçalho da Página */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-transparent border border-primary-200/40 dark:border-primary-200/50 text-primary-200 flex items-center justify-center shrink-0">
              <Shapes size={20} strokeWidth={1.8} />
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-typography-900 tracking-tight">
              Diversos
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-typography-500 pl-12">
            Ferramentas e utilitários complementares para a administração do circuito.
          </p>
        </div>
      </div>

      {/* Grid de Opções */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
        {miscItems.map((item, index) => {
          const Icon = item.icon;
          const isInactive =
            item.requiresAdmin && !isAdmin && !appConfig?.reportEnabledForAll;

          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.06 }}
              onClick={() => !isInactive && item.active && onViewChange(item.id)}
              className={`group relative flex flex-col justify-between p-5 sm:p-6 rounded-3xl bg-surface-100 border border-surface-300 shadow-xs overflow-hidden transition-all duration-300 ${
                isInactive || !item.active
                  ? 'cursor-not-allowed opacity-60'
                  : 'cursor-pointer hover:border-primary-200/40 hover:shadow-xl hover:-translate-y-0.5'
              }`}
            >
              {/* Brilho decorativo suave */}
              <div
                className="absolute -top-16 -right-16 w-32 h-32 rounded-full blur-3xl opacity-10 group-hover:opacity-25 transition-opacity pointer-events-none"
                style={{ backgroundColor: item.color }}
              />

              {/* Barra superior de destaque */}
              <div
                className="absolute top-0 left-0 right-0 h-1 opacity-80 group-hover:opacity-100 transition-opacity"
                style={{ backgroundImage: `linear-gradient(to right, ${item.color}, transparent)` }}
              />

              <div className="space-y-4">
                {/* Top Row: Icon + Badge */}
                <div className="flex items-start justify-between gap-3">
                  <div
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${item.iconBorder} ${item.iconColor} bg-transparent transition-all duration-300 group-hover:scale-105 group-hover:bg-surface-200/50`}
                  >
                    <Icon size={24} strokeWidth={1.8} />
                  </div>

                  <div className="flex items-center gap-1.5">
                    {isInactive && (
                      <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-surface-300 text-typography-400 border border-surface-300">
                        INATIVO
                      </span>
                    )}
                    <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-surface-200 text-typography-500 border border-surface-300">
                      {item.badge}
                    </span>
                  </div>
                </div>

                {/* Título & Descrição */}
                <div className="space-y-1">
                  <h3 className="text-base sm:text-lg font-black text-typography-900 group-hover:text-primary-200 transition-colors">
                    {item.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-typography-500 leading-relaxed">
                    {isInactive ? 'Indisponível no momento.' : item.subtitle}
                  </p>
                </div>
              </div>

              {/* Rodapé do Card */}
              <div className="pt-4 mt-4 border-t border-surface-300/60 flex items-center justify-between text-xs font-bold text-typography-500 group-hover:text-primary-200 transition-colors">
                <span className="tracking-wide">
                  {isInactive || !item.active ? 'Indisponível' : 'Acessar'}
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
