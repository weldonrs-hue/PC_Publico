'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { VisitSchedule, normalizeVisitSchedule } from '@/types/visitSchedule';
import ThemeSwitcher from '@/components/ui/theme-switcher';
import {
  Calendar,
  Building2,
  Users,
  Clock,
  MapPin,
  Printer,
  AlertCircle
} from 'lucide-react';

export default function CongregacaoMuralClient() {
  const params = useParams();
  const token = params?.token as string;

  const [schedule, setSchedule] = useState<VisitSchedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Parâmetros opcionais na URL
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
      document.title = `Mural da Visita — Congregação ${cong}${period ? ` (${period})` : ''}`;
    } else {
      document.title = 'Mural da Semana da Visita';
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
        console.error('Erro ao buscar mural público:', err);
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
            Carregando mural da semana da visita...
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
          <h2 className="text-lg font-black text-typography-900">Link Não Encontrado</h2>
          <p className="text-xs text-typography-600 leading-relaxed">
            {errorMsg}
          </p>
          <p className="text-[11px] text-typography-400">
            Solicite o link atualizado ao corpo de anciãos da sua congregação.
          </p>
        </div>
      </div>
    );
  }

  if (!schedule) return null;

  return (
    <div className="min-h-screen bg-surface-200/60 text-typography-900 pb-16 pt-3 px-3 md:px-6 print:bg-white print:p-0">
      {/* CABEÇALHO SUPERIOR CLEAN E PADRONIZADO COM FAIXA GRADIENTE */}
      <div className="max-w-2xl mx-auto bg-surface-100 border border-surface-300 rounded-2xl p-4 sm:p-5 shadow-xs mb-4 print:border-none print:shadow-none print:p-0 print:mb-4 relative">
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
                Mural da Semana da Visita
              </h1>
            </div>

            {schedule.coupleNames && (
              <div className="text-xs text-typography-500 font-medium flex items-center gap-1.5">
                <Users size={12} className="text-primary-200" />
                <span>Superintendente de Circuito: <strong>{schedule.coupleNames}</strong></span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0 print:hidden">
            <button
              onClick={() => window.print()}
              className="flex items-center justify-center gap-1.5 bg-surface-200 hover:bg-surface-300 border border-surface-300 text-typography-800 px-3.5 py-2.5 rounded-xl font-bold text-xs transition-colors cursor-pointer"
              title="Imprimir Mural"
            >
              <Printer size={16} />
              <span className="hidden sm:inline">Imprimir</span>
            </button>

            <ThemeSwitcher />
          </div>
        </div>
      </div>

      {/* CONTEÚDO DO MURAL CLEAN */}
      <div className="max-w-2xl mx-auto space-y-4">
        {/* 1. SAÍDAS DE SERVIÇO DE CAMPO */}
        <section className="bg-surface-100 rounded-2xl p-4 sm:p-5 border border-surface-300 shadow-xs space-y-3 print:bg-white print:shadow-none relative">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary-200 via-primary-150 to-transparent rounded-t-2xl print:hidden" />

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

        {/* 2. REUNIÕES CONGREGACIONAIS */}
        <section className="bg-surface-100 rounded-2xl p-4 sm:p-5 border border-surface-300 shadow-xs space-y-4 print:bg-white print:shadow-none relative">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary-200 via-primary-150 to-transparent rounded-t-2xl print:hidden" />

          <div className="flex items-center gap-2 border-b border-surface-300 pb-2.5">
            <Calendar size={16} className="text-primary-200 shrink-0" />
            <h2 className="text-xs font-black uppercase tracking-wider text-typography-900">
              Reuniões da Congregação
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* REUNIÃO DO MEIO DE SEMANA */}
            <div className="p-3.5 rounded-xl bg-surface-200/40 border border-surface-300 space-y-2.5 print:bg-white">
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
            <div className="p-3.5 rounded-xl bg-surface-200/40 border border-surface-300 space-y-2.5 print:bg-white">
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

        {/* 3. REUNIÕES ADICIONAIS */}
        <section className="bg-surface-100 rounded-2xl p-4 sm:p-5 border border-surface-300 shadow-xs space-y-3 print:bg-white print:shadow-none relative">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary-200 via-primary-150 to-transparent rounded-t-2xl print:hidden" />

          <div className="flex items-center gap-2 border-b border-surface-300 pb-2.5">
            <Users size={16} className="text-primary-200 shrink-0" />
            <h2 className="text-xs font-black uppercase tracking-wider text-typography-900">
              Reuniões Adicionais
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Reunião com Pioneiros */}
            <div className="p-3.5 rounded-xl bg-surface-200/40 border border-surface-300 flex items-center justify-between gap-2 print:bg-white">
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
            <div className="p-3.5 rounded-xl bg-surface-200/40 border border-surface-300 flex items-center justify-between gap-2 print:bg-white">
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
    </div>
  );
}

