'use client';

import { FileText, Shapes } from 'lucide-react';
import { motion } from 'motion/react';

interface MiscViewProps {
  onViewChange: (view: string) => void;
}

const miscItems = [
  {
    id: 'text_editor',
    title: 'EDITOR DE TEXTO',
    subtitle: 'TIPO WORD COM FUNÇÕES ESSENCIAIS',
    color: '#8B5CF6', // Violet
    gradient: 'from-violet-500 to-indigo-600',
    icon: FileText,
  },
];

export default function MiscView({ onViewChange }: MiscViewProps) {
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
        {miscItems.map((item, index) => (
          <motion.div
            key={item.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            onClick={() => onViewChange(item.id)}
            className="relative group h-28 cursor-pointer"
          >
            {/* Background Glow */}
            <div 
              className="absolute -inset-0.5 blur-md opacity-20 group-hover:opacity-40 transition-opacity duration-500 rounded-[2rem]"
              style={{ backgroundColor: item.color }}
            />
            
            <div className="relative flex bg-white rounded-3xl overflow-hidden shadow-lg border border-gray-100 hover:border-transparent transition-all duration-300 h-full group">
              {/* Vibrant Vertical Accent */}
              <div className={`w-2 h-full bg-gradient-to-b ${item.gradient} opacity-40 group-hover:opacity-100 transition-opacity`}></div>
              
              <div className="flex-1 flex items-center px-6 gap-6">
                <div 
                  className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-500 shadow-lg shadow-black/5 bg-gradient-to-br ${item.gradient} group-hover:scale-110 group-hover:rotate-3`}
                >
                  <item.icon size={30} strokeWidth={2.5} className="text-white drop-shadow-md" />
                </div>

                <div className="text-left flex flex-col justify-center overflow-hidden pr-2">
                  <div className="font-black text-xs md:text-sm leading-tight text-gray-900 uppercase mb-1 group-hover:text-black transition-colors">
                    {item.title}
                  </div>
                  
                  <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                    {item.subtitle}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
