'use client';
// Force rebuild - 2026-05-02
import { FileText, Shapes, Calendar, Receipt } from 'lucide-react';
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
    title: 'LEITOR DE ARQUIVOS',
    subtitle: 'VISUALIZADOR DOCX, PDF E MAIS',
    color: '#3B82F6', // Blue
    gradient: 'from-blue-500 to-indigo-600',
    icon: FileText,
  },
  {
    id: 'field_service_report',
    title: 'RELATÓRIO DE PREGAÇÃO',
    subtitle: 'CONTROLE MENSAL DE HORAS E METAS',
    color: '#D81B60', // Magenta
    gradient: 'from-pink-500 to-rose-600',
    icon: Calendar,
  },
  {
    id: 'weekly_expenses',
    title: 'DESPESAS DA SEMANA',
    subtitle: 'RECIBO E CONTROLE FINANCEIRO',
    color: '#10B981', // Emerald
    gradient: 'from-emerald-500 to-teal-600',
    icon: Receipt,
  },
];

export default function MiscView({ onViewChange, isAdmin, appConfig }: MiscViewProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="bg-violet-100 p-3 rounded-2xl text-violet-600 shadow-inner">
          <Shapes size={24} strokeWidth={2.5} />
        </div>
        <h2 className="text-2xl font-bold text-gray-800 tracking-tight">
          Diversos
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {miscItems.map((item, index) => {
          const isReport = item.id === 'field_service_report';
          
          const isInactive = (isReport && !isAdmin && !appConfig?.reportEnabledForAll);

          return (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              onClick={() => !isInactive && onViewChange(item.id)}
              className={`relative group h-28 ${isInactive ? 'cursor-not-allowed grayscale' : 'cursor-pointer'}`}
            >
              {/* Background Glow */}
              <div 
                className={`absolute -inset-0.5 blur-md transition-opacity duration-500 rounded-[2rem] ${isInactive ? 'opacity-0' : 'opacity-20 group-hover:opacity-40'}`}
                style={{ backgroundColor: isInactive ? '#e2e8f0' : item.color }}
              />
              
              <div className={`relative flex bg-white rounded-3xl overflow-hidden shadow-lg border border-gray-100 transition-all duration-300 h-full group ${!isInactive && 'hover:border-transparent'}`}>
                {/* Vibrant Vertical Accent */}
                <div className={`w-2 h-full bg-gradient-to-b ${item.gradient} ${isInactive ? 'opacity-10' : 'opacity-40 group-hover:opacity-100'} transition-opacity`}></div>
                
                <div className="flex-1 flex items-center px-6 gap-6">
                  <div 
                    className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-500 shadow-lg shadow-black/5 ${isInactive ? 'bg-gray-200' : `bg-gradient-to-br ${item.gradient} group-hover:scale-110 group-hover:rotate-3`}`}
                  >
                    <item.icon size={30} strokeWidth={2.5} className={isInactive ? 'text-gray-400' : 'text-white drop-shadow-md'} />
                  </div>

                  <div className="text-left flex flex-col justify-center overflow-hidden pr-2">
                    <div className={`font-black text-xs md:text-sm leading-tight uppercase mb-1 transition-colors ${isInactive ? 'text-gray-400' : 'text-gray-900 group-hover:text-black'}`}>
                      {item.title}
                      {isInactive && <span className="ml-2 text-[8px] font-black bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded-full">INATIVO</span>}
                    </div>
                    
                    <div className={`text-[9px] font-bold uppercase tracking-widest ${isInactive ? 'text-gray-300' : 'text-gray-400'}`}>
                      {isInactive ? 'INDISPONÍVEL NO MOMENTO' : item.subtitle}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
