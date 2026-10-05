'use client';

import { Calendar, ChevronRight, Landmark, Store, UserCheck, Users } from 'lucide-react';
import { motion } from 'motion/react';

interface EventsViewProps {
  userId: string;
  acceptedCongressInvites?: any[];
  onBack: () => void;
  onViewChange: (view: any) => void;
}

const events = [
  {
    id: 'circuit_assembly_supt',
    title: 'Assembleia com o Viajante',
    subtitle: 'Assembleia de Circuito com o Superintendente de Circuito',
    badge: 'Superintendente de Circuito',
    color: '#F59E0B', // Amber
    gradient: 'from-amber-500 to-orange-600',
    iconBg: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    icon: Store,
    inactive: false
  },
  {
    id: 'circuit_assembly_branch',
    title: 'Assembleia com Representante',
    subtitle: 'Assembleia de Circuito com o Representante de Betel',
    badge: 'Representante de Betel',
    color: '#F43F5E', // Rose
    gradient: 'from-rose-500 to-pink-600',
    iconBg: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
    icon: Store,
    inactive: false
  },
  {
    id: 'regional_convention',
    title: 'Congresso Regional',
    subtitle: 'Programação de 3 dias, oradores, séries e designações',
    badge: '3 Dias de Evento',
    color: '#10B981', // Emerald
    gradient: 'from-emerald-500 to-teal-600',
    iconBg: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    icon: Landmark,
    inactive: false
  },
  {
    id: 'special_meeting',
    title: 'Reunião Especial com Pioneiros',
    subtitle: 'Pioneiros especiais, regulares e missionários em campo',
    badge: 'Reunião Especial',
    color: '#8B5CF6', // Violet
    gradient: 'from-violet-500 to-purple-600',
    iconBg: 'bg-violet-500/10 text-violet-500 border-violet-500/20',
    icon: Users,
    inactive: false
  },
];

export default function EventsView({ userId, acceptedCongressInvites = [], onBack, onViewChange }: EventsViewProps) {
  const handleEventClick = (event: typeof events[0]) => {
    if (event.inactive) return;
    
    if (event.id === 'regional_convention') {
      onViewChange('regional_convention_program');
    } else if (event.id === 'circuit_assembly_supt') {
      onViewChange('circuit_assembly_supt_program');
    } else if (event.id === 'circuit_assembly_branch') {
      onViewChange('circuit_assembly_branch_program');
    } else if (event.id === 'special_meeting') {
      onViewChange('special_pioneer_meeting_program');
    }
  };

  return (
    <div className="space-y-8 pb-20">
      {/* Cabeçalho da Página */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-primary-200/10 text-primary-200 border border-primary-200/20">
              <Calendar size={20} />
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-typography-900 tracking-tight">
              Eventos do Circuito
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-typography-500">
            Gerencie as programações oficiais, oradores e designações de cada evento.
          </p>
        </div>
      </div>

      {/* Grid de Eventos Principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
        {events.map((event, index) => {
          const Icon = event.icon;

          return (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.06 }}
              onClick={() => handleEventClick(event)}
              className={`group relative flex flex-col justify-between p-5 sm:p-6 rounded-3xl bg-surface-100 border border-surface-300 hover:border-primary-200/40 shadow-xs hover:shadow-xl transition-all duration-300 overflow-hidden ${
                event.inactive 
                  ? 'cursor-not-allowed opacity-60' 
                  : 'cursor-pointer hover:-translate-y-0.5'
              }`}
            >
              {/* Brilho decorativo no canto */}
              <div 
                className="absolute -top-16 -right-16 w-32 h-32 rounded-full blur-3xl opacity-10 group-hover:opacity-25 transition-opacity pointer-events-none"
                style={{ backgroundColor: event.color }}
              />

              {/* Barra superior de destaque sutil */}
              <div 
                className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r opacity-80 group-hover:opacity-100 transition-opacity"
                style={{ backgroundImage: `linear-gradient(to right, ${event.color}, transparent)` }}
              />

              <div className="space-y-4">
                {/* Top Row: Icon + Badge */}
                <div className="flex items-start justify-between gap-3">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border shadow-xs transition-transform duration-300 group-hover:scale-105 ${event.iconBg}`}>
                    <Icon size={24} />
                  </div>

                  <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-surface-200 text-typography-500 border border-surface-300">
                    {event.badge}
                  </span>
                </div>

                {/* Título & Descrição */}
                <div className="space-y-1">
                  <h3 className="text-base sm:text-lg font-black text-typography-900 group-hover:text-primary-200 transition-colors">
                    {event.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-typography-500 leading-relaxed">
                    {event.subtitle}
                  </p>
                </div>
              </div>

              {/* Rodapé do Card com CTA */}
              <div className="pt-4 mt-4 border-t border-surface-300/60 flex items-center justify-between text-xs font-bold text-typography-500 group-hover:text-primary-200 transition-colors">
                <span className="tracking-wide">
                  {event.inactive ? 'Em breve' : 'Acessar Programação'}
                </span>
                <div className="w-7 h-7 rounded-full bg-surface-200 group-hover:bg-primary-200/10 flex items-center justify-center transition-all group-hover:translate-x-1">
                  <ChevronRight size={15} />
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Seção de Congressos Compartilhados (Assistente) */}
      {acceptedCongressInvites.length > 0 && (
        <div className="space-y-4 pt-4 border-t border-surface-300">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-violet-500/10 text-violet-500 border border-violet-500/20">
              <UserCheck size={18} />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-typography-900 tracking-tight">
                Congressos Compartilhados (Assistente)
              </h3>
              <p className="text-xs text-typography-500">
                Congressos aos quais você foi convidado como colaborador ou assistente.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {acceptedCongressInvites.map((inv, index) => (
              <motion.div
                key={inv.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.08 }}
                onClick={() => onViewChange(`regional_convention_guest:${inv.ownerId}`)}
                className="group relative flex items-center justify-between p-4 sm:p-5 rounded-2xl bg-surface-100 border border-surface-300 hover:border-violet-500/40 shadow-xs hover:shadow-lg transition-all duration-300 cursor-pointer hover:-translate-y-0.5"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-violet-500/10 text-violet-500 border border-violet-500/20 shrink-0">
                    <Landmark size={20} />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm font-bold text-typography-900 truncate group-hover:text-violet-500 transition-colors">
                      Congresso de: {inv.ownerName}
                    </h4>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-violet-400">
                      Acesso Assistente
                    </span>
                  </div>
                </div>

                <div className="w-7 h-7 rounded-full bg-surface-200 group-hover:bg-violet-500/10 flex items-center justify-center transition-all group-hover:translate-x-1 text-typography-400 group-hover:text-violet-500 shrink-0">
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
