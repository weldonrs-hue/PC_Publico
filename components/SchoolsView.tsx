'use client';

import { useState } from 'react';
import { Presentation, ChevronLeft } from 'lucide-react';
import { motion } from 'motion/react';
import PioneerSchoolView from './PioneerSchoolView';

interface SchoolsViewProps {
  userId: string;
  onBack: () => void;
  congregations: any[];
  personalData: any;
}

const schools = [
  {
    id: 'pioneer',
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

export default function SchoolsView({ userId, onBack, congregations, personalData }: SchoolsViewProps) {
  const [activeSchool, setActiveSchool] = useState<string | null>(null);

  if (activeSchool === 'pioneer') {
    return (
      <PioneerSchoolView 
        userId={userId}
        onBack={() => setActiveSchool(null)}
        congregations={congregations}
        defaultCircuit={personalData?.circuito || ''}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button 
          onClick={onBack}
          className="p-2 hover:bg-gray-100 rounded-full transition-all text-[#512da8] bg-white shadow-md border border-gray-200"
          title="Voltar ao Painel"
        >
          <ChevronLeft size={28} strokeWidth={3} />
        </button>
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
            onClick={() => setActiveSchool(school.id)}
            className="flex bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all cursor-pointer h-24 border border-gray-100 group"
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
