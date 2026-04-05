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
    color: '#4CAF50',
    icon: Presentation,
  },
  {
    id: 'elders',
    title: 'ESCOLA DO MINISTÉRIO DO REINO PARA ANCIÃOS',
    color: '#E67E22',
    icon: Presentation,
  },
  {
    id: 'servants',
    title: 'ESCOLA DO MINISTÉRIO DO REINO PARA SERVOS',
    color: '#C2185B',
    icon: Presentation,
  },
];

export default function SchoolsView({ userId, onBack, onViewChange, congregations, personalData }: SchoolsViewProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-800">
          Escolas Teocráticas
        </h2>
      </div>

      <div className="grid grid-cols-1 landscape:grid-cols-2 md:grid-cols-2 gap-6">
        {schools.map((school, index) => (
          <motion.div
            key={school.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            onClick={() => {
              if (school.id === 'pioneer_school') {
                onViewChange(school.id);
              }
            }}
            className={`flex bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all h-24 border border-gray-100 group ${school.id === 'pioneer_school' ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}
          >
            <div className="w-4 h-full flex-shrink-0" style={{ backgroundColor: school.color }}></div>
            <div className="flex-1 flex items-center px-6 gap-6">
              <div className="group-hover:scale-110 transition-transform flex-shrink-0" style={{ color: school.color }}>
                <school.icon size={32} />
              </div>
              <div className="text-left flex flex-col justify-center overflow-hidden">
                <div className="font-extrabold text-sm leading-tight tracking-wider uppercase" style={{ color: school.color }}>
                  {school.title}
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
