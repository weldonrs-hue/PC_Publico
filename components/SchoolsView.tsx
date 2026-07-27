'use client';

import { useState, useEffect } from 'react';
import { Presentation, ChevronLeft, Users } from 'lucide-react';
import { motion } from 'motion/react';
import PioneerSchoolView from './PioneerSchoolView';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';

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
    color: '#10B981', // Emerald
    gradient: 'from-emerald-500 to-teal-600',
    icon: Presentation,
    inactive: false
  },
  {
    id: 'elders',
    title: 'ESCOLA DO MINISTÉRIO DO REINO PARA ANCIÃOS',
    color: '#F59E0B', // Amber
    gradient: 'from-amber-500 to-orange-600',
    icon: Presentation,
    inactive: true
  },
  {
    id: 'servants',
    title: 'ESCOLA DO MINISTÉRIO DO REINO PARA SERVOS',
    color: '#F43F5E', // Rose
    gradient: 'from-rose-500 to-pink-600',
    icon: Presentation,
    inactive: true
  },
];

export default function SchoolsView({ userId, onBack, onViewChange, congregations, personalData }: SchoolsViewProps) {
  const [guestSchools, setGuestSchools] = useState<any[]>([]);

  useEffect(() => {
    const q = query(
      collection(db, 'pioneer_school_invitations'),
      where('collaboratorId', '==', userId),
      where('status', '==', 'accepted')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setGuestSchools(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => unsubscribe();
  }, [userId]);

  const role = personalData?.role || 'viajante';
  const isPioneer = role === 'pioneiro_especial' || role === 'pioneiro_regular';

  const visibleSchools = schools.filter(s => {
    if (isPioneer) return false; // Pioneers only see guest schools
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-800 tracking-tight">
          Escolas Teocráticas
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {visibleSchools.map((school, index) => (
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
            className={`relative group h-20 ${
              school.inactive 
                ? 'cursor-not-allowed grayscale-[0.8] opacity-60' 
                : 'cursor-pointer'
            }`}
          >
            {/* Background Glow */}
            {!school.inactive && (
              <div 
                className="absolute -inset-0.5 blur-md opacity-20 group-hover:opacity-40 transition-opacity duration-500 rounded-2xl"
                style={{ backgroundColor: school.color }}
              />
            )}
            
            <div className="relative flex bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 hover:border-transparent transition-all duration-300 h-full group">
              <div className={`w-1.5 h-full bg-gradient-to-b ${school.inactive ? 'from-gray-400 to-gray-600' : school.gradient} opacity-40 group-hover:opacity-100 transition-opacity`}></div>
              <div className="flex-1 flex items-center px-4 gap-4">
                <div 
                  className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-500 shadow-lg shadow-black/5 ${
                    school.inactive 
                      ? 'bg-gray-100 text-gray-400' 
                      : `bg-gradient-to-br ${school.gradient} group-hover:scale-105 group-hover:rotate-2`
                  }`}
                >
                  <school.icon size={22} strokeWidth={2.5} className={`${school.inactive ? 'text-gray-300' : 'text-white drop-shadow-md'}`} />
                </div>
                <div className="text-left flex flex-col justify-center overflow-hidden pr-2">
                  <div className={`font-black text-[10px] md:text-xs leading-tight uppercase mb-0.5 transition-colors ${school.inactive ? 'text-gray-400' : 'text-gray-900 group-hover:text-black'}`}>
                    {school.title}
                  </div>
                  {school.inactive ? (
                    <span className="text-[8px] font-black text-violet-500/60 uppercase tracking-[0.3em] font-mono">
                      Em breve
                    </span>
                  ) : (
                    <span className={`text-[8px] font-bold uppercase tracking-widest ${school.inactive ? 'text-gray-300' : 'text-gray-400'}`}>
                      Acessar Agora
                    </span>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Guest Pioneer Schools */}
      {guestSchools.length > 0 && (
        <div className="space-y-6 pt-4">
          <div className="flex items-center gap-2">
            <div className="bg-[#37616b]/10 p-1.5 rounded-lg text-[#37616b]">
              <Users size={18} />
            </div>
            <h3 className="text-lg font-bold text-gray-800 tracking-tight">
              Escolas Compartilhadas
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {guestSchools.map((gs, index) => (
              <motion.div
                key={gs.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                onClick={() => onViewChange(`pioneer_school_guest:${gs.ownerId}:${gs.turma}`)}
                className="relative group h-20 cursor-pointer"
              >
                <div className="absolute -inset-0.5 blur-md opacity-20 group-hover:opacity-40 transition-opacity duration-500 rounded-2xl bg-[#37616b]" />
                
                <div className="relative flex bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 hover:border-transparent transition-all duration-300 h-full group">
                  <div className="w-1.5 h-full bg-gradient-to-b from-[#37616b] to-[#2c4d55] opacity-40 group-hover:opacity-100 transition-opacity"></div>
                  <div className="flex-1 flex items-center px-4 gap-4">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-500 shadow-lg shadow-black/5 bg-gradient-to-br from-[#37616b] to-[#2c4d55] group-hover:scale-105 group-hover:rotate-2">
                      <Users size={22} strokeWidth={2.5} className="text-white drop-shadow-md" />
                    </div>
                    <div className="text-left flex flex-col justify-center overflow-hidden pr-2">
                      <div className="font-black text-[10px] md:text-xs leading-tight uppercase mb-0.5 transition-colors text-gray-900 group-hover:text-black">
                        E.S.P. (Convidado) - Turma {gs.turma}
                      </div>
                      <div className="text-[8px] font-bold uppercase tracking-widest text-[#37616b]">
                        Instrutor: {gs.ownerName}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
