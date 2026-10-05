'use client';

import { useState, useEffect } from 'react';
import { Presentation, GraduationCap, Users, ArrowRight, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
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
    title: 'Escola do Serviço de Pioneiro',
    shortCode: 'E.S.P.',
    color: '#10B981', // Emerald
    gradient: 'from-emerald-500 to-teal-600',
    icon: GraduationCap,
    inactive: false,
    description: 'Gestão de turmas, oradores e cartas de designação para a Escola de Pioneiros.'
  },
  {
    id: 'emr_ancians_program',
    title: 'Escola do Ministério do Reino',
    subtitle: 'Turmas de Anciãos',
    shortCode: 'E.M.R.',
    color: '#37616b', // Blue-gray
    gradient: 'from-[#37616b] to-[#2c4d55]',
    icon: Presentation,
    inactive: false,
    description: 'Programação completa de 2027 para os corpos de anciãos do circuito.'
  },
  {
    id: 'emr_servants_program',
    title: 'Escola do Ministério do Reino',
    subtitle: 'Turmas de Servos Ministeriais',
    shortCode: 'E.M.R.',
    color: '#6366F1', // Indigo
    gradient: 'from-indigo-600 to-violet-700',
    icon: Presentation,
    inactive: false,
    description: 'Programação completa de 2027 para os servos ministeriais do circuito.'
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
    if (isPioneer) return false; // Pioneiros apenas visualizam convites como instrutores
    return true;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header com Design System */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface-100 p-4 sm:p-5 rounded-3xl border border-surface-300 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 sm:p-3 rounded-2xl bg-primary-200/10 text-primary-200 border border-primary-200/20 shadow-xs shrink-0">
            <GraduationCap size={24} strokeWidth={2.5} />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-typography-900 tracking-tight leading-tight">
              Escolas Teocráticas
            </h2>
            <p className="text-xs sm:text-sm text-typography-500 font-medium">
              Programação, turmas e documentos das escolas do circuito
            </p>
          </div>
        </div>
      </div>

      {/* Grid de Escolas Principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
        {visibleSchools.map((school, index) => (
          <motion.div
            key={school.id}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.08 }}
            onClick={() => {
              if (!school.inactive) {
                onViewChange(school.id);
              }
            }}
            className={`relative group rounded-3xl transition-all duration-300 ${
              school.inactive 
                ? 'cursor-not-allowed grayscale-[0.8] opacity-60' 
                : 'cursor-pointer hover:-translate-y-1'
            }`}
          >
            {/* Glow sutil ao passar o cursor */}
            {!school.inactive && (
              <div 
                className="absolute -inset-0.5 blur-lg opacity-15 group-hover:opacity-35 transition-opacity duration-500 rounded-3xl pointer-events-none"
                style={{ backgroundColor: school.color }}
              />
            )}
            
            <div className="relative flex flex-col justify-between bg-surface-100 rounded-3xl p-5 shadow-xs border border-surface-300 group-hover:border-primary-200/40 transition-all duration-300 h-full overflow-hidden">
              {/* Linha decorativa no topo */}
              <div 
                className={`absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r ${school.gradient}`} 
              />

              <div className="space-y-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div 
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 shadow-md ${
                      school.inactive 
                        ? 'bg-surface-200 text-typography-400' 
                        : `bg-gradient-to-br ${school.gradient} group-hover:scale-105 text-white`
                    }`}
                  >
                    <school.icon size={22} strokeWidth={2.3} className="drop-shadow-sm" />
                  </div>

                  <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-surface-200 text-typography-600 border border-surface-300">
                    {school.shortCode}
                  </span>
                </div>

                <div>
                  <h3 className="font-black text-sm sm:text-base text-typography-900 group-hover:text-primary-200 transition-colors leading-snug">
                    {school.title}
                  </h3>
                  {school.subtitle && (
                    <p className="text-xs font-bold text-primary-200 mt-0.5">
                      {school.subtitle}
                    </p>
                  )}
                  <p className="text-xs text-typography-500 font-medium mt-1.5 line-clamp-2 leading-relaxed">
                    {school.description}
                  </p>
                </div>
              </div>

              {/* Botão de Acesso na base */}
              <div className="pt-4 mt-3 border-t border-surface-300/70 flex items-center justify-between text-xs font-bold text-typography-600 group-hover:text-primary-200 transition-colors">
                <span>Acessar Programação</span>
                <div className="w-7 h-7 rounded-xl bg-surface-200 group-hover:bg-primary-200 group-hover:text-white flex items-center justify-center transition-all">
                  <ArrowRight size={14} />
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Escolas Compartilhadas (Instrutor Convidado) */}
      {guestSchools.length > 0 && (
        <div className="space-y-4 pt-4">
          <div className="flex items-center gap-2.5 px-1">
            <div className="bg-[#37616b]/15 p-2 rounded-xl text-[#37616b]">
              <Users size={18} strokeWidth={2.5} />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-typography-900 tracking-tight leading-tight">
                Escolas Compartilhadas
              </h3>
              <p className="text-xs text-typography-500 font-medium">
                Turmas em que você atua como instrutor colaborador
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {guestSchools.map((gs, index) => (
              <motion.div
                key={gs.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.08 }}
                onClick={() => onViewChange(`pioneer_school_guest:${gs.ownerId}:${gs.turma}`)}
                className="relative group rounded-3xl transition-all duration-300 cursor-pointer hover:-translate-y-1"
              >
                <div className="relative flex items-center justify-between bg-surface-100 rounded-3xl p-4 shadow-xs border border-surface-300 group-hover:border-[#37616b]/50 transition-all duration-300 h-full overflow-hidden">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-gradient-to-br from-[#37616b] to-[#2c4d55] text-white shadow-md shrink-0">
                      <Users size={22} strokeWidth={2.5} />
                    </div>
                    <div className="min-w-0 pr-2">
                      <div className="font-black text-xs sm:text-sm text-typography-900 leading-tight truncate group-hover:text-[#37616b] transition-colors">
                        E.S.P. • Turma {gs.turma}
                      </div>
                      <div className="text-[11px] font-bold text-[#37616b] truncate mt-0.5">
                        Instrutor: {gs.ownerName}
                      </div>
                    </div>
                  </div>

                  <div className="w-7 h-7 rounded-xl bg-surface-200 group-hover:bg-[#37616b] group-hover:text-white flex items-center justify-center transition-all shrink-0">
                    <ArrowRight size={14} />
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
