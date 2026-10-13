'use client';

import {
  VisitSchedule
} from '@/types/visitSchedule';
import {
  BookOpen,
  Calendar,
  ClipboardList,
  Clock,
  Heart,
  Lock,
  MapPin,
  Plus,
  Trash2,
  UserCheck,
  UserMinus,
  Users,
  Utensils
} from 'lucide-react';
import { useState } from 'react';

interface SemanaVisitaFormProps {
  data: VisitSchedule;
  onChange?: (updated: VisitSchedule) => void;
  elderMode?: boolean;
  isReadOnly?: boolean;
  hidePastoreio?: boolean;
}

export default function SemanaVisitaForm({
  data,
  onChange,
  elderMode = false,
  isReadOnly = false,
  hidePastoreio = false,
}: SemanaVisitaFormProps) {
  const [activeSection, setActiveSection] = useState<string>(elderMode || isReadOnly ? 'campo' : 'geral');

  const update = (updater: (prev: VisitSchedule) => VisitSchedule) => {
    if (isReadOnly || !onChange) return;
    onChange(updater(data));
  };

  const canEdit = (fieldKey: 'midweekMeeting' | 'weekendMeeting' | 'fieldService' | 'meals' | 'shepherding' | 'studies' | 'additionalMeetings' | 'eldersAgendaInput' | 'circuitOverseerOnly') => {
    if (isReadOnly) return false;
    if (!elderMode) return true;
    switch (fieldKey) {
      case 'midweekMeeting':
        return data.permissions?.allowMidweekMeetingTimeEdit ?? true;
      case 'weekendMeeting':
        return data.permissions?.allowWeekendMeetingTimeEdit ?? true;
      case 'fieldService':
        return data.permissions?.allowFieldServiceEdit ?? true;
      case 'meals':
        return data.permissions?.allowMealsEdit ?? true;
      case 'shepherding':
        return data.permissions?.allowShepherdingEdit ?? true;
      case 'studies':
        return data.permissions?.allowStudiesEdit ?? true;
      case 'additionalMeetings':
        return data.permissions?.allowAdditionalMeetingsEdit ?? true;
      case 'eldersAgendaInput':
        return data.permissions?.allowEldersAgendaInputEdit ?? true;
      case 'circuitOverseerOnly':
        return false;
      default:
        return false;
    }
  };

  const eldersInputCount =
    (data.eldersMeetingInput?.suggestedTopics?.length || 0) +
    (data.eldersMeetingInput?.recommendations?.length || 0) +
    (data.eldersMeetingInput?.removals?.length || 0);

  // As abas se adaptam dependendo se é o Viajante, Ancião ou Esposa (readOnly / hidePastoreio)
  const tabs = [
    ...(!elderMode && !isReadOnly ? [{ id: 'geral', label: 'Geral', icon: Users }] : []),
    { id: 'campo', label: 'Campo', icon: MapPin, count: (data.fieldService || []).length },
    { id: 'refeicoes', label: 'Refeições', icon: Utensils, count: (data.meals || []).length },
    ...(!hidePastoreio ? [{ id: 'pastoreio', label: 'Pastoreio', icon: Heart, count: (data.shepherding || []).length }] : []),
    { id: 'reunioes', label: 'Reuniões', icon: Calendar },
    { id: 'estudos', label: 'Estudos', icon: BookOpen },
    ...(!hidePastoreio ? [{ id: 'pauta_anciaos', label: 'Pauta & Recomendações', icon: ClipboardList, count: eldersInputCount > 0 ? eldersInputCount : undefined }] : []),
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
                  const isChecked = !!(data.activeDays && data.activeDays[dayKey]);
                  return (
                    <button
                      type="button"
                      key={dayKey}
                      onClick={() =>
                        update((prev) => ({
                          ...prev,
                          activeDays: { ...(prev.activeDays || {}), [dayKey]: !isChecked },
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
                <Lock size={12} /> {isReadOnly ? 'Somente Leitura' : 'Bloqueado'}
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
                      disabled={!canEdit('circuitOverseerOnly')}
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
                <Lock size={12} /> {isReadOnly ? 'Somente Leitura' : 'Bloqueado'}
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
                            updated[idx] = { ...updated[idx], day: e.target.value.replace(/-feira/gi, '').trim() };
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

                    {row.isLodging && (
                      <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                        Almoço na Hospedagem
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-typography-400 hidden sm:inline">
                      Almoço {data.mealsHeaderTime || '(11:30)'}
                    </span>

                    {!elderMode && data.meals.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          update((prev) => ({
                            ...prev,
                            meals: prev.meals.filter((_, i) => i !== idx),
                          }))
                        }
                        className="text-typography-400 hover:text-red-500 p-1 rounded-lg hover:bg-red-500/10 transition-colors cursor-pointer"
                        title="Remover este dia de refeição"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>

                {/* OPÇÃO DE REFEIÇÃO NA HOSPEDAGEM (CONFIGURADA PELO VIAJANTE) */}
                {!elderMode && (
                  <div className="p-2.5 bg-surface-200/40 rounded-xl border border-surface-300 flex items-center justify-between">
                    <label className="text-xs font-bold text-typography-800 flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!row.isLodging}
                        onChange={(e) => {
                          const isL = e.target.checked;
                          update((prev) => {
                            const updated = [...prev.meals];
                            updated[idx] = {
                              ...updated[idx],
                              isLodging: isL,
                              host: isL ? 'Hospedagem' : (updated[idx].host === 'Hospedagem' ? '' : updated[idx].host),
                              addressPhone: isL ? 'Almoço na Hospedagem' : (updated[idx].addressPhone === 'Almoço na Hospedagem' ? '' : updated[idx].addressPhone),
                            };
                            return { ...prev, meals: updated };
                          });
                        }}
                        className="w-4 h-4 rounded text-rose-500 focus:ring-rose-500"
                      />
                      Refeição na hospedagem neste dia
                    </label>
                    <span className="text-[11px] text-typography-400">
                      (Bloqueia edição para os anciãos)
                    </span>
                  </div>
                )}

                {row.isLodging && elderMode && (
                  <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-700 dark:text-amber-300 font-medium flex items-center gap-2">
                    <Lock size={13} className="flex-shrink-0" />
                    <span>O viajante definiu que o almoço deste dia será na hospedagem. O local não pode ser alterado.</span>
                  </div>
                )}

                <div className="space-y-2.5">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-typography-500">
                      Anfitrião / Família
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Família Silva"
                      value={row.host}
                      disabled={!!row.isLodging || !canEdit('meals')}
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
                      disabled={!!row.isLodging || !canEdit('meals')}
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

            {!elderMode && (
              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                <button
                  type="button"
                  onClick={() =>
                    update((prev) => ({
                      ...prev,
                      meals: [
                        ...prev.meals,
                        { id: Date.now().toString(), day: 'Almoço', host: '', addressPhone: '', isLodging: false },
                      ],
                    }))
                  }
                  className="flex-1 py-3 border-2 border-dashed border-rose-500/30 hover:border-rose-500 bg-rose-500/5 hover:bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Plus size={16} /> Adicionar Refeição
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const dayLabels: Record<string, string> = {
                      ter: 'Terça',
                      qua: 'Quarta',
                      qui: 'Quinta',
                      sex: 'Sexta',
                      sab: 'Sábado',
                      dom: 'Domingo',
                    };
                    const activeKeys = (['ter', 'qua', 'qui', 'sex', 'sab', 'dom'] as const).filter(
                      (k) => data.activeDays ? data.activeDays[k] : true
                    );
                    update((prev) => {
                      const newMeals = activeKeys.map((k) => {
                        const dayName = dayLabels[k];
                        const existing = prev.meals.find(
                          (m) => m.day.toLowerCase() === dayName.toLowerCase() || m.day.toLowerCase().includes(k)
                        );
                        return existing
                          ? { ...existing, day: dayName }
                          : { id: Date.now().toString() + '_' + k, day: dayName, host: '', addressPhone: '', isLodging: false };
                      });
                      return { ...prev, meals: newMeals };
                    });
                  }}
                  className="py-3 px-4 border border-surface-300 hover:bg-surface-200 text-typography-700 rounded-2xl text-xs font-bold transition-all cursor-pointer text-center"
                  title="Ajusta a lista de refeições para coincidir exatamente com os dias ativos da visita selecionados na aba Geral"
                >
                  Sincronizar com Dias da Visita
                </button>
              </div>
            )}
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
                <Lock size={12} /> {isReadOnly ? 'Somente Leitura' : 'Bloqueado'}
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

            {/* PASTOREIOS DO(S) ACOMPANHANTE(S) (SE HOUVER) */}
            {(data.studiesAndVisits?.companions || [])
              .filter((comp) => comp.hasShepherding)
              .map((comp) => {
                const compIdx = (data.studiesAndVisits?.companions || []).findIndex((c) => c.id === comp.id);
                return (
                  <div key={comp.id || compIdx} className="space-y-3 pt-3 border-t border-surface-300">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-2">
                        <Heart size={14} /> Pastoreios de: {comp.name || 'Acompanhante'}
                      </h4>
                    </div>

                    {(comp.shepherding || []).map((row, shIdx) => (
                      <div 
                        key={row.id || shIdx}
                        className="bg-surface-100 border border-surface-300 rounded-2xl p-4 shadow-xs space-y-3"
                      >
                        <div className="flex items-center justify-between border-b border-surface-300 pb-2">
                          <span className="text-xs font-bold text-typography-800">
                            Visita #{shIdx + 1} ({comp.name || 'Acompanhante'})
                          </span>
                          {canEdit('shepherding') && (comp.shepherding || []).length > 1 && (
                            <button
                              onClick={() =>
                                update((prev) => {
                                  const comps = [...(prev.studiesAndVisits?.companions || [])];
                                  comps[compIdx] = {
                                    ...comps[compIdx],
                                    shepherding: (comps[compIdx].shepherding || []).filter((_, i) => i !== shIdx),
                                  };
                                  return {
                                    ...prev,
                                    studiesAndVisits: { ...prev.studiesAndVisits, companions: comps },
                                  };
                                })
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
                                  const comps = [...(prev.studiesAndVisits?.companions || [])];
                                  const shList = [...(comps[compIdx].shepherding || [])];
                                  shList[shIdx] = { ...shList[shIdx], dateTime: e.target.value };
                                  comps[compIdx] = { ...comps[compIdx], shepherding: shList };
                                  return {
                                    ...prev,
                                    studiesAndVisits: { ...prev.studiesAndVisits, companions: comps },
                                  };
                                })
                              }
                              className="w-full text-xs font-medium p-2.5 bg-surface-200/50 border border-surface-300 rounded-xl text-typography-900 placeholder:text-typography-400 focus:bg-surface-100 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all disabled:opacity-60"
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
                                  const comps = [...(prev.studiesAndVisits?.companions || [])];
                                  const shList = [...(comps[compIdx].shepherding || [])];
                                  shList[shIdx] = { ...shList[shIdx], family: e.target.value };
                                  comps[compIdx] = { ...comps[compIdx], shepherding: shList };
                                  return {
                                    ...prev,
                                    studiesAndVisits: { ...prev.studiesAndVisits, companions: comps },
                                  };
                                })
                              }
                              className="w-full text-xs font-medium p-2.5 bg-surface-200/50 border border-surface-300 rounded-xl text-typography-900 placeholder:text-typography-400 focus:bg-surface-100 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all disabled:opacity-60"
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
                                  const comps = [...(prev.studiesAndVisits?.companions || [])];
                                  const shList = [...(comps[compIdx].shepherding || [])];
                                  shList[shIdx] = { ...shList[shIdx], companion: e.target.value };
                                  comps[compIdx] = { ...comps[compIdx], shepherding: shList };
                                  return {
                                    ...prev,
                                    studiesAndVisits: { ...prev.studiesAndVisits, companions: comps },
                                  };
                                })
                              }
                              className="w-full text-xs font-medium p-2.5 bg-surface-200/50 border border-surface-300 rounded-xl text-typography-900 placeholder:text-typography-400 focus:bg-surface-100 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all disabled:opacity-60"
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
                                  const comps = [...(prev.studiesAndVisits?.companions || [])];
                                  const shList = [...(comps[compIdx].shepherding || [])];
                                  shList[shIdx] = { ...shList[shIdx], situation: e.target.value };
                                  comps[compIdx] = { ...comps[compIdx], shepherding: shList };
                                  return {
                                    ...prev,
                                    studiesAndVisits: { ...prev.studiesAndVisits, companions: comps },
                                  };
                                })
                              }
                              className="w-full text-xs font-medium p-2.5 bg-surface-200/50 border border-surface-300 rounded-xl text-typography-900 placeholder:text-typography-400 focus:bg-surface-100 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all disabled:opacity-60"
                            />
                          </div>
                        </div>
                      </div>
                    ))}

                    {canEdit('shepherding') && (
                      <button
                        onClick={() =>
                          update((prev) => {
                            const comps = [...(prev.studiesAndVisits?.companions || [])];
                            comps[compIdx] = {
                              ...comps[compIdx],
                              shepherding: [
                                ...(comps[compIdx].shepherding || []),
                                { id: Date.now().toString(), dateTime: '', family: '', companion: '', situation: '' },
                              ],
                            };
                            return {
                              ...prev,
                              studiesAndVisits: { ...prev.studiesAndVisits, companions: comps },
                            };
                          })
                        }
                        className="w-full py-2.5 border-2 border-dashed border-amber-500/30 hover:border-amber-500 bg-amber-500/5 hover:bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
                      >
                        <Plus size={15} /> Adicionar Pastoreio para {comp.name || 'Acompanhante'}
                      </button>
                    )}
                  </div>
                );
              })}
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
                  <div className="flex items-center justify-between border-b border-surface-300/60 pb-1.5">
                    <span className="text-[11px] font-bold text-typography-600">Estudo #{idx + 1}</span>
                    {!elderMode && data.studiesAndVisits.husbandRows.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          update((prev) => ({
                            ...prev,
                            studiesAndVisits: {
                              ...prev.studiesAndVisits,
                              husbandRows: prev.studiesAndVisits.husbandRows.filter((_, i) => i !== idx),
                            },
                          }))
                        }
                        className="text-typography-400 hover:text-red-500 p-1 rounded-lg hover:bg-red-500/10 transition-colors cursor-pointer"
                        title="Remover este estudo"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
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

              {!elderMode && (
                <button
                  type="button"
                  onClick={() =>
                    update((prev) => ({
                      ...prev,
                      studiesAndVisits: {
                        ...prev.studiesAndVisits,
                        husbandRows: [
                          ...prev.studiesAndVisits.husbandRows,
                          { id: Date.now().toString(), day: 'Quarta', time: '', companionPhone: '', lesson: '' },
                        ],
                      },
                    }))
                  }
                  className="w-full py-2.5 border border-dashed border-primary-200/40 hover:border-primary-200 bg-primary-200/5 hover:bg-primary-200/10 text-primary-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <Plus size={14} /> Adicionar Estudo ({data.studiesAndVisits.husbandName || 'Viajante'})
                </button>
              )}
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
                  <div className="flex items-center justify-between border-b border-surface-300/60 pb-1.5">
                    <span className="text-[11px] font-bold text-typography-600">Estudo #{idx + 1}</span>
                    {!elderMode && data.studiesAndVisits.wifeRows.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          update((prev) => ({
                            ...prev,
                            studiesAndVisits: {
                              ...prev.studiesAndVisits,
                              wifeRows: prev.studiesAndVisits.wifeRows.filter((_, i) => i !== idx),
                            },
                          }))
                        }
                        className="text-typography-400 hover:text-red-500 p-1 rounded-lg hover:bg-red-500/10 transition-colors cursor-pointer"
                        title="Remover este estudo"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
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

              {!elderMode && (
                <button
                  type="button"
                  onClick={() =>
                    update((prev) => ({
                      ...prev,
                      studiesAndVisits: {
                        ...prev.studiesAndVisits,
                        wifeRows: [
                          ...prev.studiesAndVisits.wifeRows,
                          { id: Date.now().toString(), day: 'Quarta', time: '', companionPhone: '', lesson: '' },
                        ],
                      },
                    }))
                  }
                  className="w-full py-2.5 border border-dashed border-primary-200/40 hover:border-primary-200 bg-primary-200/5 hover:bg-primary-200/10 text-primary-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <Plus size={14} /> Adicionar Estudo ({data.studiesAndVisits.wifeName || 'Esposa'})
                </button>
              )}
            </div>
          </div>

          {/* VIAJANTES ACOMPANHANTES / OUTROS PROGRAMAS DE ESTUDOS */}
          {(data.studiesAndVisits.companions || []).map((comp, compIdx) => (
            <div key={comp.id || compIdx} className="bg-surface-100 border border-surface-300 rounded-2xl p-4 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-surface-300 pb-2">
                <div className="flex items-center gap-2 flex-1 mr-2">
                  <span className="text-xs font-black uppercase tracking-wider text-amber-500">
                    Acompanhante #{compIdx + 1}:
                  </span>
                  {!elderMode ? (
                    <input
                      type="text"
                      placeholder="Nome do irmão que está acompanhando"
                      value={comp.name}
                      onChange={(e) =>
                        update((prev) => {
                          const updated = [...(prev.studiesAndVisits.companions || [])];
                          updated[compIdx] = { ...updated[compIdx], name: e.target.value };
                          return {
                            ...prev,
                            studiesAndVisits: { ...prev.studiesAndVisits, companions: updated },
                          };
                        })
                      }
                      className="text-xs font-black uppercase text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-lg border border-amber-500/30 outline-none flex-1 max-w-xs focus:border-amber-500"
                    />
                  ) : (
                    <span className="text-xs font-black uppercase text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-lg border border-amber-500/30">
                      {comp.name || `Acompanhante #${compIdx + 1}`}
                    </span>
                  )}
                </div>

                {!elderMode && (
                  <button
                    type="button"
                    onClick={() =>
                      update((prev) => ({
                        ...prev,
                        studiesAndVisits: {
                          ...prev.studiesAndVisits,
                          companions: (prev.studiesAndVisits.companions || []).filter((_, i) => i !== compIdx),
                        },
                      }))
                    }
                    className="text-typography-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-500/10 transition-colors cursor-pointer"
                    title="Remover acompanhante"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>

              {/* ESTUDOS DO IRMÃO ACOMPANHANTE */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-typography-700">
                    Estudos de {comp.name || 'Acompanhante'}
                  </span>
                </div>
                {comp.rows.map((row, rowIdx) => (
                  <div key={row.id || rowIdx} className="p-3 bg-surface-200/50 border border-surface-300 rounded-xl space-y-2.5">
                    <div className="flex items-center justify-between border-b border-surface-300/60 pb-1.5">
                      <span className="text-[11px] font-bold text-typography-600">Estudo #{rowIdx + 1}</span>
                      {!elderMode && comp.rows.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            update((prev) => {
                              const comps = [...(prev.studiesAndVisits.companions || [])];
                              comps[compIdx] = {
                                ...comps[compIdx],
                                rows: comps[compIdx].rows.filter((_, i) => i !== rowIdx),
                              };
                              return {
                                ...prev,
                                studiesAndVisits: { ...prev.studiesAndVisits, companions: comps },
                              };
                            })
                          }
                          className="text-typography-400 hover:text-red-500 p-1 rounded-lg hover:bg-red-500/10 transition-colors cursor-pointer"
                          title="Remover este estudo"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
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
                              const comps = [...(prev.studiesAndVisits.companions || [])];
                              const updatedRows = [...comps[compIdx].rows];
                              updatedRows[rowIdx] = { ...updatedRows[rowIdx], day: e.target.value };
                              comps[compIdx] = { ...comps[compIdx], rows: updatedRows };
                              return {
                                ...prev,
                                studiesAndVisits: { ...prev.studiesAndVisits, companions: comps },
                              };
                            })
                          }
                          className="w-full text-xs font-medium p-2 bg-surface-100 border border-surface-300 rounded-lg text-typography-900 placeholder:text-typography-400 outline-none focus:border-amber-500 disabled:opacity-75"
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
                              const comps = [...(prev.studiesAndVisits.companions || [])];
                              const updatedRows = [...comps[compIdx].rows];
                              updatedRows[rowIdx] = { ...updatedRows[rowIdx], time: e.target.value };
                              comps[compIdx] = { ...comps[compIdx], rows: updatedRows };
                              return {
                                ...prev,
                                studiesAndVisits: { ...prev.studiesAndVisits, companions: comps },
                              };
                            })
                          }
                          className="w-full text-xs font-medium p-2 bg-surface-100 border border-surface-300 rounded-lg text-typography-900 placeholder:text-typography-400 outline-none focus:border-amber-500 disabled:opacity-75"
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
                            const comps = [...(prev.studiesAndVisits.companions || [])];
                            const updatedRows = [...comps[compIdx].rows];
                            updatedRows[rowIdx] = { ...updatedRows[rowIdx], companionPhone: e.target.value };
                            comps[compIdx] = { ...comps[compIdx], rows: updatedRows };
                            return {
                              ...prev,
                              studiesAndVisits: { ...prev.studiesAndVisits, companions: comps },
                            };
                          })
                        }
                        className="w-full text-xs font-medium p-2 bg-surface-100 border border-surface-300 rounded-lg text-typography-900 placeholder:text-typography-400 outline-none focus:border-amber-500 disabled:opacity-60"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-typography-500 uppercase">Lição / Publicação</label>
                      <input
                        type="text"
                        placeholder="Ex: Lição 3"
                        value={row.lesson}
                        disabled={!canEdit('studies')}
                        onChange={(e) =>
                          update((prev) => {
                            const comps = [...(prev.studiesAndVisits.companions || [])];
                            const updatedRows = [...comps[compIdx].rows];
                            updatedRows[rowIdx] = { ...updatedRows[rowIdx], lesson: e.target.value };
                            comps[compIdx] = { ...comps[compIdx], rows: updatedRows };
                            return {
                              ...prev,
                              studiesAndVisits: { ...prev.studiesAndVisits, companions: comps },
                            };
                          })
                        }
                        className="w-full text-xs font-medium p-2 bg-surface-100 border border-surface-300 rounded-lg text-typography-900 placeholder:text-typography-400 outline-none focus:border-amber-500 disabled:opacity-60"
                      />
                    </div>
                  </div>
                ))}

                {!elderMode && (
                  <button
                    type="button"
                    onClick={() =>
                      update((prev) => {
                        const comps = [...(prev.studiesAndVisits.companions || [])];
                        comps[compIdx] = {
                          ...comps[compIdx],
                          rows: [
                            ...comps[compIdx].rows,
                            { id: Date.now().toString(), day: 'Quarta', time: '', companionPhone: '', lesson: '' },
                          ],
                        };
                        return {
                          ...prev,
                          studiesAndVisits: { ...prev.studiesAndVisits, companions: comps },
                        };
                      })
                    }
                    className="w-full py-2.5 border border-dashed border-amber-500/40 hover:border-amber-500 bg-amber-500/5 hover:bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Plus size={14} /> Adicionar Estudo ({comp.name || 'Acompanhante'})
                  </button>
                )}
              </div>

              {/* OPÇÃO: TEM VISITAS DE PASTOREIO DESIGNADAS PARA ELE? */}
              <div className="p-3 bg-surface-200/40 border border-surface-300 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-xs font-bold text-typography-800 flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!comp.hasShepherding}
                        disabled={!canEdit('circuitOverseerOnly')}
                        onChange={(e) =>
                          update((prev) => {
                            const comps = [...(prev.studiesAndVisits.companions || [])];
                            const current = comps[compIdx];
                            const isChecked = e.target.checked;
                            comps[compIdx] = {
                              ...current,
                              hasShepherding: isChecked,
                              shepherding: isChecked && (!current.shepherding || current.shepherding.length === 0)
                                ? [
                                    { id: Date.now().toString() + '_1', dateTime: 'Quinta 15:00', family: '', companion: '', situation: '' },
                                  ]
                                : current.shepherding || [],
                            };
                            return {
                              ...prev,
                              studiesAndVisits: { ...prev.studiesAndVisits, companions: comps },
                            };
                          })
                        }
                        className="w-4 h-4 rounded text-primary-200 focus:ring-primary-200"
                      />
                      Possui visitas de pastoreio designadas para o irmão?
                    </label>
                    <p className="text-[11px] text-typography-500 mt-0.5 ml-6">
                      Se marcado, gerará a seção de pastoreio na página dele (Página 3).
                    </p>
                  </div>
                </div>

                {comp.hasShepherding && (
                  <div className="space-y-3 pt-2 border-t border-surface-300/60">
                    {(comp.shepherding || []).map((row, shIdx) => (
                      <div key={row.id || shIdx} className="p-2.5 bg-surface-100 border border-surface-300 rounded-lg space-y-2">
                        <div className="flex items-center justify-between border-b border-surface-300/40 pb-1">
                          <span className="text-[10px] font-bold text-typography-600">Pastoreio #{shIdx + 1}</span>
                          {!elderMode && (comp.shepherding || []).length > 1 && (
                            <button
                              type="button"
                              onClick={() =>
                                update((prev) => {
                                  const comps = [...(prev.studiesAndVisits.companions || [])];
                                  comps[compIdx] = {
                                    ...comps[compIdx],
                                    shepherding: (comps[compIdx].shepherding || []).filter((_, i) => i !== shIdx),
                                  };
                                  return {
                                    ...prev,
                                    studiesAndVisits: { ...prev.studiesAndVisits, companions: comps },
                                  };
                                })
                              }
                              className="text-typography-400 hover:text-red-500 p-0.5 rounded cursor-pointer"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <input
                            type="text"
                            placeholder="Dia e Horário"
                            value={row.dateTime}
                            disabled={!canEdit('shepherding')}
                            onChange={(e) =>
                              update((prev) => {
                                const comps = [...(prev.studiesAndVisits.companions || [])];
                                const shList = [...(comps[compIdx].shepherding || [])];
                                shList[shIdx] = { ...shList[shIdx], dateTime: e.target.value };
                                comps[compIdx] = { ...comps[compIdx], shepherding: shList };
                                return {
                                  ...prev,
                                  studiesAndVisits: { ...prev.studiesAndVisits, companions: comps },
                                };
                              })
                            }
                            className="text-xs p-1.5 bg-surface-200/50 border border-surface-300 rounded-md outline-none"
                          />
                          <input
                            type="text"
                            placeholder="Família / Publicador"
                            value={row.family}
                            disabled={!canEdit('shepherding')}
                            onChange={(e) =>
                              update((prev) => {
                                const comps = [...(prev.studiesAndVisits.companions || [])];
                                const shList = [...(comps[compIdx].shepherding || [])];
                                shList[shIdx] = { ...shList[shIdx], family: e.target.value };
                                comps[compIdx] = { ...comps[compIdx], shepherding: shList };
                                return {
                                  ...prev,
                                  studiesAndVisits: { ...prev.studiesAndVisits, companions: comps },
                                };
                              })
                            }
                            className="text-xs p-1.5 bg-surface-200/50 border border-surface-300 rounded-md outline-none"
                          />
                          <input
                            type="text"
                            placeholder="Acompanhante"
                            value={row.companion}
                            disabled={!canEdit('shepherding')}
                            onChange={(e) =>
                              update((prev) => {
                                const comps = [...(prev.studiesAndVisits.companions || [])];
                                const shList = [...(comps[compIdx].shepherding || [])];
                                shList[shIdx] = { ...shList[shIdx], companion: e.target.value };
                                comps[compIdx] = { ...comps[compIdx], shepherding: shList };
                                return {
                                  ...prev,
                                  studiesAndVisits: { ...prev.studiesAndVisits, companions: comps },
                                };
                              })
                            }
                            className="text-xs p-1.5 bg-surface-200/50 border border-surface-300 rounded-md outline-none"
                          />
                          <input
                            type="text"
                            placeholder="Situação / Motivo"
                            value={row.situation}
                            disabled={!canEdit('shepherding')}
                            onChange={(e) =>
                              update((prev) => {
                                const comps = [...(prev.studiesAndVisits.companions || [])];
                                const shList = [...(comps[compIdx].shepherding || [])];
                                shList[shIdx] = { ...shList[shIdx], situation: e.target.value };
                                comps[compIdx] = { ...comps[compIdx], shepherding: shList };
                                return {
                                  ...prev,
                                  studiesAndVisits: { ...prev.studiesAndVisits, companions: comps },
                                };
                              })
                            }
                            className="text-xs p-1.5 bg-surface-200/50 border border-surface-300 rounded-md outline-none"
                          />
                        </div>
                      </div>
                    ))}
                    {canEdit('shepherding') && (
                      <button
                        type="button"
                        onClick={() =>
                          update((prev) => {
                            const comps = [...(prev.studiesAndVisits.companions || [])];
                            comps[compIdx] = {
                              ...comps[compIdx],
                              shepherding: [
                                ...(comps[compIdx].shepherding || []),
                                { id: Date.now().toString(), dateTime: '', family: '', companion: '', situation: '' },
                              ],
                            };
                            return {
                              ...prev,
                              studiesAndVisits: { ...prev.studiesAndVisits, companions: comps },
                            };
                          })
                        }
                        className="w-full py-1.5 border border-dashed border-primary-200/40 text-primary-200 hover:bg-primary-200/5 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Plus size={13} /> Adicionar Pastoreio para {comp.name || 'Acompanhante'}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* OPÇÃO: O ACOMPANHANTE É CASADO? (ESPOSA) */}
              <div className="p-3 bg-surface-200/40 border border-surface-300 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-xs font-bold text-typography-800 flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!comp.hasWife}
                        disabled={!canEdit('circuitOverseerOnly')}
                        onChange={(e) =>
                          update((prev) => {
                            const comps = [...(prev.studiesAndVisits.companions || [])];
                            const current = comps[compIdx];
                            const isChecked = e.target.checked;
                            comps[compIdx] = {
                              ...current,
                              hasWife: isChecked,
                              wifeName: current.wifeName || '',
                              wifeRows: isChecked && (!current.wifeRows || current.wifeRows.length === 0)
                                ? [
                                    { id: Date.now().toString() + '_w1', day: 'Quarta', time: '', companionPhone: '', lesson: '' },
                                    { id: Date.now().toString() + '_w2', day: 'Quinta', time: '', companionPhone: '', lesson: '' },
                                  ]
                                : current.wifeRows || [],
                            };
                            return {
                              ...prev,
                              studiesAndVisits: { ...prev.studiesAndVisits, companions: comps },
                            };
                          })
                        }
                        className="w-4 h-4 rounded text-primary-200 focus:ring-primary-200"
                      />
                      O irmão acompanhante é casado? (Acompanhado pela esposa)
                    </label>
                    <p className="text-[11px] text-typography-500 mt-0.5 ml-6">
                      Se marcado, gerará uma página exclusiva para ela (Página 4) sem informações de pastoreio.
                    </p>
                  </div>
                </div>

                {comp.hasWife && (
                  <div className="space-y-3 pt-2 border-t border-surface-300/60">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-typography-500 uppercase">
                        Nome da Esposa do Acompanhante
                      </label>
                      <input
                        type="text"
                        placeholder="Nome da esposa"
                        value={comp.wifeName || ''}
                        disabled={!canEdit('circuitOverseerOnly')}
                        onChange={(e) =>
                          update((prev) => {
                            const comps = [...(prev.studiesAndVisits.companions || [])];
                            comps[compIdx] = { ...comps[compIdx], wifeName: e.target.value };
                            return {
                              ...prev,
                              studiesAndVisits: { ...prev.studiesAndVisits, companions: comps },
                            };
                          })
                        }
                        className="w-full text-xs font-bold p-2 bg-surface-100 border border-surface-300 rounded-lg text-typography-900 outline-none focus:border-amber-500"
                      />
                    </div>

                    <div className="space-y-2">
                      <span className="text-[11px] font-bold text-typography-600">
                        Estudos de: {comp.wifeName || 'Esposa'}
                      </span>
                      {(comp.wifeRows || []).map((row, wIdx) => (
                        <div key={row.id || wIdx} className="p-3 bg-surface-100 border border-surface-300 rounded-xl space-y-2">
                          <div className="flex items-center justify-between border-b border-surface-300/40 pb-1">
                            <span className="text-[10px] font-bold text-typography-600">Estudo #{wIdx + 1}</span>
                            {!elderMode && (comp.wifeRows || []).length > 1 && (
                              <button
                                type="button"
                                onClick={() =>
                                  update((prev) => {
                                    const comps = [...(prev.studiesAndVisits.companions || [])];
                                    comps[compIdx] = {
                                      ...comps[compIdx],
                                      wifeRows: (comps[compIdx].wifeRows || []).filter((_, i) => i !== wIdx),
                                    };
                                    return {
                                      ...prev,
                                      studiesAndVisits: { ...prev.studiesAndVisits, companions: comps },
                                    };
                                  })
                                }
                                className="text-typography-400 hover:text-red-500 p-0.5 rounded cursor-pointer"
                              >
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="text"
                              placeholder="Dia (Ex: Quarta)"
                              value={row.day}
                              disabled={!canEdit('circuitOverseerOnly')}
                              onChange={(e) =>
                                update((prev) => {
                                  const comps = [...(prev.studiesAndVisits.companions || [])];
                                  const wRows = [...(comps[compIdx].wifeRows || [])];
                                  wRows[wIdx] = { ...wRows[wIdx], day: e.target.value };
                                  comps[compIdx] = { ...comps[compIdx], wifeRows: wRows };
                                  return {
                                    ...prev,
                                    studiesAndVisits: { ...prev.studiesAndVisits, companions: comps },
                                  };
                                })
                              }
                              className="text-xs p-1.5 bg-surface-200/50 border border-surface-300 rounded-md outline-none"
                            />
                            <input
                              type="text"
                              placeholder="Horário (Ex: 14:00)"
                              value={row.time}
                              disabled={!canEdit('circuitOverseerOnly')}
                              onChange={(e) =>
                                update((prev) => {
                                  const comps = [...(prev.studiesAndVisits.companions || [])];
                                  const wRows = [...(comps[compIdx].wifeRows || [])];
                                  wRows[wIdx] = { ...wRows[wIdx], time: e.target.value };
                                  comps[compIdx] = { ...comps[compIdx], wifeRows: wRows };
                                  return {
                                    ...prev,
                                    studiesAndVisits: { ...prev.studiesAndVisits, companions: comps },
                                  };
                                })
                              }
                              className="text-xs p-1.5 bg-surface-200/50 border border-surface-300 rounded-md outline-none"
                            />
                          </div>
                          <input
                            type="text"
                            placeholder="Acompanhante / Telefone"
                            value={row.companionPhone}
                            disabled={!canEdit('studies')}
                            onChange={(e) =>
                              update((prev) => {
                                const comps = [...(prev.studiesAndVisits.companions || [])];
                                const wRows = [...(comps[compIdx].wifeRows || [])];
                                wRows[wIdx] = { ...wRows[wIdx], companionPhone: e.target.value };
                                comps[compIdx] = { ...comps[compIdx], wifeRows: wRows };
                                return {
                                  ...prev,
                                  studiesAndVisits: { ...prev.studiesAndVisits, companions: comps },
                                };
                              })
                            }
                            className="w-full text-xs p-1.5 bg-surface-200/50 border border-surface-300 rounded-md outline-none"
                          />
                          <input
                            type="text"
                            placeholder="Lição / Publicação"
                            value={row.lesson}
                            disabled={!canEdit('studies')}
                            onChange={(e) =>
                              update((prev) => {
                                const comps = [...(prev.studiesAndVisits.companions || [])];
                                const wRows = [...(comps[compIdx].wifeRows || [])];
                                wRows[wIdx] = { ...wRows[wIdx], lesson: e.target.value };
                                comps[compIdx] = { ...comps[compIdx], wifeRows: wRows };
                                return {
                                  ...prev,
                                  studiesAndVisits: { ...prev.studiesAndVisits, companions: comps },
                                };
                              })
                            }
                            className="w-full text-xs p-1.5 bg-surface-200/50 border border-surface-300 rounded-md outline-none"
                          />
                        </div>
                      ))}

                      {!elderMode && (
                        <button
                          type="button"
                          onClick={() =>
                            update((prev) => {
                              const comps = [...(prev.studiesAndVisits.companions || [])];
                              comps[compIdx] = {
                                ...comps[compIdx],
                                wifeRows: [
                                  ...(comps[compIdx].wifeRows || []),
                                  { id: Date.now().toString(), day: 'Quarta', time: '', companionPhone: '', lesson: '' },
                                ],
                              };
                              return {
                                ...prev,
                                studiesAndVisits: { ...prev.studiesAndVisits, companions: comps },
                              };
                            })
                          }
                          className="w-full py-1.5 border border-dashed border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/5 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <Plus size={13} /> Adicionar Estudo ({comp.wifeName || 'Esposa'})
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* BOTÃO PARA ADICIONAR VIAJANTE ACOMPANHANTE */}
          {!elderMode && (
            <button
              type="button"
              onClick={() =>
                update((prev) => ({
                  ...prev,
                  studiesAndVisits: {
                    ...prev.studiesAndVisits,
                    companions: [
                      ...(prev.studiesAndVisits.companions || []),
                      {
                        id: Date.now().toString(),
                        name: '',
                        rows: [
                          { id: Date.now().toString() + '_1', day: 'Quarta', time: '', companionPhone: '', lesson: '' },
                          { id: Date.now().toString() + '_2', day: 'Quinta', time: '', companionPhone: '', lesson: '' },
                        ],
                        hasWife: false,
                        wifeName: '',
                        wifeRows: [],
                        hasShepherding: false,
                        shepherding: [],
                      },
                    ],
                  },
                }))
              }
              className="w-full py-3.5 border-2 border-dashed border-amber-500/30 hover:border-amber-500 bg-amber-500/5 hover:bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Plus size={16} /> Adicionar Viajante Acompanhante (Visita Acompanhada)
            </button>
          )}

        </div>
      )}

      {/* 6. PAUTA DA REUNIÃO DE ANCIÃOS, RECOMENDAÇÕES E REMOÇÕES */}
      {!hidePastoreio && activeSection === 'pauta_anciaos' && (
        <div className="space-y-5">
          {/* Card de orientação */}
          <div className="bg-surface-100 border border-surface-300 rounded-2xl p-4 shadow-xs space-y-1">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider text-primary-200 flex items-center gap-1.5">
                <ClipboardList size={16} />
                Reunião de Anciãos com o Superintendente de Circuito
              </h3>
              {!canEdit('eldersAgendaInput') && (
                <span className="text-[10px] font-semibold text-typography-400 flex items-center gap-1">
                  <Lock size={11} /> Somente leitura
                </span>
              )}
            </div>
            <p className="text-[11px] text-typography-500 leading-relaxed">
              Informe abaixo as <strong>sugestões de assuntos locais</strong> para a pauta da reunião com o corpo de anciãos, bem como eventuais <strong>recomendações</strong> ou <strong>remoções/renúncias</strong>.
            </p>
          </div>

          {/* BLOCO 1: ASSUNTOS LOCAIS SUGERIDOS PELO CORPO DE ANCIÃOS */}
          <div className="bg-surface-100 border border-surface-300 rounded-2xl p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-surface-300 pb-2.5 gap-2">
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-typography-900 flex items-center gap-1.5">
                  <BookOpen size={14} className="text-primary-200" />
                  Assuntos Locais Sugeridos para a Pauta
                </h4>
                <span className="text-[11px] text-typography-500">
                  Assuntos que o corpo de anciãos gostaria de considerar na reunião
                </span>
              </div>
              {canEdit('eldersAgendaInput') && (
                <button
                  type="button"
                  onClick={() =>
                    update((prev) => ({
                      ...prev,
                      eldersMeetingInput: {
                        suggestedTopics: [
                          ...(prev.eldersMeetingInput?.suggestedTopics || []),
                          {
                            id: `sug_${Date.now()}`,
                            suggestedBy: '',
                            subject: '',
                            reference: '',
                          },
                        ],
                        recommendations: prev.eldersMeetingInput?.recommendations || [],
                        removals: prev.eldersMeetingInput?.removals || [],
                      },
                    }))
                  }
                  className="shrink-0 flex items-center gap-1.5 bg-primary-200 hover:bg-primary-300 text-white px-3 py-1.5 rounded-xl text-xs font-bold shadow-2xs transition-all cursor-pointer"
                >
                  <Plus size={14} />
                  <span>Sugerir Assunto</span>
                </button>
              )}
            </div>

            {(data.eldersMeetingInput?.suggestedTopics || []).length === 0 ? (
              <div className="py-5 text-center text-xs text-typography-400 bg-surface-200/40 rounded-xl border border-dashed border-surface-300">
                Nenhuma sugestão de assunto adicionada até o momento.
              </div>
            ) : (
              <div className="space-y-3">
                {(data.eldersMeetingInput?.suggestedTopics || []).map((topic, idx) => (
                  <div
                    key={topic.id || idx}
                    className="p-3.5 bg-surface-200/50 border border-surface-300 rounded-xl space-y-2.5"
                  >
                    <div className="flex items-center justify-between border-b border-surface-300 pb-2">
                      <span className="text-[11px] font-black text-primary-200 bg-primary-200/10 px-2.5 py-0.5 rounded-lg border border-primary-200/20">
                        Sugestão de Assunto #{idx + 1}
                      </span>
                      {canEdit('eldersAgendaInput') && (
                        <button
                          type="button"
                          onClick={() =>
                            update((prev) => ({
                              ...prev,
                              eldersMeetingInput: {
                                suggestedTopics: (
                                  prev.eldersMeetingInput?.suggestedTopics || []
                                ).filter((_, i) => i !== idx),
                                recommendations:
                                  prev.eldersMeetingInput?.recommendations || [],
                                removals: prev.eldersMeetingInput?.removals || [],
                              },
                            }))
                          }
                          className="text-typography-400 hover:text-red-500 p-1 rounded-lg hover:bg-red-500/10 transition-colors cursor-pointer"
                          title="Remover sugestão"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-typography-500">
                          Quem indicou (Nome do Ancião)
                        </label>
                        <input
                          type="text"
                          disabled={!canEdit('eldersAgendaInput')}
                          placeholder="Ex: Alcides"
                          value={topic.suggestedBy}
                          onChange={(e) =>
                            update((prev) => {
                              const list = [
                                ...(prev.eldersMeetingInput?.suggestedTopics || []),
                              ];
                              list[idx] = { ...list[idx], suggestedBy: e.target.value };
                              return {
                                ...prev,
                                eldersMeetingInput: {
                                  suggestedTopics: list,
                                  recommendations:
                                    prev.eldersMeetingInput?.recommendations || [],
                                  removals: prev.eldersMeetingInput?.removals || [],
                                },
                              };
                            })
                          }
                          className="w-full text-xs font-semibold p-2.5 bg-surface-100 border border-surface-300 rounded-xl text-typography-900 placeholder:text-typography-400 outline-none focus:border-primary-200 disabled:opacity-60"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-typography-500">
                          Fontes de Matéria / Referência (Opcional)
                        </label>
                        <input
                          type="text"
                          disabled={!canEdit('eldersAgendaInput')}
                          placeholder="Ex: sfl cap. 12 § 4..."
                          value={topic.reference || ''}
                          onChange={(e) =>
                            update((prev) => {
                              const list = [
                                ...(prev.eldersMeetingInput?.suggestedTopics || []),
                              ];
                              list[idx] = { ...list[idx], reference: e.target.value };
                              return {
                                ...prev,
                                eldersMeetingInput: {
                                  suggestedTopics: list,
                                  recommendations:
                                    prev.eldersMeetingInput?.recommendations || [],
                                  removals: prev.eldersMeetingInput?.removals || [],
                                },
                              };
                            })
                          }
                          className="w-full text-xs font-medium p-2.5 bg-surface-100 border border-surface-300 rounded-xl text-typography-900 placeholder:text-typography-400 outline-none focus:border-primary-200 disabled:opacity-60"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-typography-500">
                        Assunto / Necessidade Local
                      </label>
                      <textarea
                        rows={2}
                        disabled={!canEdit('eldersAgendaInput')}
                        placeholder="DESCREVA O ASSUNTO QUE GOSTARIA DE CONSIDERAR..."
                        value={(topic.subject || '').toUpperCase()}
                        onChange={(e) =>
                          update((prev) => {
                            const list = [
                              ...(prev.eldersMeetingInput?.suggestedTopics || []),
                            ];
                            list[idx] = {
                              ...list[idx],
                              subject: e.target.value.toUpperCase(),
                            };
                            return {
                              ...prev,
                              eldersMeetingInput: {
                                suggestedTopics: list,
                                recommendations:
                                  prev.eldersMeetingInput?.recommendations || [],
                                removals: prev.eldersMeetingInput?.removals || [],
                              },
                            };
                          })
                        }
                        className="w-full text-xs font-bold uppercase p-2.5 bg-surface-100 border border-surface-300 rounded-xl text-typography-900 placeholder:text-typography-400 outline-none focus:border-primary-200 resize-y disabled:opacity-60"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* BLOCO 2: RECOMENDAÇÕES (SIMPLES E DIRETO) */}
          <div className="bg-surface-100 border border-surface-300 rounded-2xl p-4 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-surface-300 pb-2.5 gap-2">
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-typography-900 flex items-center gap-1.5">
                  <UserCheck size={14} className="text-primary-200" />
                  Recomendações (Anciãos e Servos Ministeriais)
                </h4>
                <span className="text-[11px] text-typography-500">
                  Adicione apenas o nome e se a recomendação é para Ancião ou Servo Ministerial
                </span>
              </div>
              {canEdit('eldersAgendaInput') && (
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      update((prev) => ({
                        ...prev,
                        eldersMeetingInput: {
                          suggestedTopics:
                            prev.eldersMeetingInput?.suggestedTopics || [],
                          recommendations: [
                            ...(prev.eldersMeetingInput?.recommendations || []),
                            {
                              id: `rec_${Date.now()}`,
                              role: 'elder',
                              name: '',
                              notes: '',
                            },
                          ],
                          removals: prev.eldersMeetingInput?.removals || [],
                        },
                      }))
                    }
                    className="flex items-center gap-1 bg-primary-200/10 hover:bg-primary-200/20 text-primary-200 border border-primary-200/25 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    <Plus size={13} />
                    <span>Ancião</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      update((prev) => ({
                        ...prev,
                        eldersMeetingInput: {
                          suggestedTopics:
                            prev.eldersMeetingInput?.suggestedTopics || [],
                          recommendations: [
                            ...(prev.eldersMeetingInput?.recommendations || []),
                            {
                              id: `rec_${Date.now()}`,
                              role: 'servant',
                              name: '',
                              notes: '',
                            },
                          ],
                          removals: prev.eldersMeetingInput?.removals || [],
                        },
                      }))
                    }
                    className="flex items-center gap-1 bg-primary-200/10 hover:bg-primary-200/20 text-primary-200 border border-primary-200/25 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    <Plus size={13} />
                    <span>Servo Ministerial</span>
                  </button>
                </div>
              )}
            </div>

            {(data.eldersMeetingInput?.recommendations || []).length === 0 ? (
              <div className="py-5 text-center text-xs text-typography-400 bg-surface-200/40 rounded-xl border border-dashed border-surface-300">
                Nenhuma recomendação informada para esta visita.
              </div>
            ) : (
              <div className="space-y-2.5">
                {(data.eldersMeetingInput?.recommendations || []).map((rec, idx) => (
                  <div
                    key={rec.id || idx}
                    className="p-3.5 bg-surface-200/50 border border-surface-300 rounded-xl space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        {(['elder', 'servant'] as const).map((rType) => {
                          const active = rec.role === rType;
                          return (
                            <button
                              key={rType}
                              type="button"
                              disabled={!canEdit('eldersAgendaInput')}
                              onClick={() =>
                                update((prev) => {
                                  const list = [
                                    ...(prev.eldersMeetingInput?.recommendations || []),
                                  ];
                                  list[idx] = { ...list[idx], role: rType };
                                  return {
                                    ...prev,
                                    eldersMeetingInput: {
                                      suggestedTopics:
                                        prev.eldersMeetingInput?.suggestedTopics || [],
                                      recommendations: list,
                                      removals: prev.eldersMeetingInput?.removals || [],
                                    },
                                  };
                                })
                              }
                              className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                                active
                                  ? 'bg-primary-200 text-white border-primary-200 shadow-2xs'
                                  : 'bg-surface-100 text-typography-600 border-surface-300 hover:bg-surface-200'
                              }`}
                            >
                              {rType === 'elder' ? 'Ancião' : 'Servo Ministerial'}
                            </button>
                          );
                        })}
                      </div>

                      {canEdit('eldersAgendaInput') && (
                        <button
                          type="button"
                          onClick={() =>
                            update((prev) => ({
                              ...prev,
                              eldersMeetingInput: {
                                suggestedTopics:
                                  prev.eldersMeetingInput?.suggestedTopics || [],
                                recommendations: (
                                  prev.eldersMeetingInput?.recommendations || []
                                ).filter((_, i) => i !== idx),
                                removals: prev.eldersMeetingInput?.removals || [],
                              },
                            }))
                          }
                          className="text-typography-400 hover:text-red-500 p-1 rounded-lg hover:bg-red-500/10 transition-colors cursor-pointer"
                          title="Remover recomendação"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-typography-500">
                          Nome Completo do Irmão
                        </label>
                        <input
                          type="text"
                          disabled={!canEdit('eldersAgendaInput')}
                          placeholder="Ex: Valdevagner Figueiredo"
                          value={rec.name}
                          onChange={(e) =>
                            update((prev) => {
                              const list = [
                                ...(prev.eldersMeetingInput?.recommendations || []),
                              ];
                              list[idx] = { ...list[idx], name: e.target.value };
                              return {
                                ...prev,
                                eldersMeetingInput: {
                                  suggestedTopics:
                                    prev.eldersMeetingInput?.suggestedTopics || [],
                                  recommendations: list,
                                  removals: prev.eldersMeetingInput?.removals || [],
                                },
                              };
                            })
                          }
                          className="w-full text-xs font-semibold p-2.5 bg-surface-100 border border-surface-300 rounded-xl text-typography-900 placeholder:text-typography-400 outline-none focus:border-primary-200 disabled:opacity-60"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-typography-500">
                          Observação Breve (Opcional)
                        </label>
                        <input
                          type="text"
                          disabled={!canEdit('eldersAgendaInput')}
                          placeholder="Alguma observação relevante se necessário..."
                          value={rec.notes || ''}
                          onChange={(e) =>
                            update((prev) => {
                              const list = [
                                ...(prev.eldersMeetingInput?.recommendations || []),
                              ];
                              list[idx] = { ...list[idx], notes: e.target.value };
                              return {
                                ...prev,
                                eldersMeetingInput: {
                                  suggestedTopics:
                                    prev.eldersMeetingInput?.suggestedTopics || [],
                                  recommendations: list,
                                  removals: prev.eldersMeetingInput?.removals || [],
                                },
                              };
                            })
                          }
                          className="w-full text-xs font-medium p-2.5 bg-surface-100 border border-surface-300 rounded-xl text-typography-900 placeholder:text-typography-400 outline-none focus:border-primary-200 disabled:opacity-60"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* BLOCO 3: REMOÇÕES OU RENÚNCIAS */}
          <div className="bg-surface-100 border border-surface-300 rounded-2xl p-4 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-surface-300 pb-2.5 gap-2">
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-typography-900 flex items-center gap-1.5">
                  <UserMinus size={14} className="text-red-500" />
                  Remoções ou Renúncias
                </h4>
                <span className="text-[11px] text-typography-500">
                  Se for mudança de congregação, informe para qual congregação mudou no motivo
                </span>
              </div>
              {canEdit('eldersAgendaInput') && (
                <button
                  type="button"
                  onClick={() =>
                    update((prev) => ({
                      ...prev,
                      eldersMeetingInput: {
                        suggestedTopics:
                          prev.eldersMeetingInput?.suggestedTopics || [],
                        recommendations:
                          prev.eldersMeetingInput?.recommendations || [],
                        removals: [
                          ...(prev.eldersMeetingInput?.removals || []),
                          {
                            id: `rem_${Date.now()}`,
                            role: 'elder',
                            name: '',
                            reason: '',
                          },
                        ],
                      },
                    }))
                  }
                  className="shrink-0 flex items-center gap-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/25 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  <Plus size={14} />
                  <span>Adicionar Remoção / Renúncia</span>
                </button>
              )}
            </div>

            {(data.eldersMeetingInput?.removals || []).length === 0 ? (
              <div className="py-5 text-center text-xs text-typography-400 bg-surface-200/40 rounded-xl border border-dashed border-surface-300">
                Nenhuma remoção ou renúncia informada.
              </div>
            ) : (
              <div className="space-y-2.5">
                {(data.eldersMeetingInput?.removals || []).map((rem, idx) => (
                  <div
                    key={rem.id || idx}
                    className="p-3.5 bg-surface-200/50 border border-surface-300 rounded-xl space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        {(['elder', 'servant'] as const).map((rType) => {
                          const active = rem.role === rType;
                          return (
                            <button
                              key={rType}
                              type="button"
                              disabled={!canEdit('eldersAgendaInput')}
                              onClick={() =>
                                update((prev) => {
                                  const list = [
                                    ...(prev.eldersMeetingInput?.removals || []),
                                  ];
                                  list[idx] = { ...list[idx], role: rType };
                                  return {
                                    ...prev,
                                    eldersMeetingInput: {
                                      suggestedTopics:
                                        prev.eldersMeetingInput?.suggestedTopics || [],
                                      recommendations:
                                        prev.eldersMeetingInput?.recommendations || [],
                                      removals: list,
                                    },
                                  };
                                })
                              }
                              className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                                active
                                  ? 'bg-red-600 text-white border-red-600 shadow-2xs'
                                  : 'bg-surface-100 text-typography-600 border-surface-300 hover:bg-surface-200'
                              }`}
                            >
                              {rType === 'elder' ? 'Ancião' : 'Servo Ministerial'}
                            </button>
                          );
                        })}
                      </div>

                      {canEdit('eldersAgendaInput') && (
                        <button
                          type="button"
                          onClick={() =>
                            update((prev) => ({
                              ...prev,
                              eldersMeetingInput: {
                                suggestedTopics:
                                  prev.eldersMeetingInput?.suggestedTopics || [],
                                recommendations:
                                  prev.eldersMeetingInput?.recommendations || [],
                                removals: (
                                  prev.eldersMeetingInput?.removals || []
                                ).filter((_, i) => i !== idx),
                              },
                            }))
                          }
                          className="text-typography-400 hover:text-red-500 p-1 rounded-lg hover:bg-red-500/10 transition-colors cursor-pointer"
                          title="Remover item"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-typography-500">
                          Nome do Irmão
                        </label>
                        <input
                          type="text"
                          disabled={!canEdit('eldersAgendaInput')}
                          placeholder="Nome completo"
                          value={rem.name}
                          onChange={(e) =>
                            update((prev) => {
                              const list = [
                                ...(prev.eldersMeetingInput?.removals || []),
                              ];
                              list[idx] = { ...list[idx], name: e.target.value };
                              return {
                                ...prev,
                                eldersMeetingInput: {
                                  suggestedTopics:
                                    prev.eldersMeetingInput?.suggestedTopics || [],
                                  recommendations:
                                    prev.eldersMeetingInput?.recommendations || [],
                                  removals: list,
                                },
                              };
                            })
                          }
                          className="w-full text-xs font-semibold p-2.5 bg-surface-100 border border-surface-300 rounded-xl text-typography-900 placeholder:text-typography-400 outline-none focus:border-primary-200 disabled:opacity-60"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-typography-500">
                          Motivo (ou Congregação se mudança)
                        </label>
                        <input
                          type="text"
                          disabled={!canEdit('eldersAgendaInput')}
                          placeholder="Ex: Mudou para Congregação Central / Renúncia..."
                          value={rem.reason}
                          onChange={(e) =>
                            update((prev) => {
                              const list = [
                                ...(prev.eldersMeetingInput?.removals || []),
                              ];
                              list[idx] = { ...list[idx], reason: e.target.value };
                              return {
                                ...prev,
                                eldersMeetingInput: {
                                  suggestedTopics:
                                    prev.eldersMeetingInput?.suggestedTopics || [],
                                  recommendations:
                                    prev.eldersMeetingInput?.recommendations || [],
                                  removals: list,
                                },
                              };
                            })
                          }
                          className="w-full text-xs font-medium p-2.5 bg-surface-100 border border-surface-300 rounded-xl text-typography-900 placeholder:text-typography-400 outline-none focus:border-primary-200 disabled:opacity-60"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
