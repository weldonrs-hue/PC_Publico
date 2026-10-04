'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import { VisitSchedule } from '@/types/visitSchedule';
import SemanaVisitaPrint from '@/components/visit/SemanaVisitaPrint';
import { Save, CheckCircle2, AlertCircle, Printer, ShieldCheck } from 'lucide-react';

export default function PublicVisitSchedulePage() {
  const params = useParams();
  const token = params?.token as string;

  const [schedule, setSchedule] = useState<VisitSchedule | null>(null);
  const [docId, setDocId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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
      <div className="min-h-screen bg-[#e8e8e8] flex flex-col items-center justify-center p-6 space-y-4">
        <div className="w-10 h-10 border-4 border-[#1a5c5a] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-semibold text-gray-700">Carregando programação da congregação...</p>
      </div>
    );
  }

  if (errorMsg && !schedule) {
    return (
      <div className="min-h-screen bg-[#e8e8e8] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-2xl p-8 text-center shadow-lg space-y-4">
          <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
            <AlertCircle size={28} />
          </div>
          <h2 className="text-lg font-bold text-gray-900">Link Não Encontrado</h2>
          <p className="text-xs text-gray-600">{errorMsg}</p>
        </div>
      </div>
    );
  }

  if (!schedule) return null;

  return (
    <div className="min-h-screen bg-[#e8e8e8] py-4 px-2 md:px-4">
      {/* BARRA FIXA SUPERIOR PARA OS ANCIÃOS */}
      <div className="max-w-[210mm] mx-auto bg-white border border-gray-200 rounded-2xl p-4 shadow-md mb-4 print:hidden space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider bg-teal-100 text-teal-800 px-2 py-0.5 rounded-md">
                Congregação {schedule.congregationName}
              </span>
              <span className="text-xs text-gray-500">•</span>
              <span className="text-xs font-semibold text-gray-600">
                {schedule.visitPeriod}
              </span>
            </div>
            <h1 className="text-base font-bold text-gray-900 mt-0.5">
              Preenchimento da Semana da Visita
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 bg-[#1a5c5a] hover:bg-[#155250] text-white px-5 py-2.5 rounded-xl font-bold text-xs shadow-md transition-all disabled:opacity-50"
            >
              <Save size={16} />
              {saving ? 'Salvando...' : 'Salvar Informações'}
            </button>

            <button
              onClick={() => window.print()}
              className="flex items-center justify-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 px-3.5 py-2.5 rounded-xl font-bold text-xs transition-colors"
              title="Imprimir folha"
            >
              <Printer size={16} />
              Imprimir
            </button>
          </div>
        </div>

        {savedSuccess && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-xl text-xs font-semibold flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0" />
            <span>
              <strong>Tudo certo!</strong> Informações salvas com sucesso. O viajante já pode visualizar os dados que você preencheu.
            </span>
          </div>
        )}

        <div className="flex items-center gap-2 text-[11px] text-gray-500 bg-gray-50 p-2.5 rounded-xl border border-gray-100">
          <ShieldCheck size={15} className="text-[#1a5c5a] flex-shrink-0" />
          <span>
            Os campos liberados para a congregação (locais de campo, almoços, pastoreios) podem ser editados diretamente abaixo. Ao terminar, clique no botão verde <strong>Salvar Informações</strong>.
          </span>
        </div>
      </div>

      {/* FOLHA NO LAYOUT A4 */}
      <SemanaVisitaPrint
        data={schedule}
        onChange={(updated) => setSchedule(updated)}
        isReadOnly={false}
        elderMode={true}
      />
    </div>
  );
}
