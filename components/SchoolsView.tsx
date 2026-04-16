'use client';

import { useState } from 'react';
import { Presentation, ChevronLeft } from 'lucide-react';
import { motion } from 'motion/react';
import PioneerSchoolView from './PioneerSchoolView';

interface SchoolsViewProps {
  userId: string;
  onBack: () => void;
  onViewChange: (view: string) => void;
  congregations: any[];
  personalData: any;
}

const schools = [
  {
    id: 'pioneer_school',
    title: 'ESCOLA DO SERVIÇO DE PIONEIRO',
    color: '#7C3AED',
    icon: Presentation,
    inactive: false
  },
  {
    id: 'elders',
    title: 'ESCOLA DO MINISTÉRIO DO REINO PARA ANCIÃOS',
    color: '#8B5CF6',
    icon: Presentation,
    inactive: true
  },
  {
    id: 'servants',
    title: 'ESCOLA DO MINISTÉRIO DO REINO PARA SERVOS',
    color: '#A78BFA',
    icon: Presentation,
    inactive: true
  },
];

export default function SchoolsView({ userId, onBack, onViewChange, congregations, personalData }: SchoolsViewProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-800 tracking-tight">
          Escolas Teocráticas
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {schools.map((school, index) => (
          <motion.div
            key={school.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            onClick={() => {
              if (!school.inactive) {
                onViewChange(school.id);
              }
            }}
            className={`relative group h-28 ${
              school.inactive 
                ? 'cursor-not-allowed grayscale-[0.5] opacity-60' 
                : 'cursor-pointer'
            }`}
          >
            {/* Background Glow */}
            {!school.inactive && (
              <div 
                className="absolute inset-0 blur-xl opacity-0 group-hover:opacity-10 transition-opacity duration-500 rounded-3xl"
                style={{ backgroundColor: school.color }}
              />
            )}
            
            <div className="relative flex bg-white/80 backdrop-blur-sm rounded-3xl overflow-hidden shadow-sm border border-white hover:border-violet-100 hover:bg-white transition-all duration-300 h-full group">
              <div className="w-1.5 h-full opacity-30 group-hover:opacity-100 transition-opacity" style={{ backgroundColor: school.inactive ? '#9ca3af' : school.color }}></div>
              <div className="flex-1 flex items-center px-6 gap-6">
                <div 
                  className="w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300 group-hover:scale-105"
                  style={{ backgroundColor: `${school.color}10`, color: school.inactive ? '#9ca3af' : school.color }}
                >
                  <school.icon size={26} strokeWidth={2.5} />
                </div>
                <div className="text-left flex flex-col justify-center overflow-hidden">
                  <div className="font-black text-[11px] leading-tight tracking-[0.05em] uppercase text-gray-800">
                    {school.title}
                  </div>
                  {school.inactive && (
                    <span className="text-[9px] font-black text-gray-400 mt-2 uppercase tracking-[0.2em]">
                      Em breve
                    </span>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
