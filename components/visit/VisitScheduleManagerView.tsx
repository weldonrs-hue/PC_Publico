'use client';

import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Share2, 
  Copy, 
  Check, 
  ExternalLink, 
  Printer, 
  Save, 
  Lock, 
  Unlock, 
  Calendar, 
  Clock, 
  Sparkles,
  MessageCircle,
  FileText,
  AlertCircle,
  Eye,
  Settings2
} from 'lucide-react';
import { VisitSchedule, INITIAL_VISIT_SCHEDULE } from '@/types/visitSchedule';
import SemanaVisitaPrint from './SemanaVisitaPrint';
import { db } from '@/lib/firebase';
import { 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  query, 
  where, 
  getDocs,
  onSnapshot 
} from 'firebase/firestore';

interface VisitScheduleManagerViewProps {
  userId: string;
  congregationId: string;
  congregationName: string;
  visitPeriod?: string;
  onBack: () => void;
}

export default function VisitScheduleManagerView({
  userId,
  congregationId,
  congregationName,
  visitPeriod = '',
  onBack,
}: VisitScheduleManagerViewProps) {
  const [schedule, setSchedule] = useState<VisitSchedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'preview' | 'permissions'>('preview');
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // ID do documento baseado na congregação e no usuário
  const docId = `visit_${userId}_${congregationId}`;

  // Gerar um token aleatório simples de 10 caracteres
  const generateToken = () => {
    return Math.random().toString(36).substring(2, 8) + Math.random().toString(36).substring(2, 6);
  };

  useEffect(() => {
    let unsubscribe: () => void;

    const loadData = async () => {
      setLoading(true);
      try {
        const docRef = doc(db, 'visit_schedules', docId);
        
        // Listener em tempo real
        unsubscribe = onSnapshot(docRef, (docSnap) => {
          if (docSnap.exists()) {
            setSchedule(docSnap.data() as VisitSchedule);
          } else {
            // Inicializar novo rascunho
            const newSchedule: VisitSchedule = {
              ...INITIAL_VISIT_SCHEDULE,
              id: docId,
              userId,
              congregationId,
              congregationName,
              visitPeriod: visitPeriod || 'Semana da Visita',
              shareToken: generateToken(),
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            setSchedule(newSchedule);
          }
          setLoading(false);
        });
      } catch (err: any) {
        console.error('Erro ao carregar programação da visita:', err);
        setFeedbackMsg({ type: 'error', text: 'Erro ao carregar dados do banco.' });
        setLoading(false);
      }
    };

    loadData();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [docId, userId, congregationId, congregationName, visitPeriod]);

  const handleSave = async (customSchedule?: VisitSchedule) => {
    const toSave = customSchedule || schedule;
    if (!toSave) return;
    setSaving(true);
    setFeedbackMsg(null);
    try {
      const docRef = doc(db, 'visit_schedules', docId);
      const dataToSave = {
        ...toSave,
        updatedAt: new Date().toISOString(),
      };
      await setDoc(docRef, dataToSave, { merge: true });
      setFeedbackMsg({ type: 'success', text: 'Programação salva com sucesso!' });
      setTimeout(() => setFeedbackMsg(null), 3000);
    } catch (err: any) {
      console.error('Erro ao salvar:', err);
      setFeedbackMsg({ type: 'error', text: 'Não foi possível salvar as alterações.' });
    } finally {
      setSaving(false);
    }
  };

  // URL do link público para os anciãos
  const publicUrl = typeof window !== 'undefined' && schedule?.shareToken
    ? `${window.location.origin}/visita/${schedule.shareToken}`
    : '';

  const handleCopyLink = () => {
    if (!publicUrl) return;
    navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleWhatsAppShare = () => {
    if (!publicUrl || !schedule) return;
    const msg = encodeURIComponent(
      `Olá, irmãos da comissão de serviço da Congregação *${schedule.congregationName}*!\n\n` +
      `Segue o link para preencher a programação de atividades da *Semana da Visita* (${schedule.visitPeriod}):\n\n` +
      `👉 ${publicUrl}\n\n` +
      `Basta acessar pelo celular ou computador, preencher os detalhes (locais de saída de campo, almoços, pastoreios) e clicar em salvar.`
    );
    window.open(`https://api.whatsapp.com/send?text=${msg}`, '_blank');
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 space-y-4">
        <div className="w-8 h-8 border-4 border-[#1a5c5a] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-medium text-gray-600">Carregando programação da visita...</p>
      </div>
    );
  }

  if (!schedule) return null;

  return (
    <div className="space-y-6 max-w-6xl mx-auto w-full pb-16">
      {/* BARRA SUPERIOR DE AÇÕES (Não sai na impressão) */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 md:p-5 shadow-sm space-y-4 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-100 pb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-600"
              title="Voltar"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200">
                  Semana da Visita
                </span>
                <span className="text-xs text-gray-500">•</span>
                <span className="text-xs font-semibold text-gray-500">
                  {schedule.visitPeriod}
                </span>
              </div>
              <h1 className="text-xl font-black text-gray-900 tracking-tight">
                {schedule.congregationName}
              </h1>
            </div>
          </div>

          {/* Botões de Ação */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => handleSave()}
              disabled={saving}
              className="flex items-center gap-2 bg-[#1a5c5a] hover:bg-[#155250] text-white px-4 py-2 rounded-xl font-bold text-xs shadow-sm transition-all disabled:opacity-50"
            >
              <Save size={15} />
              {saving ? 'Salvando...' : 'Salvar Alterações'}
            </button>

            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-3.5 py-2 rounded-xl font-bold text-xs transition-colors"
            >
              <Printer size={15} />
              Imprimir / PDF
            </button>
          </div>
        </div>

        {/* ÁREA DE COMPARTILHAMENTO COM ANCIÃOS */}
        <div className="bg-gradient-to-r from-teal-50 to-emerald-50 border border-teal-100 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Share2 size={16} className="text-[#1a5c5a]" />
              <h3 className="text-xs font-bold uppercase tracking-wide text-[#1a5c5a]">
                Link de Preenchimento para os Anciãos
              </h3>
            </div>
            <p className="text-xs text-gray-600">
              Envie este link para a congregação preencher os locais de campo, almoços e pastoreio sem precisar de login.
            </p>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <button
              onClick={handleCopyLink}
              className="flex-1 md:flex-initial flex items-center justify-center gap-1.5 bg-white border border-teal-300 text-teal-800 hover:bg-teal-50 px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm transition-colors"
            >
              {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
              {copied ? 'Link Copiado!' : 'Copiar Link'}
            </button>

            <button
              onClick={handleWhatsAppShare}
              className="flex-1 md:flex-initial flex items-center justify-center gap-1.5 bg-[#25D366] hover:bg-[#20bd5a] text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm transition-colors"
            >
              <MessageCircle size={14} />
              WhatsApp
            </button>

            {publicUrl && (
              <a
                href={publicUrl}
                target="_blank"
                rel="noreferrer"
                className="p-1.5 text-gray-400 hover:text-teal-700 rounded-lg hover:bg-white/80 transition-colors"
                title="Abrir página pública em nova aba"
              >
                <ExternalLink size={16} />
              </a>
            )}
          </div>
        </div>

        {/* FEEDBACK MENSAGEM */}
        {feedbackMsg && (
          <div className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
            feedbackMsg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
          }`}>
            {feedbackMsg.type === 'success' ? <Check size={15} /> : <AlertCircle size={15} />}
            {feedbackMsg.text}
          </div>
        )}

        {/* NAVEGAÇÃO DE ABAS */}
        <div className="flex border-b border-gray-100 gap-4 pt-1">
          <button
            onClick={() => setActiveTab('preview')}
            className={`pb-2.5 text-xs font-bold flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'preview'
                ? 'border-[#1a5c5a] text-[#1a5c5a]'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Eye size={15} />
            Folha da Visita (A4)
          </button>

          <button
            onClick={() => setActiveTab('permissions')}
            className={`pb-2.5 text-xs font-bold flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'permissions'
                ? 'border-[#1a5c5a] text-[#1a5c5a]'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Settings2 size={15} />
            Permissões dos Anciãos
          </button>
        </div>
      </div>

      {/* CONTEÚDO DA ABA */}
      {activeTab === 'preview' && (
        <div className="space-y-4">
          <div className="text-center text-xs text-gray-500 print:hidden">
            💡 <em>Você pode editar qualquer campo diretamente na folha abaixo. As alterações serão salvas ao clicar em Salvar ou ao mudar de campo.</em>
          </div>

          <SemanaVisitaPrint
            data={schedule}
            onChange={(updated) => {
              setSchedule(updated);
            }}
            isReadOnly={false}
            elderMode={false}
          />
        </div>
      )}

      {activeTab === 'permissions' && (
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-6 print:hidden">
          <div>
            <h2 className="text-base font-bold text-gray-900">O que os Anciãos podem preencher?</h2>
            <p className="text-xs text-gray-500 mt-1">
              Defina quais seções da folha ficarão liberadas para edição quando os anciãos abrirem o link público.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              {
                key: 'allowFieldServiceEdit',
                label: 'Locais e Horários do Serviço de Campo',
                desc: 'Permite que definam onde será a saída de campo e os horários.',
              },
              {
                key: 'allowMealsEdit',
                label: 'Refeições e Anfitriões',
                desc: 'Permite informar os nomes dos anfitriões e endereços para almoço.',
              },
              {
                key: 'allowShepherdingEdit',
                label: 'Visitas de Pastoreio',
                desc: 'Permite preencher as famílias, acompanhantes e situações.',
              },
              {
                key: 'allowStudiesEdit',
                label: 'Acompanhantes de Estudos e Revisitas',
                desc: 'Permite preencher os acompanhantes/telefones para os estudos do casal.',
              },
              {
                key: 'allowWeekendMeetingTimeEdit',
                label: 'Horário e Dia da Reunião de Fim de Semana',
                desc: 'Permite escolher se a reunião é Sábado ou Domingo e o horário de início.',
              },
              {
                key: 'allowAdditionalMeetingsEdit',
                label: 'Reuniões Adicionais (Pioneiros / Anciãos)',
                desc: 'Permite que alterem os dias e horários das reuniões especiais.',
              },
            ].map((item) => {
              const isAllowed = !!(schedule.permissions as any)[item.key];
              return (
                <div
                  key={item.key}
                  onClick={() => {
                    const updated = {
                      ...schedule,
                      permissions: {
                        ...schedule.permissions,
                        [item.key]: !isAllowed,
                      },
                    };
                    setSchedule(updated);
                    handleSave(updated);
                  }}
                  className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex items-start gap-3.5 ${
                    isAllowed
                      ? 'border-[#1a5c5a] bg-teal-50/40 text-gray-900'
                      : 'border-gray-100 bg-gray-50/50 text-gray-500'
                  }`}
                >
                  <div
                    className={`mt-0.5 p-1.5 rounded-lg ${
                      isAllowed ? 'bg-[#1a5c5a] text-white' : 'bg-gray-200 text-gray-400'
                    }`}
                  >
                    {isAllowed ? <Unlock size={14} /> : <Lock size={14} />}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold">{item.label}</h4>
                    <p className="text-[11px] text-gray-500 mt-0.5">{item.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
