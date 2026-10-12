'use client';

import React, { useState } from 'react';
import { 
  VisitSchedule, 
  FieldServiceRow, 
  StudyVisitRow, 
  MealRow, 
  ShepherdingRow 
} from '@/types/visitSchedule';
import { 
  Users, 
  MapPin, 
  Clock, 
  Calendar, 
  Utensils, 
  Heart, 
  BookOpen, 
  ShieldCheck, 
  Lock,
  Plus,
  Trash2,
  UserCheck,
  Sparkles
} from 'lucide-react';

interface SemanaVisitaFormProps {
  data: VisitSchedule;
  onChange: (updated: VisitSchedule) => void;
  elderMode?: boolean;
}

export default function SemanaVisitaForm({
  data,
  onChange,
  elderMode = false,
}: SemanaVisitaFormProps) {
  const [activeSection, setActiveSection] = useState<string>('geral');

  const update = (updater: (prev: VisitSchedule) => VisitSchedule) => {
    onChange(updater(data));
  };

  const canEdit = (fieldKey: 'midweekMeeting' | 'weekendMeeting' | 'fieldService' | 'meals' | 'shepherding' | 'studies' | 'additionalMeetings' | 'circuitOverseerOnly') => {
    if (!elderMode) return true;
    switch (fieldKey) {
      case 'midweekMeeting':
        return data.permissions?.allowMidweekMeetingTimeEdit ?? true;
      case 'weekendMeeting':
        return data.permissions.allowWeekendMeetingTimeEdit;
      case 'fieldService':
        return data.permissions.allowFieldServiceEdit;
      case 'meals':
        return data.permissions.allowMealsEdit;
      case 'shepherding':
        return data.permissions.allowShepherdingEdit;
      case 'studies':
        return data.permissions.allowStudiesEdit;
      case 'additionalMeetings':
        return data.permissions.allowAdditionalMeetingsEdit;
      case 'circuitOverseerOnly':
        return false;
      default:
        return false;
    }
  };


  // As abas se adaptam dependendo se é o Viajante ou o Ancião
  const tabs = [
    ...(!elderMode ? [{ id: 'geral', label: 'Geral', icon: Users }] : []),
    { id: 'campo', label: 'Campo', icon: MapPin, count: data.fieldService.length },
    { id: 'refeicoes', label: 'Refeições', icon: Utensils, count: data.meals.length },
    { id: 'pastoreio', label: 'Pastoreio', icon: Heart, count: data.shepherding.length },
    { id: 'reunioes', label: 'Reuniões', icon: Calendar },
    { id: 'estudos', label: 'Estudos', icon: BookOpen },
  ];

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4 pb-20">
      {/* NAVEGAÇÃO DE ABAS MÓVEIS (Scroll horizontal confortável) */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 px-1 -mx-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSection === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSection(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold whitespace-nowrap transition-all flex-shrink-0 cursor-pointer ${
                isActive
                  ? 'bg-primary-200 text-white shadow-xs scale-[1.02]'
                  : 'bg-surface-100 text-typography-600 border border-surface-300 hover:bg-surface-200'
              }`}
            >
              <Icon size={15} />
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
                  isActive ? 'bg-white/20 text-white' : 'bg-surface-200 text-typography-600'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 0. DADOS GERAIS DO CASAL E DIAS DA VISITA (Apenas Viajante) */}
      {!elderMode && activeSection === 'geral' && (
        <div className="space-y-4">
          <div className="bg-surface-100 border border-surface-300 rounded-2xl p-4 shadow-xs space-y-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-primary-200 border-b border-surface-300 pb-2 flex items-center gap-2">
              <Users size={16} /> Identificação do Casal e Dias da Visita
            </h3>

            <div className="space-y-1">
              <label className="text-[11px] font-bold uppercase tracking-wider text-typography-500">
                Nome do Casal / Viajante
              </label>
              <input
                type="text"
                placeholder="Ex: Marcelo e Aline"
                value={data.coupleNames}
                onChange={(e) => update((prev) => ({ ...prev, coupleNames: e.target.value }))}
                className="w-full text-xs font-bold p-3 bg-surface-200/50 border border-surface-300 rounded-xl text-typography-900 placeholder:text-typography-400 focus:bg-surface-100 focus:ring-2 focus:ring-primary-200/20 focus:border-primary-200 outline-none transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-typography-500">
                Dias de Atividade na Visita
              </label>
              <div className="grid grid-cols-6 gap-2">
                {(['ter', 'qua', 'qui', 'sex', 'sab', 'dom'] as const).map((dayKey) => {
                  const isChecked = !!data.activeDays[dayKey];
                  return (
                    <button
                      type="button"
                      key={dayKey}
                      onClick={() =>
                        update((prev) => ({
                          ...prev,
                          activeDays: { ...prev.activeDays, [dayKey]: !isChecked },
                        }))
                      }
                      className={`py-2.5 rounded-xl text-xs font-black uppercase transition-all flex flex-col items-center gap-1 cursor-pointer ${
                        isChecked
                          ? 'bg-primary-200 text-white shadow-xs'
                          : 'bg-surface-200 text-typography-400 hover:bg-surface-300'
                      }`}
                    >
                      <span>{dayKey}</span>
                      <span className="text-[9px]">{isChecked ? '✓' : '—'}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 1. SERVIÇO DE CAMPO */}
      {activeSection === 'campo' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <div>
              <h3 className="text-sm font-black text-typography-900 uppercase tracking-tight flex items-center gap-2">
                <MapPin size={16} className="text-primary-200" />
                Saídas de Serviço de Campo
              </h3>
              <p className="text-xs text-typography-500">
                {canEdit('fieldService') 
                  ? 'Preencha os horários e locais de saída de campo para cada dia.' 
                  : 'Definido pelo viajante.'}
              </p>
            </div>
            {!canEdit('fieldService') && (
              <span className="flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
                <Lock size={12} /> Bloqueado
              </span>
            )}
          </div>

          <div className="space-y-3">
            {data.fieldService.map((row, idx) => (
              <div 
                key={row.id || idx}
                className="bg-surface-100 border border-surface-300 rounded-2xl p-4 shadow-xs space-y-3"
              >
                <div className="flex items-center justify-between border-b border-surface-300 pb-2">
                  <div className="flex items-center gap-2">
                    {!elderMode ? (
                      <input
                        type="text"
                        value={row.day}
                        onChange={(e) =>
                          update((prev) => {
                            const updated = [...prev.fieldService];
                            updated[idx] = { ...updated[idx], day: e.target.value };
                            return { ...prev, fieldService: updated };
                          })
                        }
                        className="text-xs font-black uppercase tracking-wider text-primary-200 bg-primary-200/10 px-2 py-0.5 rounded-lg border border-primary-200/20 outline-none w-24"
                      />
                    ) : (
                      <span className="text-xs font-black uppercase tracking-wider text-primary-200 bg-primary-200/10 px-2.5 py-0.5 rounded-lg border border-primary-200/20">
                        {row.day}
                      </span>
                    )}
                    <span className="text-[11px] font-medium text-typography-400">
                      Saída #{idx + 1}
                    </span>
                  </div>

                  {!elderMode && data.fieldService.length > 1 && (
                    <button
                      onClick={() =>
                        update((prev) => ({
                          ...prev,
                          fieldService: prev.fieldService.filter((_, i) => i !== idx),
                        }))
                      }
                      className="text-typography-400 hover:text-red-500 p-1 rounded-lg hover:bg-red-500/10 transition-colors cursor-pointer"
                      title="Remover saída"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div className="sm:col-span-1 space-y-1">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-typography-500 flex items-center gap-1">
                      <Clock size={12} /> Horário
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: 09:00"
                      value={row.time}
                      disabled={!canEdit('fieldService')}
                      onChange={(e) =>
                        update((prev) => {
                          const updated = [...prev.fieldService];
                          updated[idx] = { ...updated[idx], time: e.target.value };
                          return { ...prev, fieldService: updated };
                        })
                      }
                      className="w-full text-xs font-medium p-2.5 bg-surface-200/50 border border-surface-300 rounded-xl text-typography-900 placeholder:text-typography-400 focus:bg-surface-100 focus:ring-2 focus:ring-primary-200/20 focus:border-primary-200 outline-none transition-all disabled:opacity-60"
                    />
                  </div>

                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-typography-500 flex items-center gap-1">
                      <MapPin size={12} /> Local de Saída
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Salão do Reino / Casa do irmão..."
                      value={row.location}
                      disabled={!canEdit('fieldService')}
                      onChange={(e) =>
                        update((prev) => {
                          const updated = [...prev.fieldService];
                          updated[idx] = { ...updated[idx], location: e.target.value };
                          return { ...prev, fieldService: updated };
                        })
                      }
                      className="w-full text-xs font-medium p-2.5 bg-surface-200/50 border border-surface-300 rounded-xl text-typography-900 placeholder:text-typography-400 focus:bg-surface-100 focus:ring-2 focus:ring-primary-200/20 focus:border-primary-200 outline-none transition-all disabled:opacity-60"
                    />
                  </div>
                </div>
              </div>
            ))}

            {!elderMode && (
              <button
                onClick={() =>
                  update((prev) => ({
                    ...prev,
                    fieldService: [
                      ...prev.fieldService,
                      { id: Date.now().toString(), day: 'Sábado', time: '09:00', location: '' },
                    ],
                  }))
                }
                className="w-full py-3 border-2 border-dashed border-primary-200/30 hover:border-primary-200 bg-primary-200/5 hover:bg-primary-200/10 text-primary-200 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Plus size={16} /> Adicionar Saída de Campo
              </button>
            )}
          </div>
        </div>
      )}

      {/* 2. REFEIÇÕES */}
      {activeSection === 'refeicoes' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <div>
              <h3 className="text-sm font-black text-typography-900 uppercase tracking-tight flex items-center gap-2">
                <Utensils size={16} className="text-rose-500 dark:text-rose-400" />
                Refeições (Almoços)
              </h3>
              <p className="text-xs text-typography-500">
                Informe o irmão/família anfitriã e o endereço com telefone.
              </p>
            </div>
            {!canEdit('meals') && (
              <span className="flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
                <Lock size={12} /> Bloqueado
              </span>
            )}
          </div>

          {/* CAMPO DE HORÁRIO DA REFEIÇÃO CONFIGURÁVEL PELO VIAJANTE */}
          {!elderMode ? (
            <div className="bg-surface-200/50 border border-surface-300 rounded-2xl p-3.5 flex items-center justify-between gap-3">
              <div>
                <label className="text-xs font-bold text-typography-900 block">
                  Horário Padrão das Refeições
                </label>
                <p className="text-[11px] text-typography-500">
                  Defina o horário que prefere almoçar durante a semana da visita.
                </p>
              </div>
              <div className="flex items-center gap-1 bg-surface-100 border border-surface-300 rounded-xl px-2.5 py-1.5 shadow-2xs">
                <Clock size={14} className="text-rose-500 dark:text-rose-400" />
                <input
                  type="text"
                  placeholder="(11:30)"
                  value={data.mealsHeaderTime || ''}
                  onChange={(e) => update((prev) => ({ ...prev, mealsHeaderTime: e.target.value }))}
                  className="w-16 text-xs font-black text-rose-600 dark:text-rose-400 outline-none bg-transparent text-center"
                />
              </div>
            </div>
          ) : (
            <div className="bg-surface-200/50 border border-surface-300 rounded-2xl p-3 flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-typography-900 flex items-center gap-1.5">
                <Clock size={14} className="text-rose-500 dark:text-rose-400" />
                Horário da Refeição (Definido pelo Viajante):
              </span>
              <span className="text-xs font-black text-rose-600 dark:text-rose-400 bg-surface-100 px-2.5 py-1 rounded-lg border border-surface-300 shadow-2xs">
                {data.mealsHeaderTime || '(11:30)'}
              </span>
            </div>
          )}


          <div className="space-y-3">
            {data.meals.map((row, idx) => (
              <div 
                key={row.id || idx}
                className="bg-surface-100 border border-surface-300 rounded-2xl p-4 shadow-xs space-y-3"
              >
                <div className="flex items-center justify-between border-b border-surface-300 pb-2">
                  <div className="flex items-center gap-2">
                    {!elderMode ? (
                      <input
                        type="text"
                        value={row.day}
                        onChange={(e) =>
                          update((prev) => {
                            const updated = [...prev.meals];
                            updated[idx] = { ...updated[idx], day: e.target.value };
                            return { ...prev, meals: updated };
                          })
                        }
                        className="text-xs font-black uppercase tracking-wider text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-lg border border-rose-500/20 outline-none w-24"
                      />
                    ) : (
                      <span className="text-xs font-black uppercase tracking-wider text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2.5 py-0.5 rounded-lg border border-rose-500/20">
                        {row.day}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] font-semibold text-typography-400">
                    Almoço {data.mealsHeaderTime || '(11:30)'}
                  </span>
                </div>

                <div className="space-y-2.5">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-typography-500">
                      Anfitrião / Família
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Família Silva"
                      value={row.host}
                      disabled={!canEdit('meals')}
                      onChange={(e) =>
                        update((prev) => {
                          const updated = [...prev.meals];
                          updated[idx] = { ...updated[idx], host: e.target.value };
                          return { ...prev, meals: updated };
                        })
                      }
                      className="w-full text-xs font-medium p-2.5 bg-surface-200/50 border border-surface-300 rounded-xl text-typography-900 placeholder:text-typography-400 focus:bg-surface-100 focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none transition-all disabled:opacity-60"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-typography-500">
                      Endereço e Telefone de Contato
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Rua das Flores, 123 - Tel: (11) 98888-7777"
                      value={row.addressPhone}
                      disabled={!canEdit('meals')}
                      onChange={(e) =>
                        update((prev) => {
                          const updated = [...prev.meals];
                          updated[idx] = { ...updated[idx], addressPhone: e.target.value };
                          return { ...prev, meals: updated };
                        })
                      }
                      className="w-full text-xs font-medium p-2.5 bg-surface-200/50 border border-surface-300 rounded-xl text-typography-900 placeholder:text-typography-400 focus:bg-surface-100 focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none transition-all disabled:opacity-60"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. VISITAS DE PASTOREIO */}
      {activeSection === 'pastoreio' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <div>
              <h3 className="text-sm font-black text-typography-900 uppercase tracking-tight flex items-center gap-2">
                <Heart size={16} className="text-primary-200" />
                Visitas de Pastoreio
              </h3>
              <p className="text-xs text-typography-500">
                Organize as famílias que receberão visita junto com o superintendente.
              </p>
            </div>
            {!canEdit('shepherding') && (
              <span className="flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
                <Lock size={12} /> Bloqueado
              </span>
            )}
          </div>

          <div className="space-y-3">
            {data.shepherding.map((row, idx) => (
              <div 
                key={row.id || idx}
                className="bg-surface-100 border border-surface-300 rounded-2xl p-4 shadow-xs space-y-3"
              >
                <div className="flex items-center justify-between border-b border-surface-300 pb-2">
                  <span className="text-xs font-bold text-typography-800">
                    Visita #{idx + 1}
                  </span>
                  {canEdit('shepherding') && data.shepherding.length > 1 && (
                    <button
                      onClick={() =>
                        update((prev) => ({
                          ...prev,
                          shepherding: prev.shepherding.filter((_, i) => i !== idx),
                        }))
                      }
                      className="text-typography-400 hover:text-red-500 p-1 rounded-lg hover:bg-red-500/10 transition-colors cursor-pointer"
                      title="Remover"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-typography-500">
                      Dia e Horário
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Quinta - 15:00"
                      value={row.dateTime}
                      disabled={!canEdit('shepherding')}
                      onChange={(e) =>
                        update((prev) => {
                          const updated = [...prev.shepherding];
                          updated[idx] = { ...updated[idx], dateTime: e.target.value };
                          return { ...prev, shepherding: updated };
                        })
                      }
                      className="w-full text-xs font-medium p-2.5 bg-surface-200/50 border border-surface-300 rounded-xl text-typography-900 placeholder:text-typography-400 focus:bg-surface-100 focus:ring-2 focus:ring-primary-200/20 focus:border-primary-200 outline-none transition-all disabled:opacity-60"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-typography-500">
                      Família / Publicador
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Família Souza"
                      value={row.family}
                      disabled={!canEdit('shepherding')}
                      onChange={(e) =>
                        update((prev) => {
                          const updated = [...prev.shepherding];
                          updated[idx] = { ...updated[idx], family: e.target.value };
                          return { ...prev, shepherding: updated };
                        })
                      }
                      className="w-full text-xs font-medium p-2.5 bg-surface-200/50 border border-surface-300 rounded-xl text-typography-900 placeholder:text-typography-400 focus:bg-surface-100 focus:ring-2 focus:ring-primary-200/20 focus:border-primary-200 outline-none transition-all disabled:opacity-60"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-typography-500">
                      Acompanhante
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Ancião local"
                      value={row.companion}
                      disabled={!canEdit('shepherding')}
                      onChange={(e) =>
                        update((prev) => {
                          const updated = [...prev.shepherding];
                          updated[idx] = { ...updated[idx], companion: e.target.value };
                          return { ...prev, shepherding: updated };
                        })
                      }
                      className="w-full text-xs font-medium p-2.5 bg-surface-200/50 border border-surface-300 rounded-xl text-typography-900 placeholder:text-typography-400 focus:bg-surface-100 focus:ring-2 focus:ring-primary-200/20 focus:border-primary-200 outline-none transition-all disabled:opacity-60"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-typography-500">
                      Situação / Motivo
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Encorajamento, luto..."
                      value={row.situation}
                      disabled={!canEdit('shepherding')}
                      onChange={(e) =>
                        update((prev) => {
                          const updated = [...prev.shepherding];
                          updated[idx] = { ...updated[idx], situation: e.target.value };
                          return { ...prev, shepherding: updated };
                        })
                      }
                      className="w-full text-xs font-medium p-2.5 bg-surface-200/50 border border-surface-300 rounded-xl text-typography-900 placeholder:text-typography-400 focus:bg-surface-100 focus:ring-2 focus:ring-primary-200/20 focus:border-primary-200 outline-none transition-all disabled:opacity-60"
                    />
                  </div>
                </div>
              </div>
            ))}

            {canEdit('shepherding') && (
              <button
                onClick={() =>
                  update((prev) => ({
                    ...prev,
                    shepherding: [
                      ...prev.shepherding,
                      { id: Date.now().toString(), dateTime: '', family: '', companion: '', situation: '' },
                    ],
                  }))
                }
                className="w-full py-3 border-2 border-dashed border-primary-200/30 hover:border-primary-200 bg-primary-200/5 hover:bg-primary-200/10 text-primary-200 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Plus size={16} /> Adicionar Visita de Pastoreio
              </button>
            )}
          </div>
        </div>
      )}

      {/* 4. REUNIÕES */}
      {activeSection === 'reunioes' && (
        <div className="space-y-4">
          {/* REUNIÃO MEIO DE SEMANA */}
          <div className="bg-surface-100 border border-surface-300 rounded-2xl p-4 shadow-xs space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-primary-200 border-b border-surface-300 pb-2">
              Reunião do Meio de Semana
            </h4>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-typography-500">
                  Horário
                </label>
                <input
                  type="text"
                  placeholder="Ex: 19:30"
                  value={data.meetings.midweek.time}
                  disabled={!canEdit('midweekMeeting')}
                  onChange={(e) =>
                    update((prev) => ({
                      ...prev,
                      meetings: {
                        ...prev.meetings,
                        midweek: { ...prev.meetings.midweek, time: e.target.value },
                      },
                    }))
                  }
                  className="w-full text-xs font-medium p-2.5 bg-surface-200/50 border border-surface-300 rounded-xl text-typography-900 placeholder:text-typography-400 focus:bg-surface-100 focus:ring-2 focus:ring-primary-200/20 focus:border-primary-200 outline-none transition-all disabled:opacity-75"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-typography-500">
                  Oração Final (Irmão)
                </label>
                <input
                  type="text"
                  placeholder="Nome do irmão"
                  value={data.meetings.midweek.finalPrayerBrother}
                  disabled={!canEdit('weekendMeeting')}
                  onChange={(e) =>
                    update((prev) => ({
                      ...prev,
                      meetings: {
                        ...prev.meetings,
                        midweek: { ...prev.meetings.midweek, finalPrayerBrother: e.target.value },
                      },
                    }))
                  }
                  className="w-full text-xs font-medium p-2.5 bg-surface-200/50 border border-surface-300 rounded-xl text-typography-900 placeholder:text-typography-400 focus:bg-surface-100 focus:ring-2 focus:ring-primary-200/20 focus:border-primary-200 outline-none transition-all"
                />
              </div>

              <div className="sm:col-span-2 space-y-1 bg-primary-200/5 p-3 rounded-xl border border-primary-200/20">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-primary-200">
                    Discurso de Serviço
                  </label>
                  <span className="text-[10px] text-primary-200/80 font-semibold">Viajante</span>
                </div>
                <div className="grid grid-cols-4 gap-2 pt-1">
                  <input
                    type="text"
                    placeholder="Tema do discurso"
                    value={data.meetings.midweek.serviceTalkTheme}
                    disabled={!canEdit('circuitOverseerOnly')}
                    onChange={(e) =>
                      update((prev) => ({
                        ...prev,
                        meetings: {
                          ...prev.meetings,
                          midweek: { ...prev.meetings.midweek, serviceTalkTheme: e.target.value },
                        },
                      }))
                    }
                    className="col-span-3 text-xs font-medium p-2 bg-surface-100 border border-surface-300 rounded-lg text-typography-900 placeholder:text-typography-400 outline-none focus:border-primary-200 disabled:opacity-75"
                  />
                  <input
                    type="text"
                    placeholder="Cântico"
                    value={data.meetings.midweek.serviceTalkSong}
                    disabled={!canEdit('circuitOverseerOnly')}
                    onChange={(e) =>
                      update((prev) => ({
                        ...prev,
                        meetings: {
                          ...prev.meetings,
                          midweek: { ...prev.meetings.midweek, serviceTalkSong: e.target.value },
                        },
                      }))
                    }
                    className="col-span-1 text-xs font-medium p-2 bg-surface-100 border border-surface-300 rounded-lg text-typography-900 placeholder:text-typography-400 text-center outline-none focus:border-primary-200 disabled:opacity-75"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* REUNIÃO FIM DE SEMANA */}
          <div className="bg-surface-100 border border-surface-300 rounded-2xl p-4 shadow-xs space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-primary-200 border-b border-surface-300 pb-2">
              Reunião de Fim de Semana
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-typography-500">
                  Dia da Reunião
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={!canEdit('weekendMeeting')}
                    onClick={() =>
                      update((prev) => ({
                        ...prev,
                        meetings: {
                          ...prev.meetings,
                          weekend: { ...prev.meetings.weekend, day: 'sabado' },
                        },
                      }))
                    }
                    className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                      data.meetings.weekend.day === 'sabado'
                        ? 'bg-primary-200 text-white shadow-xs'
                        : 'bg-surface-200 text-typography-600 hover:bg-surface-300'
                    }`}
                  >
                    Sábado
                  </button>
                  <button
                    type="button"
                    disabled={!canEdit('weekendMeeting')}
                    onClick={() =>
                      update((prev) => ({
                        ...prev,
                        meetings: {
                          ...prev.meetings,
                          weekend: { ...prev.meetings.weekend, day: 'domingo' },
                        },
                      }))
                    }
                    className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                      data.meetings.weekend.day === 'domingo'
                        ? 'bg-primary-200 text-white shadow-xs'
                        : 'bg-surface-200 text-typography-600 hover:bg-surface-300'
                    }`}
                  >
                    Domingo
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-typography-500">
                  Horário de Início
                </label>
                <input
                  type="text"
                  placeholder="Ex: 09:00 ou 18:00"
                  value={data.meetings.weekend.time}
                  disabled={!canEdit('weekendMeeting')}
                  onChange={(e) =>
                    update((prev) => ({
                      ...prev,
                      meetings: {
                        ...prev.meetings,
                        weekend: { ...prev.meetings.weekend, time: e.target.value },
                      },
                    }))
                  }
                  className="w-full text-xs font-medium p-2.5 bg-surface-200/50 border border-surface-300 rounded-xl text-typography-900 placeholder:text-typography-400 focus:bg-surface-100 focus:ring-2 focus:ring-primary-200/20 focus:border-primary-200 outline-none transition-all"
                />
              </div>

              <div className="sm:col-span-2 space-y-2 bg-primary-200/5 p-3 rounded-xl border border-primary-200/20">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-primary-200">
                    Discurso Público (Viajante)
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    <input
                      type="text"
                      placeholder="Tema do discurso"
                      value={data.meetings.weekend.publicTalkTheme}
                      disabled={!canEdit('circuitOverseerOnly')}
                      onChange={(e) =>
                        update((prev) => ({
                          ...prev,
                          meetings: {
                            ...prev.meetings,
                            weekend: { ...prev.meetings.weekend, publicTalkTheme: e.target.value },
                          },
                        }))
                      }
                      className="col-span-3 text-xs font-medium p-2 bg-surface-100 border border-surface-300 rounded-lg text-typography-900 placeholder:text-typography-400 outline-none focus:border-primary-200 disabled:opacity-75"
                    />
                    <input
                      type="text"
                      placeholder="Cântico"
                      value={data.meetings.weekend.publicTalkSong}
                      disabled={!canEdit('circuitOverseerOnly')}
                      onChange={(e) =>
                        update((prev) => ({
                          ...prev,
                          meetings: {
                            ...prev.meetings,
                            weekend: { ...prev.meetings.weekend, publicTalkSong: e.target.value },
                          },
                        }))
                      }
                      className="col-span-1 text-xs font-medium p-2 bg-surface-100 border border-surface-300 rounded-lg text-typography-900 placeholder:text-typography-400 text-center outline-none focus:border-primary-200 disabled:opacity-75"
                    />
                  </div>
                </div>

                <div className="space-y-1 pt-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-primary-200">
                    Discurso Final (Viajante)
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    <input
                      type="text"
                      placeholder="Tema do discurso"
                      value={data.meetings.weekend.finalTalkTheme}
                      disabled={!canEdit('circuitOverseerOnly')}
                      onChange={(e) =>
                        update((prev) => ({
                          ...prev,
                          meetings: {
                            ...prev.meetings,
                            weekend: { ...prev.meetings.weekend, finalTalkTheme: e.target.value },
                          },
                        }))
                      }
                      className="col-span-3 text-xs font-medium p-2 bg-surface-100 border border-surface-300 rounded-lg text-typography-900 placeholder:text-typography-400 outline-none focus:border-primary-200 disabled:opacity-75"
                    />
                    <input
                      type="text"
                      placeholder="Cântico"
                      value={data.meetings.weekend.finalTalkSong}
                      disabled={!canEdit('circuitOverseerOnly')}
                      onChange={(e) =>
                        update((prev) => ({
                          ...prev,
                          meetings: {
                            ...prev.meetings,
                            weekend: { ...prev.meetings.weekend, finalTalkSong: e.target.value },
                          },
                        }))
                      }
                      className="col-span-1 text-xs font-medium p-2 bg-surface-100 border border-surface-300 rounded-lg text-typography-900 placeholder:text-typography-400 text-center outline-none focus:border-primary-200 disabled:opacity-75"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* REUNIÕES ADICIONAIS */}
          <div className="bg-surface-100 border border-surface-300 rounded-2xl p-4 shadow-xs space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-primary-200 border-b border-surface-300 pb-2">
              Reuniões Adicionais
            </h4>

            {/* PIONEIROS */}
            <div className="p-3 bg-surface-200/50 border border-surface-300 rounded-xl space-y-2">
              <span className="text-xs font-bold text-typography-800">Reunião com os Pioneiros</span>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-typography-500">Dia</label>
                  <input
                    type="text"
                    placeholder="Ex: Sexta"
                    value={data.additionalMeetings.pioneers.day}
                    disabled={!canEdit('additionalMeetings')}
                    onChange={(e) =>
                      update((prev) => ({
                        ...prev,
                        additionalMeetings: {
                          ...prev.additionalMeetings,
                          pioneers: { ...prev.additionalMeetings.pioneers, day: e.target.value },
                        },
                      }))
                    }
                    className="w-full text-xs font-medium p-2 bg-surface-100 border border-surface-300 rounded-lg text-typography-900 placeholder:text-typography-400 outline-none focus:border-primary-200 disabled:opacity-60"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-typography-500">Horário</label>
                  <input
                    type="text"
                    placeholder="Ex: 17:00"
                    value={data.additionalMeetings.pioneers.time}
                    disabled={!canEdit('additionalMeetings')}
                    onChange={(e) =>
                      update((prev) => ({
                        ...prev,
                        additionalMeetings: {
                          ...prev.additionalMeetings,
                          pioneers: { ...prev.additionalMeetings.pioneers, time: e.target.value },
                        },
                      }))
                    }
                    className="w-full text-xs font-medium p-2 bg-surface-100 border border-surface-300 rounded-lg text-typography-900 placeholder:text-typography-400 outline-none focus:border-primary-200 disabled:opacity-60"
                  />
                </div>
              </div>
            </div>

            {/* ANCIÃOS E SERVOS */}
            <div className="p-3 bg-surface-200/50 border border-surface-300 rounded-xl space-y-2">
              <span className="text-xs font-bold text-typography-800">Reunião com Anciãos e Servos Ministeriais</span>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-typography-500">Dia</label>
                  <input
                    type="text"
                    placeholder="Ex: Terça"
                    value={data.additionalMeetings.eldersAndServants.day}
                    disabled={!canEdit('additionalMeetings')}
                    onChange={(e) =>
                      update((prev) => ({
                        ...prev,
                        additionalMeetings: {
                          ...prev.additionalMeetings,
                          eldersAndServants: { ...prev.additionalMeetings.eldersAndServants, day: e.target.value },
                        },
                      }))
                    }
                    className="w-full text-xs font-medium p-2 bg-surface-100 border border-surface-300 rounded-lg text-typography-900 placeholder:text-typography-400 outline-none focus:border-primary-200 disabled:opacity-60"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-typography-500">Horário</label>
                  <input
                    type="text"
                    placeholder="Ex: 19:30"
                    value={data.additionalMeetings.eldersAndServants.time}
                    disabled={!canEdit('additionalMeetings')}
                    onChange={(e) =>
                      update((prev) => ({
                        ...prev,
                        additionalMeetings: {
                          ...prev.additionalMeetings,
                          eldersAndServants: { ...prev.additionalMeetings.eldersAndServants, time: e.target.value },
                        },
                      }))
                    }
                    className="w-full text-xs font-medium p-2 bg-surface-100 border border-surface-300 rounded-lg text-typography-900 placeholder:text-typography-400 outline-none focus:border-primary-200 disabled:opacity-60"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. ESTUDOS E REVISITAS */}
      {activeSection === 'estudos' && (
        <div className="space-y-4">
          {/* MARIDO */}
          <div className="bg-surface-100 border border-surface-300 rounded-2xl p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-surface-300 pb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-primary-200">
                  Estudos de:
                </span>
                {!elderMode ? (
                  <input
                    type="text"
                    value={data.studiesAndVisits.husbandName}
                    onChange={(e) =>
                      update((prev) => ({
                        ...prev,
                        studiesAndVisits: { ...prev.studiesAndVisits, husbandName: e.target.value },
                      }))
                    }
                    className="text-xs font-black uppercase text-primary-200 bg-primary-200/10 px-2.5 py-0.5 rounded-lg border border-primary-200/30 outline-none w-32 focus:border-primary-200"
                  />
                ) : (
                  <span className="text-xs font-black uppercase text-primary-200 bg-primary-200/10 px-2.5 py-0.5 rounded-lg border border-primary-200/20">
                    {data.studiesAndVisits.husbandName || 'MARCELO'}
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-3">
              {data.studiesAndVisits.husbandRows.map((row, idx) => (
                <div key={row.id || idx} className="p-3 bg-surface-200/50 border border-surface-300 rounded-xl space-y-2.5">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-typography-500 uppercase">Dia</label>
                      <input
                        type="text"
                        placeholder="Ex: Quarta"
                        value={row.day}
                        disabled={!canEdit('circuitOverseerOnly')}
                        onChange={(e) =>
                          update((prev) => {
                            const updated = [...prev.studiesAndVisits.husbandRows];
                            updated[idx] = { ...updated[idx], day: e.target.value };
                            return {
                              ...prev,
                              studiesAndVisits: { ...prev.studiesAndVisits, husbandRows: updated },
                            };
                          })
                        }
                        className="w-full text-xs font-medium p-2 bg-surface-100 border border-surface-300 rounded-lg text-typography-900 placeholder:text-typography-400 outline-none focus:border-primary-200 disabled:opacity-75"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-typography-500 uppercase">Horário</label>
                      <input
                        type="text"
                        placeholder="Ex: 14:00"
                        value={row.time}
                        disabled={!canEdit('circuitOverseerOnly')}
                        onChange={(e) =>
                          update((prev) => {
                            const updated = [...prev.studiesAndVisits.husbandRows];
                            updated[idx] = { ...updated[idx], time: e.target.value };
                            return {
                              ...prev,
                              studiesAndVisits: { ...prev.studiesAndVisits, husbandRows: updated },
                            };
                          })
                        }
                        className="w-full text-xs font-medium p-2 bg-surface-100 border border-surface-300 rounded-lg text-typography-900 placeholder:text-typography-400 outline-none focus:border-primary-200 disabled:opacity-75"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-typography-500 uppercase">Acompanhante / Telefone</label>
                    <input
                      type="text"
                      placeholder="Nome e telefone"
                      value={row.companionPhone}
                      disabled={!canEdit('studies')}
                      onChange={(e) =>
                        update((prev) => {
                          const updated = [...prev.studiesAndVisits.husbandRows];
                          updated[idx] = { ...updated[idx], companionPhone: e.target.value };
                          return {
                            ...prev,
                            studiesAndVisits: { ...prev.studiesAndVisits, husbandRows: updated },
                          };
                        })
                      }
                      className="w-full text-xs font-medium p-2 bg-surface-100 border border-surface-300 rounded-lg text-typography-900 placeholder:text-typography-400 outline-none focus:border-primary-200 disabled:opacity-60"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-typography-500 uppercase">Lição / Publicação</label>
                    <input
                      type="text"
                      placeholder="Ex: Lição 5"
                      value={row.lesson}
                      disabled={!canEdit('studies')}
                      onChange={(e) =>
                        update((prev) => {
                          const updated = [...prev.studiesAndVisits.husbandRows];
                          updated[idx] = { ...updated[idx], lesson: e.target.value };
                          return {
                            ...prev,
                            studiesAndVisits: { ...prev.studiesAndVisits, husbandRows: updated },
                          };
                        })
                      }
                      className="w-full text-xs font-medium p-2 bg-surface-100 border border-surface-300 rounded-lg text-typography-900 placeholder:text-typography-400 outline-none focus:border-primary-200 disabled:opacity-60"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ESPOSA */}
          <div className="bg-surface-100 border border-surface-300 rounded-2xl p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-surface-300 pb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-primary-200">
                  Estudos de:
                </span>
                {!elderMode ? (
                  <input
                    type="text"
                    value={data.studiesAndVisits.wifeName}
                    onChange={(e) =>
                      update((prev) => ({
                        ...prev,
                        studiesAndVisits: { ...prev.studiesAndVisits, wifeName: e.target.value },
                      }))
                    }
                    className="text-xs font-black uppercase text-primary-200 bg-primary-200/10 px-2.5 py-0.5 rounded-lg border border-primary-200/30 outline-none w-32 focus:border-primary-200"
                  />
                ) : (
                  <span className="text-xs font-black uppercase text-primary-200 bg-primary-200/10 px-2.5 py-0.5 rounded-lg border border-primary-200/20">
                    {data.studiesAndVisits.wifeName || 'ALINE'}
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-3">
              {data.studiesAndVisits.wifeRows.map((row, idx) => (
                <div key={row.id || idx} className="p-3 bg-surface-200/50 border border-surface-300 rounded-xl space-y-2.5">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-typography-500 uppercase">Dia</label>
                      <input
                        type="text"
                        placeholder="Ex: Quarta"
                        value={row.day}
                        disabled={!canEdit('circuitOverseerOnly')}
                        onChange={(e) =>
                          update((prev) => {
                            const updated = [...prev.studiesAndVisits.wifeRows];
                            updated[idx] = { ...updated[idx], day: e.target.value };
                            return {
                              ...prev,
                              studiesAndVisits: { ...prev.studiesAndVisits, wifeRows: updated },
                            };
                          })
                        }
                        className="w-full text-xs font-medium p-2 bg-surface-100 border border-surface-300 rounded-lg text-typography-900 placeholder:text-typography-400 outline-none focus:border-primary-200 disabled:opacity-75"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-typography-500 uppercase">Horário</label>
                      <input
                        type="text"
                        placeholder="Ex: 14:00"
                        value={row.time}
                        disabled={!canEdit('circuitOverseerOnly')}
                        onChange={(e) =>
                          update((prev) => {
                            const updated = [...prev.studiesAndVisits.wifeRows];
                            updated[idx] = { ...updated[idx], time: e.target.value };
                            return {
                              ...prev,
                              studiesAndVisits: { ...prev.studiesAndVisits, wifeRows: updated },
                            };
                          })
                        }
                        className="w-full text-xs font-medium p-2 bg-surface-100 border border-surface-300 rounded-lg text-typography-900 placeholder:text-typography-400 outline-none focus:border-primary-200 disabled:opacity-75"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-typography-500 uppercase">Acompanhante / Telefone</label>
                    <input
                      type="text"
                      placeholder="Nome e telefone"
                      value={row.companionPhone}
                      disabled={!canEdit('studies')}
                      onChange={(e) =>
                        update((prev) => {
                          const updated = [...prev.studiesAndVisits.wifeRows];
                          updated[idx] = { ...updated[idx], companionPhone: e.target.value };
                          return {
                            ...prev,
                            studiesAndVisits: { ...prev.studiesAndVisits, wifeRows: updated },
                          };
                        })
                      }
                      className="w-full text-xs font-medium p-2 bg-surface-100 border border-surface-300 rounded-lg text-typography-900 placeholder:text-typography-400 outline-none focus:border-primary-200 disabled:opacity-60"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-typography-500 uppercase">Lição / Publicação</label>
                    <input
                      type="text"
                      placeholder="Ex: Lição 8"
                      value={row.lesson}
                      disabled={!canEdit('studies')}
                      onChange={(e) =>
                        update((prev) => {
                          const updated = [...prev.studiesAndVisits.wifeRows];
                          updated[idx] = { ...updated[idx], lesson: e.target.value };
                          return {
                            ...prev,
                            studiesAndVisits: { ...prev.studiesAndVisits, wifeRows: updated },
                          };
                        })
                      }
                      className="w-full text-xs font-medium p-2 bg-surface-100 border border-surface-300 rounded-lg text-typography-900 placeholder:text-typography-400 outline-none focus:border-primary-200 disabled:opacity-60"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
