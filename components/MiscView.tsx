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
    color: '#9C27B0',
    icon: FileText,
  },
];

export default function MiscView({ onViewChange }: MiscViewProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="bg-purple-100 p-3 rounded-2xl text-purple-600">
          <Shapes size={24} />
        </div>
        <h2 className="text-2xl font-bold text-gray-800">
          Diversos
        </h2>
      </div>

      <div className="grid grid-cols-1 landscape:grid-cols-2 md:grid-cols-2 gap-6">
        {miscItems.map((item, index) => (
          <motion.div
            key={item.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            onClick={() => onViewChange(item.id)}
            className="flex bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all h-24 border border-gray-100 group cursor-pointer"
          >
            <div className="w-4 h-full flex-shrink-0" style={{ backgroundColor: item.color }}></div>
            <div className="flex-1 flex items-center px-6 gap-6">
              <div className="group-hover:scale-110 transition-transform flex-shrink-0" style={{ color: item.color }}>
                <item.icon size={32} />
              </div>
              <div className="text-left flex flex-col justify-center overflow-hidden">
                <div className="font-extrabold text-sm leading-tight tracking-wider uppercase" style={{ color: item.color }}>
                  {item.title}
                </div>
                <div className="text-[10px] font-bold text-gray-400 mt-1 uppercase tracking-widest">
                  {item.subtitle}
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
