'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import { VisitSchedule } from '@/types/visitSchedule';
import SemanaVisitaPrint from '@/components/visit/SemanaVisitaPrint';
import SemanaVisitaForm from '@/components/visit/SemanaVisitaForm';
import { Save, CheckCircle2, AlertCircle, Printer, ShieldCheck, Smartphone, FileText, Check } from 'lucide-react';

export default function PublicVisitSchedulePage() {
  const params = useParams();
  const token = params?.token as string;

  const [schedule, setSchedule] = useState<VisitSchedule | null>(null);
  const [docId, setDocId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'form' | 'print'>('form');

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
          const docFound = snap.docs[0];
          setDocId(docFound.id);
          setSchedule(docFound.data() as VisitSchedule);
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
      await updateDoc(docRef, {
        fieldService: schedule.fieldService,
        studiesAndVisits: schedule.studiesAndVisits,
        meetings: schedule.meetings,
        additionalMeetings: schedule.additionalMeetings,
        mealsHeaderTime: schedule.mealsHeaderTime,
        meals: schedule.meals,
        shepherding: schedule.shepherding,
        status: 'preenchido',
        updatedAt: new Date().toISOString(),
      });
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
        <p className="text-sm font-semibold text-typography-700">Carregando programação da congregação...</p>
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
          <p className="text-xs text-typography-600 leading-relaxed">{errorMsg}</p>
        </div>
      </div>
    );
  }

  if (!schedule) return null;

  return (
    <div className="min-h-screen bg-surface-200/60 pb-24 md:pb-12 pt-3 px-3 md:px-6">
      {/* CABEÇALHO SUPERIOR FIXO / COMPACTO */}
      <div className="max-w-2xl mx-auto bg-surface-100 border border-surface-300 rounded-2xl p-4 shadow-sm mb-4 print:hidden space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-black uppercase tracking-wider bg-primary-200/10 text-primary-200 border border-primary-200/20 px-2 py-0.5 rounded-md">
                Congregação {schedule.congregationName}
              </span>
              <span className="text-xs text-typography-400">•</span>
              <span className="text-xs font-semibold text-typography-500">
                {schedule.visitPeriod}
              </span>
            </div>
            <h1 className="text-base font-black text-typography-900 mt-1 tracking-tight">
              Semana da Visita
            </h1>
          </div>

          <div className="flex items-center gap-2">
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
          </div>
        </div>

        {/* FEEDBACK DE SALVAMENTO */}
        {savedSuccess && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 p-3 rounded-xl text-xs font-semibold flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0" />
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

      {/* BARRA FLUTUANTE INFERIOR NO CELULAR (Garante que o botão de salvar está sempre visível) */}
      <div className="fixed bottom-0 left-0 right-0 p-3 bg-surface-100/95 backdrop-blur-md border-t border-surface-300 shadow-lg md:hidden print:hidden z-50">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
          <div className="text-[11px] text-typography-500 truncate">
            {savedSuccess ? (
              <span className="text-emerald-600 font-bold flex items-center gap-1">
                <Check size={14} /> Salvo!
              </span>
            ) : (
              <span>Preencha e salve</span>
            )}
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 max-w-[200px] flex items-center justify-center gap-2 bg-primary-200 hover:bg-primary-300 text-white py-3 px-4 rounded-xl font-bold text-xs shadow-md transition-all disabled:opacity-50 cursor-pointer"
          >
            {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save size={16} />}
            {saving ? 'Salvando...' : 'Salvar Informações'}
          </button>
        </div>
      </div>
    </div>
  );
}
