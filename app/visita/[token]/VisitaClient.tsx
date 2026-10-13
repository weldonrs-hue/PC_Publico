'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import { VisitSchedule, normalizeVisitSchedule } from '@/types/visitSchedule';
import SemanaVisitaPrint from '@/components/visit/SemanaVisitaPrint';
import SemanaVisitaForm from '@/components/visit/SemanaVisitaForm';
import ThemeSwitcher from '@/components/ui/theme-switcher';
import { AnimatePresence, motion } from 'motion/react';
import { 
  Save, 
  CheckCircle2, 
  AlertCircle, 
  Printer, 
  ShieldCheck, 
  Smartphone, 
  FileText, 
  Calendar,
  Building2,
  Users,
  RefreshCw,
} from 'lucide-react';

export default function PublicVisitScheduleClient() {
  const params = useParams();
  const token = params?.token as string;

  const [schedule, setSchedule] = useState<VisitSchedule | null>(null);
  const [savedScheduleSnapshot, setSavedScheduleSnapshot] = useState<VisitSchedule | null>(null);
  const [docId, setDocId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'form' | 'print'>('form');

  const serializeSchedule = (s: VisitSchedule | null) => {
    if (!s) return '';
    const { updatedAt, ...rest } = s;
    return JSON.stringify(rest);
  };

  const hasChanges = useMemo(
    () =>
      Boolean(
        schedule &&
          savedScheduleSnapshot &&
          serializeSchedule(schedule) !== serializeSchedule(savedScheduleSnapshot)
      ),
    [schedule, savedScheduleSnapshot]
  );

  // Parâmetros legíveis na URL para identificação imediata
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

  // Atualizar o título da aba do navegador para identificação clara da congregação e período
  useEffect(() => {
    const cong = schedule?.congregationName || urlCongName;
    const period = schedule?.visitPeriod || urlPeriod;
    if (cong) {
      document.title = `Semana da Visita — Congregação ${cong}${period ? ` (${period})` : ''}`;
    } else {
      document.title = 'Semana da Visita com a Congregação';
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
          setErrorMsg('Programação não encontrada ou o link informado expirou/é inválido.');
        } else {
          // Se houver mais de um documento com o mesmo shareToken (ex: migração legada),
          // seleciona o documento que foi atualizado mais recentemente
          const sortedDocs = [...snap.docs].sort((a, b) => {
            const dateA = new Date(a.data().updatedAt || a.data().createdAt || 0).getTime();
            const dateB = new Date(b.data().updatedAt || b.data().createdAt || 0).getTime();
            return dateB - dateA;
          });
          const docFound = sortedDocs[0];
          setDocId(docFound.id);
          const loaded = normalizeVisitSchedule(docFound.data() as VisitSchedule);
          setSchedule(loaded);
          setSavedScheduleSnapshot(JSON.parse(JSON.stringify(loaded)));
        }
      } catch (err: any) {
        console.error('Erro ao buscar programação pública:', err);
        setErrorMsg('Erro de conexão ao buscar a programação. Tente recarregar a página.');
      } finally {
        setLoading(false);
      }
    };

    fetchSchedule();
  }, [token]);

  const handleSave = async () => {
    if (!docId || !schedule) return;
    setSaving(true);
    setSavedSuccess(false);
    setErrorMsg(null);
    try {
      const docRef = doc(db, 'visit_schedules', docId);
      const updatedSchedule: VisitSchedule = {
        ...schedule,
        status: 'preenchido',
        updatedAt: new Date().toISOString(),
      };
      await updateDoc(docRef, {
        fieldService: schedule.fieldService,
        studiesAndVisits: schedule.studiesAndVisits,
        meetings: schedule.meetings,
        additionalMeetings: schedule.additionalMeetings,
        mealsHeaderTime: schedule.mealsHeaderTime,
        meals: schedule.meals,
        shepherding: schedule.shepherding,
        eldersMeetingInput: schedule.eldersMeetingInput,
        status: 'preenchido',
        updatedAt: updatedSchedule.updatedAt,
      });
      setSchedule(updatedSchedule);
      setSavedScheduleSnapshot(JSON.parse(JSON.stringify(updatedSchedule)));
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 5000);
    } catch (err: any) {
      console.error('Erro ao salvar alterações dos anciãos:', err);
      setErrorMsg('Não foi possível salvar as alterações. Verifique sua conexão e tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-200 flex flex-col items-center justify-center p-6 space-y-4">
        <div className="w-10 h-10 border-4 border-primary-200 border-t-transparent rounded-full animate-spin" />
        <div className="text-center space-y-1">
          <p className="text-sm font-bold text-typography-900">
            Carregando programação da visita...
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
          {urlCongName && (
            <div className="bg-surface-200/60 p-3 rounded-xl border border-surface-300 text-xs text-typography-700">
              Tentando acessar: <strong>Congregação {urlCongName}</strong>
              {urlPeriod && <span> ({urlPeriod})</span>}
            </div>
          )}
          <p className="text-[11px] text-typography-400">
            Verifique se o superintendente de circuito gerou um novo link para esta visita e solicite o link atualizado.
          </p>
        </div>
      </div>
    );
  }

  if (!schedule) return null;

  return (
    <div className="min-h-screen bg-surface-200/60 pb-24 md:pb-12 pt-3 px-3 md:px-6">
      {/* CABEÇALHO SUPERIOR DESTACADO E IDENTIFICÁVEL */}
      <div className="max-w-2xl mx-auto bg-surface-100 border border-surface-300 rounded-2xl p-4 sm:p-5 shadow-sm mb-4 print:hidden space-y-4 relative">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary-200 via-primary-150 to-transparent rounded-t-2xl" />
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            {/* Badges de Identificação Clara */}
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
                <span>Superintendente de Circuito: <strong>{schedule.coupleNames}</strong></span>
              </div>
            )}
          </div>

          {/* Botões de Ação Superiores */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 bg-primary-200 hover:bg-primary-300 text-white px-5 py-2.5 rounded-xl font-bold text-xs shadow-xs transition-all disabled:opacity-50 cursor-pointer"
            >
              {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save size={16} />}
              {saving ? 'Salvando...' : 'Salvar Informações'}
            </button>

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

        {/* FEEDBACK DE SALVAMENTO */}
        {savedSuccess && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 p-3 rounded-xl text-xs font-semibold flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            <span>
              <strong>Tudo certo!</strong> Informações salvas com sucesso. O viajante já pode visualizar os dados atualizados.
            </span>
          </div>
        )}

        {/* SELETOR DE MODO: FORMULÁRIO RESPONSIVO VS FOLHA A4 */}
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

          <div className="hidden sm:flex items-center gap-1 text-[11px] text-typography-400">
            <ShieldCheck size={13} className="text-emerald-500" />
            <span>Sincronização Segura</span>
          </div>
        </div>
      </div>

      {/* ÁREA DE CONTEÚDO PRINCIPAL (TELA) */}
      <div className="print:hidden">
        {viewMode === 'form' ? (
          <SemanaVisitaForm
            data={schedule}
            onChange={(updated) => setSchedule(updated)}
            elderMode={true}
          />
        ) : (
          <div className="overflow-x-auto pb-6">
            <SemanaVisitaPrint
              data={schedule}
              onChange={(updated) => setSchedule(updated)}
              isReadOnly={false}
              elderMode={true}
            />
          </div>
        )}
      </div>

      {/* COMPONENTE EXCLUSIVO PARA IMPRESSÃO (sempre pronto quando apertar Ctrl+P ou Imprimir) */}
      <div className="hidden print:block">
        <SemanaVisitaPrint
          data={schedule}
          isReadOnly={true}
          elderMode={true}
        />
      </div>

      {/* BARRA FLUTUANTE SUSPENSA PARA SALVAR (quando houver alterações não salvas) */}
      <AnimatePresence>
        {hasChanges && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            className="fixed bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-[1002] bg-surface-100/95 dark:bg-surface-200/95 text-typography-900 backdrop-blur-md px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-2xl shadow-xl flex items-center justify-between gap-2.5 sm:gap-4 border border-surface-300 w-[calc(100vw-1.5rem)] max-w-md print:hidden"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
              </span>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold text-typography-900 truncate">
                  Alterações não salvas
                </span>
                <span className="text-[10px] text-typography-400 font-mono truncate hidden sm:inline">
                  {schedule.congregationName || 'Semana da Visita'}
                  {schedule.visitPeriod ? ` • ${schedule.visitPeriod}` : ''}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  if (savedScheduleSnapshot) {
                    setSchedule(JSON.parse(JSON.stringify(savedScheduleSnapshot)));
                  }
                }}
                disabled={saving}
                className="px-2.5 py-1.5 text-xs font-semibold text-typography-500 hover:text-typography-800 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
              >
                Descartar
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="px-3 sm:px-3.5 py-1.5 bg-primary-200 hover:bg-primary-150 active:scale-95 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 whitespace-nowrap"
              >
                {saving ? (
                  <>
                    <RefreshCw size={13} className="animate-spin shrink-0" />
                    <span>Salvando...</span>
                  </>
                ) : (
                  <>
                    <Save size={13} className="shrink-0" />
                    <span>Salvar</span>
                  </>
                )}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

