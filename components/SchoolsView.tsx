'use client';

import { useState, useEffect } from 'react';
import { Presentation, GraduationCap, ChevronRight, UserCheck } from 'lucide-react';
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
    subtitle: 'Gestão de turmas, oradores e cartas de designação para os pioneiros.',
    badge: 'E.S.P.',
    color: '#10B981', // Emerald
    iconBorder: 'border-emerald-500/40 dark:border-emerald-400/50',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    icon: GraduationCap,
    inactive: false,
  },
  {
    id: 'emr_ancians_program',
    title: 'Escola do Ministério do Reino',
    subtitle: 'Programação de 2027 para os corpos de anciãos do circuito.',
    badge: 'Anciãos (E.M.R.)',
    color: '#37616b', // Blue-gray
    iconBorder: 'border-[#37616b]/40 dark:border-[#528996]/50',
    iconColor: 'text-[#37616b] dark:text-[#528996]',
    icon: Presentation,
    inactive: false,
  },
  {
    id: 'emr_servants_program',
    title: 'Escola do Ministério do Reino',
    subtitle: 'Programação de 2027 para os servos ministeriais do circuito.',
    badge: 'Servos (E.M.R.)',
    color: '#6366F1', // Indigo
    iconBorder: 'border-indigo-500/40 dark:border-indigo-400/50',
    iconColor: 'text-indigo-600 dark:text-indigo-400',
    icon: Presentation,
    inactive: false,
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
    <div className="space-y-8 pb-20">
      {/* Cabeçalho da Página — Idêntico a EventsView */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-transparent border border-primary-200/40 dark:border-primary-200/50 text-primary-200 flex items-center justify-center shrink-0">
              <GraduationCap size={20} strokeWidth={1.8} />
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-typography-900 tracking-tight">
              Escolas Teocráticas
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-typography-500">
            Gerencie as programações oficiais, turmas e documentos das escolas do circuito.
          </p>
        </div>
      </div>

      {/* Grid de Escolas Principais — Idêntico a EventsView */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
        {visibleSchools.map((school, index) => {
          const Icon = school.icon;

          return (
            <motion.div
              key={school.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.06 }}
              onClick={() => {
                if (!school.inactive) {
                  onViewChange(school.id);
                }
              }}
              className={`group relative flex flex-col justify-between p-5 sm:p-6 rounded-3xl bg-surface-100 border border-surface-300 hover:border-primary-200/40 shadow-xs hover:shadow-xl transition-all duration-300 overflow-hidden ${
                school.inactive 
                  ? 'cursor-not-allowed opacity-60' 
                  : 'cursor-pointer hover:-translate-y-0.5'
              }`}
            >
              {/* Brilho decorativo no canto */}
              <div 
                className="absolute -top-16 -right-16 w-32 h-32 rounded-full blur-3xl opacity-10 group-hover:opacity-25 transition-opacity pointer-events-none"
                style={{ backgroundColor: school.color }}
              />

              {/* Barra superior de destaque sutil */}
              <div 
                className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r opacity-80 group-hover:opacity-100 transition-opacity"
                style={{ backgroundImage: `linear-gradient(to right, ${school.color}, transparent)` }}
              />

              <div className="space-y-4">
                {/* Top Row: Icon + Badge */}
                <div className="flex items-start justify-between gap-3">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${school.iconBorder} ${school.iconColor} bg-transparent transition-all duration-300 group-hover:scale-105 group-hover:bg-surface-200/50`}>
                    <Icon size={24} strokeWidth={1.8} />
                  </div>

                  <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-surface-200 text-typography-500 border border-surface-300">
                    {school.badge}
                  </span>
                </div>

                {/* Título & Descrição */}
                <div className="space-y-1">
                  <h3 className="text-base sm:text-lg font-black text-typography-900 group-hover:text-primary-200 transition-colors">
                    {school.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-typography-500 leading-relaxed">
                    {school.subtitle}
                  </p>
                </div>
              </div>

              {/* Rodapé do Card com CTA */}
              <div className="pt-4 mt-4 border-t border-surface-300/60 flex items-center justify-between text-xs font-bold text-typography-500 group-hover:text-primary-200 transition-colors">
                <span className="tracking-wide">
                  {school.inactive ? 'Em breve' : 'Acessar Programação'}
                </span>
                <div className="w-7 h-7 rounded-full bg-surface-200 group-hover:bg-primary-200/10 flex items-center justify-center transition-all group-hover:translate-x-1">
                  <ChevronRight size={15} />
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Seção de Escolas Compartilhadas (Instrutor Convidado) */}
      {guestSchools.length > 0 && (
        <div className="space-y-4 pt-4 border-t border-surface-300">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-transparent border border-[#37616b]/40 dark:border-[#528996]/50 text-[#37616b] dark:text-[#528996] flex items-center justify-center shrink-0">
              <UserCheck size={17} strokeWidth={1.8} />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-typography-900 tracking-tight">
                Escolas Compartilhadas (Instrutor Convidado)
              </h3>
              <p className="text-xs text-typography-500">
                Turmas em que você foi cadastrado como instrutor colaborador.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {guestSchools.map((gs, index) => (
              <motion.div
                key={gs.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.08 }}
                onClick={() => onViewChange(`pioneer_school_guest:${gs.ownerId}:${gs.turma}`)}
                className="group relative flex items-center justify-between p-4 sm:p-5 rounded-2xl bg-surface-100 border border-surface-300 hover:border-[#37616b]/40 shadow-xs hover:shadow-lg transition-all duration-300 cursor-pointer hover:-translate-y-0.5"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-transparent border border-[#37616b]/40 dark:border-[#528996]/50 text-[#37616b] dark:text-[#528996] transition-all group-hover:scale-105 group-hover:bg-surface-200/50 shrink-0">
                    <GraduationCap size={20} strokeWidth={1.8} />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm font-bold text-typography-900 truncate group-hover:text-[#37616b] transition-colors">
                      E.S.P. • Turma {gs.turma}
                    </h4>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#37616b]">
                      Instrutor: {gs.ownerName}
                    </span>
                  </div>
                </div>

                <div className="w-7 h-7 rounded-full bg-surface-200 group-hover:bg-[#37616b]/10 flex items-center justify-center transition-all group-hover:translate-x-1 text-typography-400 group-hover:text-[#37616b] shrink-0">
                  <ChevronRight size={15} />
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
