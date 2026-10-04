'use client';

import React, { useState } from 'react';
import { VisitSchedule, FieldServiceRow, StudyVisitRow, MealRow, ShepherdingRow } from '@/types/visitSchedule';
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
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2
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
  const [activeSection, setActiveSection] = useState<string>('campo');

  const update = (updater: (prev: VisitSchedule) => VisitSchedule) => {
    onChange(updater(data));
  };

  const canEdit = (fieldKey: 'weekendMeeting' | 'fieldService' | 'meals' | 'shepherding' | 'studies' | 'additionalMeetings' | 'circuitOverseerOnly') => {
    if (!elderMode) return true;
    switch (fieldKey) {
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

  const tabs = [
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
              className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold whitespace-nowrap transition-all flex-shrink-0 ${
                isActive
                  ? 'bg-[#1a5c5a] text-white shadow-md shadow-teal-900/10 scale-[1.02]'
                  : 'bg-white text-gray-600 border border-gray-200/80 hover:bg-gray-50'
              }`}
            >
              <Icon size={15} />
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
                  isActive ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 1. SERVIÇO DE CAMPO */}
      {activeSection === 'campo' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <div>
              <h3 className="text-sm font-black text-gray-900 uppercase tracking-tight flex items-center gap-2">
                <MapPin size={16} className="text-[#1a5c5a]" />
                Saídas de Serviço de Campo
              </h3>
              <p className="text-xs text-gray-500">
                {canEdit('fieldService') 
                  ? 'Preencha os horários e locais de saída de campo para cada dia.' 
                  : 'Definido pelo viajante.'}
              </p>
            </div>
            {!canEdit('fieldService') && (
              <span className="flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                <Lock size={12} /> Bloqueado
              </span>
            )}
          </div>

          <div className="space-y-3">
            {data.fieldService.map((row, idx) => (
              <div 
                key={row.id || idx}
                className="bg-white border border-gray-200/90 rounded-2xl p-4 shadow-xs space-y-3"
              >
                <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                  <span className="text-xs font-black uppercase tracking-wider text-[#1a5c5a] bg-teal-50 px-2.5 py-0.5 rounded-lg border border-teal-100">
                    {row.day}
                  </span>
                  <span className="text-[11px] font-medium text-gray-400">
                    Saída #{idx + 1}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div className="sm:col-span-1 space-y-1">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1">
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
                      className="w-full text-xs font-medium p-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#1a5c5a] focus:border-transparent outline-none transition-all disabled:opacity-60"
                    />
                  </div>

                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1">
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
                      className="w-full text-xs font-medium p-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#1a5c5a] focus:border-transparent outline-none transition-all disabled:opacity-60"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. REFEIÇÕES */}
      {activeSection === 'refeicoes' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <div>
              <h3 className="text-sm font-black text-gray-900 uppercase tracking-tight flex items-center gap-2">
                <Utensils size={16} className="text-[#c0392b]" />
                Refeições (Almoços)
              </h3>
              <p className="text-xs text-gray-500">
                Informe o irmão/família anfitriã e o endereço com telefone.
              </p>
            </div>
            {!canEdit('meals') && (
              <span className="flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                <Lock size={12} /> Bloqueado
              </span>
            )}
          </div>

          <div className="space-y-3">
            {data.meals.map((row, idx) => (
              <div 
                key={row.id || idx}
                className="bg-white border border-gray-200/90 rounded-2xl p-4 shadow-xs space-y-3"
              >
                <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                  <span className="text-xs font-black uppercase tracking-wider text-[#c0392b] bg-red-50 px-2.5 py-0.5 rounded-lg border border-red-100">
                    {row.day}
                  </span>
                  <span className="text-[11px] font-semibold text-gray-400">
                    Almoço {data.mealsHeaderTime || '(11:30)'}
                  </span>
                </div>

                <div className="space-y-2.5">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
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
                      className="w-full text-xs font-medium p-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#c0392b] focus:border-transparent outline-none transition-all disabled:opacity-60"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
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
                      className="w-full text-xs font-medium p-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#c0392b] focus:border-transparent outline-none transition-all disabled:opacity-60"
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
              <h3 className="text-sm font-black text-gray-900 uppercase tracking-tight flex items-center gap-2">
                <Heart size={16} className="text-[#1a5c5a]" />
                Visitas de Pastoreio
              </h3>
              <p className="text-xs text-gray-500">
                Organize as famílias que receberão visita junto com o superintendente.
              </p>
            </div>
            {!canEdit('shepherding') && (
              <span className="flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                <Lock size={12} /> Bloqueado
              </span>
            )}
          </div>

          <div className="space-y-3">
            {data.shepherding.map((row, idx) => (
              <div 
                key={row.id || idx}
                className="bg-white border border-gray-200/90 rounded-2xl p-4 shadow-xs space-y-3"
              >
                <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                  <span className="text-xs font-bold text-gray-700">
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
                      className="text-red-500 hover:text-red-700 p-1 rounded-lg hover:bg-red-50 transition-colors"
                      title="Remover"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
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
                      className="w-full text-xs font-medium p-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#1a5c5a] focus:border-transparent outline-none transition-all disabled:opacity-60"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
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
                      className="w-full text-xs font-medium p-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#1a5c5a] focus:border-transparent outline-none transition-all disabled:opacity-60"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
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
                      className="w-full text-xs font-medium p-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#1a5c5a] focus:border-transparent outline-none transition-all disabled:opacity-60"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
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
                      className="w-full text-xs font-medium p-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#1a5c5a] focus:border-transparent outline-none transition-all disabled:opacity-60"
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
                className="w-full py-3 border-2 border-dashed border-teal-200 hover:border-teal-400 bg-teal-50/50 hover:bg-teal-50 text-teal-800 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 transition-all"
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
          <div className="bg-white border border-gray-200/90 rounded-2xl p-4 shadow-xs space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-[#1a5c5a] border-b border-gray-100 pb-2">
              Reunião do Meio de Semana
            </h4>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
                  Horário
                </label>
                <input
                  type="text"
                  placeholder="Ex: 19:30"
                  value={data.meetings.midweek.time}
                  disabled={!canEdit('circuitOverseerOnly')}
                  onChange={(e) =>
                    update((prev) => ({
                      ...prev,
                      meetings: {
                        ...prev.meetings,
                        midweek: { ...prev.meetings.midweek, time: e.target.value },
                      },
                    }))
                  }
                  className="w-full text-xs font-medium p-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#1a5c5a] focus:border-transparent outline-none transition-all disabled:opacity-75"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
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
                  className="w-full text-xs font-medium p-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#1a5c5a] focus:border-transparent outline-none transition-all"
                />
              </div>

              <div className="sm:col-span-2 space-y-1 bg-teal-50/50 p-3 rounded-xl border border-teal-100">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-teal-800">
                    Discurso de Serviço
                  </label>
                  <span className="text-[10px] text-teal-600 font-semibold">Viajante</span>
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
                    className="col-span-3 text-xs font-medium p-2 bg-white border border-teal-200 rounded-lg outline-none disabled:opacity-75"
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
                    className="col-span-1 text-xs font-medium p-2 bg-white border border-teal-200 rounded-lg text-center outline-none disabled:opacity-75"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* REUNIÃO FIM DE SEMANA */}
          <div className="bg-white border border-gray-200/90 rounded-2xl p-4 shadow-xs space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-[#1a5c5a] border-b border-gray-100 pb-2">
              Reunião de Fim de Semana
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
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
                        ? 'bg-[#1a5c5a] text-white shadow-sm'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
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
                        ? 'bg-[#1a5c5a] text-white shadow-sm'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    Domingo
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
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
                  className="w-full text-xs font-medium p-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#1a5c5a] focus:border-transparent outline-none transition-all"
                />
              </div>

              <div className="sm:col-span-2 space-y-2 bg-teal-50/50 p-3 rounded-xl border border-teal-100">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-teal-800">
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
                      className="col-span-3 text-xs font-medium p-2 bg-white border border-teal-200 rounded-lg outline-none disabled:opacity-75"
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
                      className="col-span-1 text-xs font-medium p-2 bg-white border border-teal-200 rounded-lg text-center outline-none disabled:opacity-75"
                    />
                  </div>
                </div>

                <div className="space-y-1 pt-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-teal-800">
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
                      className="col-span-3 text-xs font-medium p-2 bg-white border border-teal-200 rounded-lg outline-none disabled:opacity-75"
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
                      className="col-span-1 text-xs font-medium p-2 bg-white border border-teal-200 rounded-lg text-center outline-none disabled:opacity-75"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. ESTUDOS E REVISITAS */}
      {activeSection === 'estudos' && (
        <div className="space-y-4">
          <div className="bg-white border border-gray-200/90 rounded-2xl p-4 shadow-xs space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-[#1a5c5a] border-b border-gray-100 pb-2">
              Acompanhantes de Estudo ({data.studiesAndVisits.husbandName || 'Irmão'})
            </h4>
            <div className="space-y-3">
              {data.studiesAndVisits.husbandRows.map((row, idx) => (
                <div key={row.id || idx} className="grid grid-cols-1 sm:grid-cols-4 gap-2 p-3 bg-gray-50 rounded-xl">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase">Dia / Horário</label>
                    <div className="text-xs font-bold text-gray-800">{row.day} - {row.time || '--'}</div>
                  </div>
                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase">Acompanhante / Telefone</label>
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
                      className="w-full text-xs font-medium p-2 bg-white border border-gray-200 rounded-lg outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase">Lição</label>
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
                      className="w-full text-xs font-medium p-2 bg-white border border-gray-200 rounded-lg outline-none"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border border-gray-200/90 rounded-2xl p-4 shadow-xs space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-[#1a5c5a] border-b border-gray-100 pb-2">
              Acompanhantes de Estudo ({data.studiesAndVisits.wifeName || 'Esposa'})
            </h4>
            <div className="space-y-3">
              {data.studiesAndVisits.wifeRows.map((row, idx) => (
                <div key={row.id || idx} className="grid grid-cols-1 sm:grid-cols-4 gap-2 p-3 bg-gray-50 rounded-xl">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase">Dia / Horário</label>
                    <div className="text-xs font-bold text-gray-800">{row.day} - {row.time || '--'}</div>
                  </div>
                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase">Acompanhante / Telefone</label>
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
                      className="w-full text-xs font-medium p-2 bg-white border border-gray-200 rounded-lg outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase">Lição</label>
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
                      className="w-full text-xs font-medium p-2 bg-white border border-gray-200 rounded-lg outline-none"
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
