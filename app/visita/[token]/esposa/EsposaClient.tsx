'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { VisitSchedule, normalizeVisitSchedule } from '@/types/visitSchedule';
import SemanaVisitaPrint from '@/components/visit/SemanaVisitaPrint';
import ThemeSwitcher from '@/components/ui/theme-switcher';
import {
  Calendar,
  Building2,
  Users,
  Clock,
  MapPin,
  Utensils,
  BookOpen,
  Printer,
  FileText,
  Smartphone,
  AlertCircle,
} from 'lucide-react';

export default function EsposasVisitaClient() {
  const params = useParams();
  const token = params?.token as string;

  const [schedule, setSchedule] = useState<VisitSchedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'form' | 'print'>('form');

  // Parâmetros opcionais na URL para pré-carregamento visual de títulos
  const [urlCongName, setUrlCongName] = useState<string>('');
  const [urlPeriod, setUrlPeriod] = useState<string>('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const search = new URLSearchParams(window.location.search);
      const c = search.get('cong');
      const p = search.get('periodo');
      if (c) setUrlCongName(c);
      if (p) setUrlPeriod(p);
    }
  }, []);

  useEffect(() => {
    const cong = schedule?.congregationName || urlCongName;
    const period = schedule?.visitPeriod || urlPeriod;
    if (cong) {
      document.title = `Programação da Visita — Esposas — Congregação ${cong}${period ? ` (${period})` : ''}`;
    } else {
      document.title = 'Programação da Semana da Visita — Esposas';
    }
  }, [schedule, urlCongName, urlPeriod]);

  useEffect(() => {
    if (!token) return;

    const fetchSchedule = async () => {
      setLoading(true);
      setErrorMsg(null);
      try {
        const q = query(collection(db, 'visit_schedules'), where('shareToken', '==', token));
        const snap = await getDocs(q);

        if (snap.empty) {
          setErrorMsg('Programação não encontrada ou o link informado é inválido.');
        } else {
          const sortedDocs = [...snap.docs].sort((a, b) => {
            const dateA = new Date(a.data().updatedAt || a.data().createdAt || 0).getTime();
            const dateB = new Date(b.data().updatedAt || b.data().createdAt || 0).getTime();
            return dateB - dateA;
          });
          const docFound = sortedDocs[0];
          setSchedule(normalizeVisitSchedule(docFound.data() as VisitSchedule));
        }
      } catch (err: any) {
        console.error('Erro ao buscar programação para esposas:', err);
        setErrorMsg('Erro de conexão ao buscar a programação. Tente recarregar a página.');
      } finally {
        setLoading(false);
      }
    };

    fetchSchedule();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-200 flex flex-col items-center justify-center p-6 space-y-4">
        <div className="w-10 h-10 border-4 border-primary-200 border-t-transparent rounded-full animate-spin" />
        <div className="text-center space-y-1">
          <p className="text-sm font-bold text-typography-900">
            Carregando programação da semana da visita...
          </p>
          {(urlCongName || urlPeriod) && (
            <p className="text-xs text-typography-500 font-medium">
              {urlCongName} {urlPeriod && `• ${urlPeriod}`}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (errorMsg && !schedule) {
    return (
      <div className="min-h-screen bg-surface-200 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-surface-100 rounded-3xl p-8 text-center shadow-xl border border-surface-300 space-y-4">
          <div className="w-14 h-14 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto">
            <AlertCircle size={30} />
          </div>
          <h2 className="text-xl font-black text-typography-950">Acesso Indisponível</h2>
          <p className="text-sm text-typography-600 leading-relaxed">{errorMsg}</p>
        </div>
      </div>
    );
  }

  if (!schedule) return null;

  return (
    <div className="min-h-screen bg-surface-200/60 text-typography-900 pb-20 pt-3 px-3 md:px-6 print:bg-white print:p-0">
      {/* CABEÇALHO SUPERIOR CLEAN E PADRONIZADO COM FAIXA GRADIENTE */}
      <div className="max-w-2xl mx-auto bg-surface-100 border border-surface-300 rounded-2xl p-4 sm:p-5 shadow-xs mb-4 print:hidden space-y-4 relative">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary-200 via-primary-150 to-transparent rounded-t-2xl" />

        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-black uppercase tracking-wider bg-primary-200/10 text-primary-200 border border-primary-200/25 px-2.5 py-0.5 rounded-lg flex items-center gap-1.5">
                <Building2 size={13} />
                Congregação {schedule.congregationName}
              </span>
              <span className="text-xs font-bold text-typography-600 bg-surface-200/80 px-2 py-0.5 rounded-lg border border-surface-300 flex items-center gap-1">
                <Calendar size={12} className="text-primary-200" />
                {schedule.visitPeriod}
              </span>
            </div>

            <div className="flex items-center gap-2 pt-0.5">
              <h1 className="text-lg sm:text-xl font-black text-typography-900 tracking-tight">
                Programação da Semana da Visita
              </h1>
            </div>

            {schedule.coupleNames && (
              <div className="text-xs text-typography-500 font-medium flex items-center gap-1.5">
                <Users size={12} className="text-primary-200" />
                <span>Casal Viajante: <strong>{schedule.coupleNames}</strong></span>
              </div>
            )}
          </div>

          {/* Botões de Tema e Impressão alinhados à direita para nunca cortar o menu */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => window.print()}
              className="flex items-center justify-center gap-1.5 bg-surface-200 hover:bg-surface-300 border border-surface-300 text-typography-800 px-3.5 py-2.5 rounded-xl font-bold text-xs transition-colors cursor-pointer"
              title="Imprimir folha"
            >
              <Printer size={16} />
              <span className="hidden sm:inline">Imprimir</span>
            </button>

            <ThemeSwitcher />
          </div>
        </div>

        {/* SELETOR DE MODO PADRONIZADO: FORMULÁRIO (CELULAR) VS FOLHA A4 COMPLETA */}
        <div className="flex items-center justify-between border-t border-surface-300 pt-2.5 gap-2">
          <div className="flex bg-surface-200 p-1 rounded-xl w-full sm:w-auto">
            <button
              onClick={() => setViewMode('form')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'form'
                  ? 'bg-surface-100 text-primary-200 shadow-xs'
                  : 'text-typography-500 hover:text-typography-800'
              }`}
            >
              <Smartphone size={14} />
              Formulário (Celular)
            </button>

            <button
              onClick={() => setViewMode('print')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'print'
                  ? 'bg-surface-100 text-primary-200 shadow-xs'
                  : 'text-typography-500 hover:text-typography-800'
              }`}
            >
              <FileText size={14} />
              Folha A4 Completa
            </button>
          </div>
        </div>
      </div>

      {/* ÁREA DE CONTEÚDO PRINCIPAL (TELA) */}
      <div className="print:hidden">
        {viewMode === 'form' ? (
          /* VISUALIZAÇÃO PRÁTICA E DIRETA ESTILO MURAL (SEM PASTOREIO) */
          <div className="max-w-2xl mx-auto space-y-4">
            {/* 1. SAÍDAS DE SERVIÇO DE CAMPO */}
            <section className="bg-surface-100 rounded-2xl p-4 sm:p-5 border border-surface-300 shadow-xs space-y-3 relative">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary-200 via-primary-150 to-transparent rounded-t-2xl" />

              <div className="flex items-center gap-2 border-b border-surface-300 pb-2.5">
                <MapPin size={16} className="text-primary-200 shrink-0" />
                <h2 className="text-xs font-black uppercase tracking-wider text-typography-900">
                  Saídas de Serviço de Campo
                </h2>
              </div>

              <div className="divide-y divide-surface-300/70">
                {(schedule.fieldService || []).map((fs, idx) => (
                  <div
                    key={fs.id || idx}
                    className="py-2.5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-xs font-black uppercase tracking-wider text-primary-200 bg-primary-200/10 px-2.5 py-0.5 rounded-lg border border-primary-200/20 w-20 text-center shrink-0">
                        {fs.day}
                      </span>
                      <span className="text-xs font-bold text-typography-800 flex items-center gap-1 shrink-0">
                        <Clock size={12} className="text-primary-200" />
                        {fs.time || 'A definir'}
                      </span>
                    </div>

                    <div className="text-xs font-semibold text-typography-700 sm:text-right pl-1 sm:pl-0">
                      {fs.location ? (
                        <span>{fs.location}</span>
                      ) : (
                        <span className="text-typography-400 italic">Local a confirmar</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* 2. ESTUDOS BÍBLICOS E REVISITAS (AMBOS OS CÔNJUGES E ACOMPANHANTES) */}
            <section className="bg-surface-100 rounded-2xl p-4 sm:p-5 border border-surface-300 shadow-xs space-y-4 relative">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary-200 via-primary-150 to-transparent rounded-t-2xl" />

              <div className="flex items-center gap-2 border-b border-surface-300 pb-2.5">
                <BookOpen size={16} className="text-primary-200 shrink-0" />
                <h2 className="text-xs font-black uppercase tracking-wider text-typography-900">
                  Estudos Bíblicos e Revisitas
                </h2>
              </div>

              <div className="space-y-4">
                {/* ESTUDOS DA ESPOSA */}
                <div className="space-y-2">
                  <span className="text-[11px] font-black uppercase tracking-wider text-primary-200 bg-primary-200/10 px-2.5 py-0.5 rounded-md border border-primary-200/20 inline-block">
                    Estudos de {schedule.studiesAndVisits?.wifeName || 'Esposa'}
                  </span>

                  <div className="divide-y divide-surface-300/70 bg-surface-200/40 rounded-xl border border-surface-300 px-3.5 py-1">
                    {(schedule.studiesAndVisits?.wifeRows || []).map((row, idx) => (
                      <div
                        key={row.id || idx}
                        className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black uppercase text-primary-200 w-20 shrink-0">
                            {row.day || `Estudo #${idx + 1}`}
                          </span>
                          <span className="text-xs font-bold text-typography-800 flex items-center gap-1 shrink-0">
                            <Clock size={12} className="text-primary-200" />
                            {row.time || 'A definir'}
                          </span>
                        </div>

                        <div className="text-xs sm:text-right space-y-0.5">
                          <p className="font-bold text-typography-900">
                            {row.companionPhone || <span className="text-typography-400 italic font-normal">Acompanhante a definir</span>}
                          </p>
                          {row.lesson && (
                            <p className="text-[11px] text-typography-500">
                              Lição: <strong>{row.lesson}</strong>
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ESTUDOS DO VIAJANTE (MARIDO) */}
                <div className="space-y-2">
                  <span className="text-[11px] font-black uppercase tracking-wider text-typography-700 bg-surface-200 px-2.5 py-0.5 rounded-md border border-surface-300 inline-block">
                    Estudos de {schedule.studiesAndVisits?.husbandName || 'Viajante'}
                  </span>

                  <div className="divide-y divide-surface-300/70 bg-surface-200/40 rounded-xl border border-surface-300 px-3.5 py-1">
                    {(schedule.studiesAndVisits?.husbandRows || []).map((row, idx) => (
                      <div
                        key={row.id || idx}
                        className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black uppercase text-typography-700 w-20 shrink-0">
                            {row.day || `Estudo #${idx + 1}`}
                          </span>
                          <span className="text-xs font-bold text-typography-800 flex items-center gap-1 shrink-0">
                            <Clock size={12} className="text-primary-200" />
                            {row.time || 'A definir'}
                          </span>
                        </div>

                        <div className="text-xs sm:text-right space-y-0.5">
                          <p className="font-bold text-typography-900">
                            {row.companionPhone || <span className="text-typography-400 italic font-normal">Acompanhante a definir</span>}
                          </p>
                          {row.lesson && (
                            <p className="text-[11px] text-typography-500">
                              Lição: <strong>{row.lesson}</strong>
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ACOMPANHANTES (SE HOUVER) */}
                {(schedule.studiesAndVisits?.companions || []).map((comp, compIdx) => (
                  <div key={comp.id || compIdx} className="space-y-2 pt-2 border-t border-surface-300">
                    <span className="text-[11px] font-black uppercase tracking-wider text-primary-200 bg-primary-200/10 px-2.5 py-0.5 rounded-md border border-primary-200/20 inline-block">
                      Acompanhante: {comp.name || `#${compIdx + 1}`}{comp.hasWife ? ` & ${comp.wifeName || 'Esposa'}` : ''}
                    </span>

                    <div className="divide-y divide-surface-300/70 bg-surface-200/40 rounded-xl border border-surface-300 px-3.5 py-1">
                      {comp.hasWife && (comp.wifeRows || []).map((wRow, wIdx) => (
                        <div
                          key={`w-${wIdx}`}
                          className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black uppercase text-primary-200 shrink-0">
                              {wRow.day} ({comp.wifeName || 'Esposa'})
                            </span>
                            <span className="text-xs font-bold text-typography-800 flex items-center gap-1 shrink-0">
                              <Clock size={12} className="text-primary-200" />
                              {wRow.time || 'A definir'}
                            </span>
                          </div>
                          <div className="text-xs sm:text-right space-y-0.5">
                            <p className="font-bold text-typography-900">
                              {wRow.companionPhone || <span className="text-typography-400 italic font-normal">Acompanhante a definir</span>}
                            </p>
                            {wRow.lesson && (
                              <p className="text-[11px] text-typography-500">
                                Lição: <strong>{wRow.lesson}</strong>
                              </p>
                            )}
                          </div>
                        </div>
                      ))}

                      {(comp.rows || []).map((cRow, cIdx) => (
                        <div
                          key={`c-${cIdx}`}
                          className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black uppercase text-typography-700 shrink-0">
                              {cRow.day} ({comp.name || 'Irmão'})
                            </span>
                            <span className="text-xs font-bold text-typography-800 flex items-center gap-1 shrink-0">
                              <Clock size={12} className="text-primary-200" />
                              {cRow.time || 'A definir'}
                            </span>
                          </div>
                          <div className="text-xs sm:text-right space-y-0.5">
                            <p className="font-bold text-typography-900">
                              {cRow.companionPhone || <span className="text-typography-400 italic font-normal">Acompanhante a definir</span>}
                            </p>
                            {cRow.lesson && (
                              <p className="text-[11px] text-typography-500">
                                Lição: <strong>{cRow.lesson}</strong>
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* 3. REFEIÇÕES / ALMOÇOS */}
            <section className="bg-surface-100 rounded-2xl p-4 sm:p-5 border border-surface-300 shadow-xs space-y-3 relative">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary-200 via-primary-150 to-transparent rounded-t-2xl" />

              <div className="flex items-center justify-between border-b border-surface-300 pb-2.5">
                <div className="flex items-center gap-2">
                  <Utensils size={16} className="text-primary-200 shrink-0" />
                  <h2 className="text-xs font-black uppercase tracking-wider text-typography-900">
                    Refeições e Almoços
                  </h2>
                </div>
                {schedule.mealsHeaderTime && (
                  <span className="text-xs font-bold text-primary-200 bg-primary-200/10 px-2 py-0.5 rounded-lg border border-primary-200/20 flex items-center gap-1">
                    <Clock size={12} />
                    {schedule.mealsHeaderTime}
                  </span>
                )}
              </div>

              <div className="divide-y divide-surface-300/70">
                {(schedule.meals || []).map((meal, idx) => (
                  <div
                    key={meal.id || idx}
                    className="py-2.5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-xs font-black uppercase tracking-wider text-primary-200 bg-primary-200/10 px-2.5 py-0.5 rounded-lg border border-primary-200/20 w-20 text-center shrink-0">
                        {meal.day}
                      </span>
                      <span className="text-xs font-bold text-typography-900">
                        {meal.isLodging ? 'Almoço na Hospedagem' : (meal.host || <span className="text-typography-400 italic font-normal">Anfitrião a definir</span>)}
                      </span>
                    </div>

                    {!meal.isLodging && meal.addressPhone && (
                      <div className="text-xs text-typography-600 sm:text-right pl-1 sm:pl-0">
                        {meal.addressPhone}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* 4. REUNIÕES CONGREGACIONAIS */}
            <section className="bg-surface-100 rounded-2xl p-4 sm:p-5 border border-surface-300 shadow-xs space-y-4 relative">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary-200 via-primary-150 to-transparent rounded-t-2xl" />

              <div className="flex items-center gap-2 border-b border-surface-300 pb-2.5">
                <Calendar size={16} className="text-primary-200 shrink-0" />
                <h2 className="text-xs font-black uppercase tracking-wider text-typography-900">
                  Reuniões da Congregação
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* REUNIÃO DO MEIO DE SEMANA */}
                <div className="p-3.5 rounded-xl bg-surface-200/40 border border-surface-300 space-y-2.5">
                  <div className="flex items-center justify-between border-b border-surface-300 pb-2">
                    <span className="text-xs font-black uppercase tracking-wider text-primary-200">
                      Meio de Semana
                    </span>
                    {schedule.meetings?.midweek?.time && (
                      <span className="text-xs font-bold text-typography-800 flex items-center gap-1">
                        <Clock size={12} className="text-primary-200" />
                        {schedule.meetings.midweek.time}
                      </span>
                    )}
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-typography-500 block">
                      Discurso de Serviço
                    </span>
                    <p className="text-xs font-bold text-typography-900">
                      {schedule.meetings?.midweek?.serviceTalkTheme || 'A definir'}
                    </p>
                    {schedule.meetings?.midweek?.serviceTalkSong && (
                      <p className="text-[11px] text-typography-600">
                        Cântico: <strong>{schedule.meetings.midweek.serviceTalkSong}</strong>
                      </p>
                    )}
                  </div>
                </div>

                {/* REUNIÃO DE FIM DE SEMANA */}
                <div className="p-3.5 rounded-xl bg-surface-200/40 border border-surface-300 space-y-2.5">
                  <div className="flex items-center justify-between border-b border-surface-300 pb-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-black uppercase tracking-wider text-primary-200">
                        Fim de Semana
                      </span>
                      {schedule.meetings?.weekend?.day && (
                        <span className="text-[10px] font-bold uppercase text-typography-600 bg-surface-100 px-1.5 py-0.5 rounded border border-surface-300">
                          {schedule.meetings.weekend.day === 'sabado' ? 'Sábado' : 'Domingo'}
                        </span>
                      )}
                    </div>
                    {schedule.meetings?.weekend?.time && (
                      <span className="text-xs font-bold text-typography-800 flex items-center gap-1">
                        <Clock size={12} className="text-primary-200" />
                        {schedule.meetings.weekend.time}
                      </span>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-typography-500 block">
                        Discurso Público
                      </span>
                      <p className="text-xs font-bold text-typography-900">
                        {schedule.meetings?.weekend?.publicTalkTheme || 'A definir'}
                      </p>
                      {schedule.meetings?.weekend?.publicTalkSong && (
                        <p className="text-[11px] text-typography-600">
                          Cântico: <strong>{schedule.meetings.weekend.publicTalkSong}</strong>
                        </p>
                      )}
                    </div>

                    {schedule.meetings?.weekend?.finalTalkTheme && (
                      <div className="space-y-0.5 pt-2 border-t border-surface-300/70">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-typography-500 block">
                          Discurso Final
                        </span>
                        <p className="text-xs font-bold text-typography-900">
                          {schedule.meetings.weekend.finalTalkTheme}
                        </p>
                        {schedule.meetings?.weekend?.finalTalkSong && (
                          <p className="text-[11px] text-typography-600">
                            Cântico: <strong>{schedule.meetings.weekend.finalTalkSong}</strong>
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>

            {/* 5. REUNIÕES ADICIONAIS */}
            <section className="bg-surface-100 rounded-2xl p-4 sm:p-5 border border-surface-300 shadow-xs space-y-3 relative">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary-200 via-primary-150 to-transparent rounded-t-2xl" />

              <div className="flex items-center gap-2 border-b border-surface-300 pb-2.5">
                <Users size={16} className="text-primary-200 shrink-0" />
                <h2 className="text-xs font-black uppercase tracking-wider text-typography-900">
                  Reuniões Adicionais
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Reunião com Pioneiros */}
                <div className="p-3.5 rounded-xl bg-surface-200/40 border border-surface-300 flex items-center justify-between gap-2">
                  <div>
                    <span className="text-xs font-bold text-typography-900 block">
                      Pioneiros
                    </span>
                    <span className="text-[11px] text-typography-500">
                      {schedule.additionalMeetings?.pioneers?.day || 'Dia a definir'}
                    </span>
                  </div>
                  <span className="text-xs font-bold text-primary-200 bg-primary-200/10 px-2.5 py-1 rounded-lg border border-primary-200/20 flex items-center gap-1 shrink-0">
                    <Clock size={12} />
                    {schedule.additionalMeetings?.pioneers?.time || 'A definir'}
                  </span>
                </div>

                {/* Reunião com Anciãos e Servos */}
                <div className="p-3.5 rounded-xl bg-surface-200/40 border border-surface-300 flex items-center justify-between gap-2">
                  <div>
                    <span className="text-xs font-bold text-typography-900 block">
                      Anciãos e Servos Ministeriais
                    </span>
                    <span className="text-[11px] text-typography-500">
                      {schedule.additionalMeetings?.eldersAndServants?.day || 'Dia a definir'}
                    </span>
                  </div>
                  <span className="text-xs font-bold text-primary-200 bg-primary-200/10 px-2.5 py-1 rounded-lg border border-primary-200/20 flex items-center gap-1 shrink-0">
                    <Clock size={12} />
                    {schedule.additionalMeetings?.eldersAndServants?.time || 'A definir'}
                  </span>
                </div>
              </div>
            </section>
          </div>
        ) : (
          <div className="overflow-x-auto pb-6">
            <SemanaVisitaPrint
              data={schedule}
              isReadOnly={true}
              filterRole="esposa"
            />
          </div>
        )}
      </div>

      {/* COMPONENTE EXCLUSIVO PARA IMPRESSÃO DIRETA NA FOLHA BRANCA */}
      <div className="hidden print:block">
        <SemanaVisitaPrint
          data={schedule}
          isReadOnly={true}
          filterRole="esposa"
        />
      </div>
    </div>
  );
}

