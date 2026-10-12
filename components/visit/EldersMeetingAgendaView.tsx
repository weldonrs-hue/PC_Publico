'use client';

import CustomSelect, { CustomSelectOption } from '@/components/CustomSelect';
import { db } from '@/lib/firebase';
import {
  AgendaRecommendationItem,
  AgendaTopicItem,
  DEFAULT_AGENDA_FOOTER_NOTE,
  EldersMeetingAgenda,
  normalizeEldersMeetingAgenda,
} from '@/types/eldersMeetingAgenda';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
} from 'firebase/firestore';
import {
  AlertCircle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  BookOpen,
  Calendar,
  Check,
  CheckCircle2,
  ClipboardList,
  ClipboardPaste,
  Clock,
  Copy,
  Eye,
  FileText,
  HelpCircle,
  Lock,
  Plus,
  Printer,
  Quote,
  RefreshCw,
  RotateCcw,
  Save,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Trash2,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface EldersMeetingAgendaViewProps {
  userId: string;
  congregationId: string;
  congregationName: string;
  visitPeriod?: string;
  visitId?: string;
  onBack: () => void;
}

export default function EldersMeetingAgendaView({
  userId,
  congregationId,
  congregationName,
  visitPeriod = '',
  visitId,
  onBack,
}: EldersMeetingAgendaViewProps) {
  const [agenda, setAgenda] = useState<EldersMeetingAgenda | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState<EldersMeetingAgenda | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const isDirtyRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'form' | 'preview'>('form');
  const [mobileSection, setMobileSection] = useState<'geral' | 'assuntos' | 'recomendacoes'>('assuntos');
  const [openExcerptIds, setOpenExcerptIds] = useState<Record<string, boolean>>({});
  const [feedbackMsg, setFeedbackMsg] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  // Estados para replicação de pauta de outra semana
  const [isReplicateModalOpen, setIsReplicateModalOpen] = useState(false);
  const [previousAgendas, setPreviousAgendas] = useState<EldersMeetingAgenda[]>([]);
  const [loadingPrevious, setLoadingPrevious] = useState(false);
  const [selectedSourceId, setSelectedSourceId] = useState<string>('');
  const [replicating, setReplicating] = useState(false);

  const safeUserId = (userId || 'default_user').replace(/[\/\s]/g, '_');
  const safeCongId = (congregationId || 'cong_temp').replace(/[\/\s]/g, '_');
  const safeVisitKey = (
    visitId || (visitPeriod ? visitPeriod.replace(/[^a-zA-Z0-9]/g, '_') : 'atual')
  )
    .trim()
    .slice(0, 32);

  const docId = `agenda_${safeUserId}_${safeCongId}_${safeVisitKey}`;

  const serializeAgenda = (a: EldersMeetingAgenda | null) => {
    if (!a) return '';
    const { updatedAt, ...rest } = a;
    return JSON.stringify(rest);
  };

  const updateAgenda = (updater: (prev: EldersMeetingAgenda) => EldersMeetingAgenda) => {
    setAgenda((prev) => {
      if (!prev) return prev;
      const next = updater(prev);
      return next;
    });
    setIsDirty(true);
    isDirtyRef.current = true;
  };

  const hasChanges = useMemo(
    () =>
      isDirty ||
      Boolean(
        agenda &&
          savedSnapshot &&
          serializeAgenda(agenda) !== serializeAgenda(savedSnapshot)
      ),
    [isDirty, agenda, savedSnapshot]
  );

  useEffect(() => {
    let isCancelled = false;
    setAgenda(null);
    setSavedSnapshot(null);
    setIsDirty(false);
    isDirtyRef.current = false;
    setLoading(true);
    setFeedbackMsg(null);

    const loadAgenda = async () => {
      try {
        const docRef = doc(db, 'elders_meeting_agendas', docId);
        const snap = await getDoc(docRef);

        if (isCancelled) return;

        if (snap.exists()) {
          const loaded = normalizeEldersMeetingAgenda(
            snap.data() as EldersMeetingAgenda,
            congregationName,
            visitPeriod
          );
          setAgenda(loaded);
          setSavedSnapshot(JSON.parse(JSON.stringify(loaded)));
        } else {
          const initial = normalizeEldersMeetingAgenda(
            {
              id: docId,
              userId,
              congregationId,
              congregationName,
              visitPeriod,
              visitId,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
            congregationName,
            visitPeriod
          );
          setAgenda(initial);
          setSavedSnapshot(JSON.parse(JSON.stringify(initial)));
        }
      } catch (err) {
        console.error('Erro ao carregar pauta da reunião de anciãos:', err);
        if (!isCancelled) {
          const fallback = normalizeEldersMeetingAgenda(
            {
              id: docId,
              userId,
              congregationId,
              congregationName,
              visitPeriod,
              visitId,
            },
            congregationName,
            visitPeriod
          );
          setAgenda(fallback);
          setSavedSnapshot(JSON.parse(JSON.stringify(fallback)));
          setFeedbackMsg({
            type: 'error',
            text: 'Não foi possível carregar os dados salvos. Verifique sua conexão.',
          });
        }
      } finally {
        if (!isCancelled) setLoading(false);
      }
    };

    loadAgenda();
    return () => {
      isCancelled = true;
    };
  }, [docId, userId, congregationId, congregationName, visitPeriod, visitId]);

  const handleSave = async (customAgenda?: EldersMeetingAgenda) => {
    const toSave = customAgenda || agenda;
    if (!toSave) return;
    setSaving(true);
    setFeedbackMsg(null);
    try {
      const docRef = doc(db, 'elders_meeting_agendas', docId);
      const dataToSave: EldersMeetingAgenda = {
        ...toSave,
        id: docId,
        userId,
        congregationId,
        updatedAt: new Date().toISOString(),
      };
      await setDoc(docRef, dataToSave, { merge: true });
      setSavedSnapshot(JSON.parse(JSON.stringify(dataToSave)));
      setIsDirty(false);
      isDirtyRef.current = false;
      setFeedbackMsg({ type: 'success', text: 'Pauta salva com sucesso!' });
      setTimeout(() => setFeedbackMsg(null), 3000);
    } catch (err) {
      console.error('Erro ao salvar pauta:', err);
      setFeedbackMsg({
        type: 'error',
        text: 'Não foi possível salvar as alterações.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleOpenReplicateModal = async () => {
    setIsReplicateModalOpen(true);
    setLoadingPrevious(true);
    try {
      const q1 = query(
        collection(db, 'elders_meeting_agendas'),
        where('userId', '==', userId)
      );
      const snap = await getDocs(q1);
      const list: EldersMeetingAgenda[] = [];
      snap.forEach((d) => {
        if (d.id !== docId) {
          const item = normalizeEldersMeetingAgenda(d.data() as EldersMeetingAgenda);
          list.push({ ...item, id: d.id });
        }
      });

      list.sort((a, b) => {
        const dateA = new Date(a.updatedAt || a.createdAt || 0).getTime();
        const dateB = new Date(b.updatedAt || b.createdAt || 0).getTime();
        return dateB - dateA;
      });

      setPreviousAgendas(list);
      if (list.length > 0) {
        setSelectedSourceId(list[0].id || '');
      }
    } catch (err) {
      console.error('Erro ao buscar pautas anteriores:', err);
      setFeedbackMsg({
        type: 'error',
        text: 'Não foi possível carregar o histórico de pautas.',
      });
    } finally {
      setLoadingPrevious(false);
    }
  };

  const executeReplication = async (source: EldersMeetingAgenda) => {
    if (!agenda) return;
    setReplicating(true);
    try {
      const replicated: EldersMeetingAgenda = {
        ...agenda,
        topics: (source.topics || []).map((t, idx) => ({
          id: `topic_${Date.now()}_${idx}`,
          subject: (t.subject || '').toUpperCase(),
          reference: t.reference || '',
          referenceText: t.referenceText || '',
          duration: t.duration || '',
        })),
        footerNote: source.footerNote || agenda.footerNote,
      };
      setAgenda(replicated);
      setIsDirty(true);
      isDirtyRef.current = true;
      setIsReplicateModalOpen(false);
      setFeedbackMsg({
        type: 'success',
        text: `Assuntos e referências copiados de "${source.congregationName}"! Clique em Salvar para gravar.`,
      });
      setTimeout(() => setFeedbackMsg(null), 4000);
    } finally {
      setReplicating(false);
    }
  };

  const selectedSourceAgenda = useMemo(() => {
    return (
      previousAgendas.find((p) => p.id === selectedSourceId) ||
      previousAgendas[0] ||
      null
    );
  }, [previousAgendas, selectedSourceId]);

  const formatTopicDuration = (raw?: string) => {
    if (!raw || !raw.trim()) return '';
    const trimmed = raw.trim();
    if (/^\d+$/.test(trimmed)) {
      return `${trimmed} MIN`;
    }
    return trimmed.toUpperCase();
  };

  // Helpers para manipular Assuntos
  const addTopic = () => {
    updateAgenda((prev) => ({
      ...prev,
      topics: [
        ...prev.topics,
        {
          id: `topic_${Date.now()}`,
          subject: '',
          reference: '',
          referenceText: '',
          duration: '',
        },
      ],
    }));
  };

  const updateTopic = (idx: number, field: keyof AgendaTopicItem, value: string) => {
    const finalValue = field === 'subject' ? value.toUpperCase() : value;
    updateAgenda((prev) => {
      const next = [...prev.topics];
      next[idx] = { ...next[idx], [field]: finalValue };
      return { ...prev, topics: next };
    });
  };

  const handlePasteParagraph = async (idx: number, topicId: string) => {
    setOpenExcerptIds((prev) => ({ ...prev, [topicId]: true }));
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text && text.trim()) {
          updateAgenda((prev) => {
            const next = [...prev.topics];
            const current = next[idx]?.referenceText?.trim() || '';
            const merged = current ? `${current}\n\n${text.trim()}` : text.trim();
            next[idx] = { ...next[idx], referenceText: merged };
            return { ...prev, topics: next };
          });
          setFeedbackMsg({
            type: 'info',
            text: `Parágrafo colado no Assunto #${idx + 1}!`,
          });
          setTimeout(() => setFeedbackMsg(null), 2500);
        }
      }
    } catch {
      // Se o navegador bloquear leitura direta da área de transferência, apenas abre o campo para colar manualmente
    }
  };

  const removeTopic = (idx: number) => {
    updateAgenda((prev) => ({
      ...prev,
      topics: prev.topics.filter((_, i) => i !== idx),
    }));
  };

  const moveTopic = (idx: number, direction: 'up' | 'down') => {
    updateAgenda((prev) => {
      const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= prev.topics.length) return prev;
      const next = [...prev.topics];
      const temp = next[idx];
      next[idx] = next[targetIdx];
      next[targetIdx] = temp;
      return { ...prev, topics: next };
    });
  };

  // Helpers para manipular Recomendações (Anciãos e Servos Ministeriais)
  const addRecommendation = (type: 'elder' | 'servant') => {
    const key = type === 'elder' ? 'elderRecommendations' : 'servantRecommendations';
    updateAgenda((prev) => ({
      ...prev,
      [key]: [
        ...(prev[key] || []),
        { id: `${type}_${Date.now()}`, name: '', decision: '' },
      ],
    }));
  };

  const updateRecommendation = (
    type: 'elder' | 'servant',
    idx: number,
    field: keyof AgendaRecommendationItem,
    value: string
  ) => {
    const key = type === 'elder' ? 'elderRecommendations' : 'servantRecommendations';
    updateAgenda((prev) => {
      const list = [...(prev[key] || [])];
      list[idx] = { ...list[idx], [field]: value };
      return { ...prev, [key]: list };
    });
  };

  const removeRecommendation = (type: 'elder' | 'servant', idx: number) => {
    const key = type === 'elder' ? 'elderRecommendations' : 'servantRecommendations';
    updateAgenda((prev) => ({
      ...prev,
      [key]: (prev[key] || []).filter((_, i) => i !== idx),
    }));
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 space-y-4">
        <div className="w-8 h-8 border-4 border-primary-200 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-medium text-typography-600">
          Carregando pauta da reunião com o corpo de anciãos...
        </p>
      </div>
    );
  }

  if (!agenda) return null;

  const totalRecommendations =
    (agenda.elderRecommendations?.length || 0) +
    (agenda.servantRecommendations?.length || 0);

  const renderA4Sheet = (isPrintOnly: boolean = false) => {
    const hasElderRecs = (agenda.elderRecommendations?.length || 0) > 0;
    const hasServantRecs = (agenda.servantRecommendations?.length || 0) > 0;
    const hasAnyRecs = hasElderRecs || hasServantRecs;

    return (
      <div className={isPrintOnly ? 'agenda-a4-print-root' : 'agenda-a4-preview-wrapper'}>
        <div className="agenda-a4-page">
          {/* Topo sutil e cabeçalho clean */}
          <div className="agenda-header">
            <div className="agenda-header-eyebrow">REUNIÃO TRIMESTRAL / VISITA DO SUPERINTENDENTE DE CIRCUITO</div>
            <h1 className="agenda-header-title">PAUTA DA REUNIÃO DO CORPO DE ANCIÃOS</h1>
          </div>

          {/* Grade 2x2 de Informações da Reunião */}
          <div className="agenda-meta-grid">
            <div className="agenda-meta-field">
              <span className="agenda-meta-label">Congregação:</span>
              {isPrintOnly ? (
                <span className="agenda-meta-value">{agenda.congregationName}</span>
              ) : (
                <input
                  type="text"
                  value={agenda.congregationName}
                  onChange={(e) =>
                    updateAgenda((prev) => ({ ...prev, congregationName: e.target.value }))
                  }
                  placeholder="Nome da congregação"
                  className="agenda-inline-input font-semibold"
                />
              )}
            </div>

            <div className="agenda-meta-field">
              <span className="agenda-meta-label">Oração inicial:</span>
              {isPrintOnly ? (
                <span className="agenda-meta-value">{agenda.openingPrayer}</span>
              ) : (
                <input
                  type="text"
                  value={agenda.openingPrayer}
                  onChange={(e) =>
                    updateAgenda((prev) => ({ ...prev, openingPrayer: e.target.value }))
                  }
                  placeholder="Nome do irmão"
                  className="agenda-inline-input"
                />
              )}
            </div>

            <div className="agenda-meta-field">
              <span className="agenda-meta-label">Local / Data:</span>
              {isPrintOnly ? (
                <span className="agenda-meta-value">{agenda.locationAndDate}</span>
              ) : (
                <input
                  type="text"
                  value={agenda.locationAndDate}
                  onChange={(e) =>
                    updateAgenda((prev) => ({ ...prev, locationAndDate: e.target.value }))
                  }
                  placeholder="Ex: Salão do Reino — 15/10/2026"
                  className="agenda-inline-input"
                />
              )}
            </div>

            <div className="agenda-meta-field">
              <span className="agenda-meta-label">Oração final:</span>
              {isPrintOnly ? (
                <span className="agenda-meta-value">{agenda.closingPrayer}</span>
              ) : (
                <input
                  type="text"
                  value={agenda.closingPrayer}
                  onChange={(e) =>
                    updateAgenda((prev) => ({ ...prev, closingPrayer: e.target.value }))
                  }
                  placeholder="Nome do irmão"
                  className="agenda-inline-input"
                />
              )}
            </div>
          </div>

          {/* SEÇÃO 1: ASSUNTOS E NECESSIDADES DA CONGREGAÇÃO */}
          <div className="agenda-section">
            <div className="agenda-section-header">
              <h2 className="agenda-section-title">Assuntos e necessidades da congregação</h2>
              {!isPrintOnly && (
                <button
                  type="button"
                  onClick={addTopic}
                  className="agenda-add-inline-btn print:hidden"
                >
                  + Adicionar assunto
                </button>
              )}
            </div>

            <table className="agenda-table">
              <thead>
                <tr>
                  <th style={{ width: '36px', textAlign: 'center' }}>#</th>
                  <th style={{ width: '56%' }}>Assunto</th>
                  <th style={{ width: '44%' }}>Referência</th>
                  {!isPrintOnly && <th className="print:hidden" style={{ width: '32px' }} />}
                </tr>
              </thead>
              <tbody>
                {agenda.topics.length === 0 ? (
                  <tr>
                    <td colSpan={isPrintOnly ? 3 : 4} className="agenda-empty-row">
                      Nenhum assunto listado.
                    </td>
                  </tr>
                ) : (
                  agenda.topics.map((topic, idx) => {
                    const topicKey = topic.id || `topic_${idx}`;
                    const hasExcerpt = Boolean(topic.referenceText && topic.referenceText.trim());
                    const showExcerptRow = isPrintOnly
                      ? hasExcerpt
                      : hasExcerpt || Boolean(openExcerptIds[topicKey]);

                    return (
                      <Fragment key={topicKey}>
                        <tr>
                          <td className="agenda-num-cell">{idx + 1}</td>
                          <td>
                            {isPrintOnly ? (
                              <div className="agenda-subject-print-row">
                                <span className="agenda-cell-text font-bold uppercase">
                                  {(topic.subject || '').toUpperCase()}
                                </span>
                                {topic.duration?.trim() && (
                                  <span className="agenda-duration-badge">
                                    {formatTopicDuration(topic.duration)}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <div className="agenda-subject-edit-row">
                                <textarea
                                  rows={1}
                                  value={(topic.subject || '').toUpperCase()}
                                  onChange={(e) =>
                                    updateTopic(idx, 'subject', e.target.value.toUpperCase())
                                  }
                                  placeholder="DESCREVA O ASSUNTO..."
                                  className="agenda-table-textarea font-bold uppercase flex-1"
                                />
                                <input
                                  type="text"
                                  value={topic.duration || ''}
                                  onChange={(e) => updateTopic(idx, 'duration', e.target.value)}
                                  placeholder="Tempo"
                                  title="Tempo designado para este assunto (ex: 10 min)"
                                  className="agenda-duration-input"
                                />
                              </div>
                            )}
                          </td>
                          <td>
                            {isPrintOnly ? (
                              <div className="agenda-cell-text text-slate-600">{topic.reference}</div>
                            ) : (
                              <div className="space-y-1">
                                <textarea
                                  rows={1}
                                  value={topic.reference}
                                  onChange={(e) => updateTopic(idx, 'reference', e.target.value)}
                                  placeholder="Ex: ks cap. 1 § 3; Carta X..."
                                  className="agenda-table-textarea text-slate-600"
                                />
                                {!showExcerptRow && (
                                  <button
                                    type="button"
                                    onClick={() => handlePasteParagraph(idx, topicKey)}
                                    className="agenda-paste-inline-btn print:hidden"
                                    title="Colar ou digitar o parágrafo da referência"
                                  >
                                    + Colar parágrafo da referência
                                  </button>
                                )}
                              </div>
                            )}
                          </td>
                          {!isPrintOnly && (
                            <td className="print:hidden text-center">
                              {agenda.topics.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => removeTopic(idx)}
                                  className="agenda-row-delete-btn"
                                  title="Remover assunto"
                                >
                                  ×
                                </button>
                              )}
                            </td>
                          )}
                        </tr>

                        {showExcerptRow && (
                          <tr className="agenda-excerpt-row">
                            <td className="agenda-num-cell" />
                            <td colSpan={2} className="agenda-excerpt-cell">
                              <div className="agenda-excerpt-box">
                                {isPrintOnly ? (
                                  <div className="agenda-excerpt-text">{topic.referenceText}</div>
                                ) : (
                                  <div className="space-y-1">
                                    <div className="flex items-center justify-between gap-2 print:hidden">
                                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                        Trecho / Parágrafo da Referência
                                      </span>
                                      <div className="flex items-center gap-2">
                                        <button
                                          type="button"
                                          onClick={() => handlePasteParagraph(idx, topicKey)}
                                          className="text-[10px] font-bold text-sky-700 hover:underline cursor-pointer"
                                        >
                                          Colar da área de transferência
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            updateTopic(idx, 'referenceText', '');
                                            setOpenExcerptIds((prev) => ({
                                              ...prev,
                                              [topicKey]: false,
                                            }));
                                          }}
                                          className="text-[10px] font-semibold text-slate-400 hover:text-red-600 cursor-pointer"
                                        >
                                          Remover trecho
                                        </button>
                                      </div>
                                    </div>
                                    <textarea
                                      rows={3}
                                      value={topic.referenceText || ''}
                                      onChange={(e) =>
                                        updateTopic(idx, 'referenceText', e.target.value)
                                      }
                                      placeholder="Cole aqui o parágrafo da publicação ou carta para facilitar a leitura na reunião..."
                                      className="agenda-excerpt-textarea"
                                    />
                                  </div>
                                )}
                              </div>
                            </td>
                            {!isPrintOnly && <td className="print:hidden" />}
                          </tr>
                        )}
                      </Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* SEÇÃO 2: RECOMENDAÇÕES (DINÂMICA CONFORME NECESSIDADE) */}
          {(hasAnyRecs || !isPrintOnly) && (
            <div className={`agenda-section ${!hasAnyRecs ? 'print:hidden' : ''}`}>
              <div className="agenda-section-header">
                <h2 className="agenda-section-title">Recomendações</h2>
                {!isPrintOnly && (
                  <div className="flex items-center gap-2 print:hidden">
                    <button
                      type="button"
                      onClick={() => addRecommendation('elder')}
                      className="agenda-add-inline-btn"
                    >
                      + Ancião
                    </button>
                    <button
                      type="button"
                      onClick={() => addRecommendation('servant')}
                      className="agenda-add-inline-btn"
                    >
                      + Servo Ministerial
                    </button>
                  </div>
                )}
              </div>

              {!hasAnyRecs && !isPrintOnly && (
                <div className="agenda-empty-recs-banner print:hidden">
                  Nenhuma recomendação adicionada para esta reunião. (Esta seção não aparecerá na impressão se estiver vazia). Use os botões acima caso queira incluir recomendações de Anciãos ou Servos Ministeriais.
                </div>
              )}

              <div className="agenda-recs-columns">
                {/* Sub-bloco: Anciãos */}
                {hasElderRecs && (
                  <div className="agenda-rec-block">
                    <div className="agenda-rec-subtitle-bar">
                      <span>Anciãos</span>
                      <span className="agenda-rec-count">
                        {agenda.elderRecommendations.length}{' '}
                        {agenda.elderRecommendations.length === 1 ? 'indicação' : 'indicações'}
                      </span>
                    </div>
                    <table className="agenda-table">
                      <thead>
                        <tr>
                          <th style={{ width: '36px', textAlign: 'center' }}>#</th>
                          <th style={{ width: '58%' }}>Nome</th>
                          <th style={{ width: '42%' }}>Decisão</th>
                          {!isPrintOnly && <th className="print:hidden" style={{ width: '32px' }} />}
                        </tr>
                      </thead>
                      <tbody>
                        {agenda.elderRecommendations.map((rec, idx) => (
                          <tr key={rec.id || idx}>
                            <td className="agenda-num-cell">{idx + 1}</td>
                            <td>
                              {isPrintOnly ? (
                                <div className="agenda-cell-text font-medium">{rec.name}</div>
                              ) : (
                                <input
                                  type="text"
                                  value={rec.name}
                                  onChange={(e) =>
                                    updateRecommendation('elder', idx, 'name', e.target.value)
                                  }
                                  placeholder="Nome completo do irmão"
                                  className="agenda-table-input font-medium"
                                />
                              )}
                            </td>
                            <td>
                              {isPrintOnly ? (
                                <div className="agenda-cell-text">{rec.decision}</div>
                              ) : (
                                <input
                                  type="text"
                                  value={rec.decision}
                                  onChange={(e) =>
                                    updateRecommendation('elder', idx, 'decision', e.target.value)
                                  }
                                  placeholder="Em branco ou decisão..."
                                  className="agenda-table-input"
                                />
                              )}
                            </td>
                            {!isPrintOnly && (
                              <td className="print:hidden text-center">
                                <button
                                  type="button"
                                  onClick={() => removeRecommendation('elder', idx)}
                                  className="agenda-row-delete-btn"
                                  title="Remover recomendação"
                                >
                                  ×
                                </button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Sub-bloco: Servos Ministeriais */}
                {hasServantRecs && (
                  <div className="agenda-rec-block">
                    <div className="agenda-rec-subtitle-bar">
                      <span>Servos Ministeriais</span>
                      <span className="agenda-rec-count">
                        {agenda.servantRecommendations.length}{' '}
                        {agenda.servantRecommendations.length === 1 ? 'indicação' : 'indicações'}
                      </span>
                    </div>
                    <table className="agenda-table">
                      <thead>
                        <tr>
                          <th style={{ width: '36px', textAlign: 'center' }}>#</th>
                          <th style={{ width: '58%' }}>Nome</th>
                          <th style={{ width: '42%' }}>Decisão</th>
                          {!isPrintOnly && <th className="print:hidden" style={{ width: '32px' }} />}
                        </tr>
                      </thead>
                      <tbody>
                        {agenda.servantRecommendations.map((rec, idx) => (
                          <tr key={rec.id || idx}>
                            <td className="agenda-num-cell">{idx + 1}</td>
                            <td>
                              {isPrintOnly ? (
                                <div className="agenda-cell-text font-medium">{rec.name}</div>
                              ) : (
                                <input
                                  type="text"
                                  value={rec.name}
                                  onChange={(e) =>
                                    updateRecommendation('servant', idx, 'name', e.target.value)
                                  }
                                  placeholder="Nome completo do irmão"
                                  className="agenda-table-input font-medium"
                                />
                              )}
                            </td>
                            <td>
                              {isPrintOnly ? (
                                <div className="agenda-cell-text">{rec.decision}</div>
                              ) : (
                                <input
                                  type="text"
                                  value={rec.decision}
                                  onChange={(e) =>
                                    updateRecommendation('servant', idx, 'decision', e.target.value)
                                  }
                                  placeholder="Em branco ou decisão..."
                                  className="agenda-table-input"
                                />
                              )}
                            </td>
                            {!isPrintOnly && (
                              <td className="print:hidden text-center">
                                <button
                                  type="button"
                                  onClick={() => removeRecommendation('servant', idx)}
                                  className="agenda-row-delete-btn"
                                  title="Remover recomendação"
                                >
                                  ×
                                </button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* RODAPÉ COM LEMBRETE BÍBLICO */}
          {agenda.footerNote && (
            <div className="agenda-footer-note">
              {isPrintOnly ? (
                <p>{agenda.footerNote}</p>
              ) : (
                <textarea
                  rows={2}
                  value={agenda.footerNote}
                  onChange={(e) =>
                    updateAgenda((prev) => ({ ...prev, footerNote: e.target.value }))
                  }
                  className="agenda-footer-textarea"
                />
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto w-full pb-16">
      {/* ESTILOS EXCLUSIVOS PARA A FOLHA A4 CLEAN E IMPRESSÃO */}
      <style jsx global>{`
        .agenda-a4-preview-wrapper {
          width: max-content;
          min-width: 100%;
          display: flex;
          justify-content: center;
          padding: 8px 4px 24px;
        }

        .agenda-a4-page {
          width: 210mm;
          min-width: 210mm;
          min-height: 297mm;
          background: #ffffff;
          color: #0f172a;
          padding: 16mm 16mm 14mm;
          box-sizing: border-box;
          border-radius: 12px;
          box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);
          border: 1px solid #e2e8f0;
          display: flex;
          flex-direction: column;
          gap: 18px;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .agenda-header {
          text-align: center;
          border-bottom: 2px solid #1e3a5f;
          padding-bottom: 12px;
        }

        .agenda-header-eyebrow {
          font-size: 9.5px;
          font-weight: 700;
          letter-spacing: 0.14em;
          color: #475569;
          text-transform: uppercase;
          margin-bottom: 4px;
        }

        .agenda-header-title {
          font-size: 18px;
          font-weight: 800;
          letter-spacing: 0.03em;
          color: #0f2942;
          margin: 0;
        }

        .agenda-meta-grid {
          display: grid;
          grid-template-columns: 1.15fr 0.85fr;
          gap: 10px 24px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 12px 16px;
        }

        .agenda-meta-field {
          display: flex;
          align-items: baseline;
          gap: 8px;
          min-width: 0;
        }

        .agenda-meta-label {
          font-size: 11.5px;
          font-weight: 700;
          color: #1e3a5f;
          white-space: nowrap;
          flex-shrink: 0;
        }

        .agenda-meta-value {
          font-size: 12px;
          font-weight: 600;
          color: #0f172a;
          border-bottom: 1px solid #cbd5e1;
          flex: 1;
          min-height: 18px;
          padding-bottom: 1px;
        }

        .agenda-inline-input {
          flex: 1;
          min-width: 0;
          font-size: 12px;
          color: #0f172a;
          background: transparent;
          border: none;
          border-bottom: 1px solid #cbd5e1;
          padding: 1px 4px;
          outline: none;
          transition: border-color 0.15s;
        }

        .agenda-inline-input:focus {
          border-bottom-color: #1e3a5f;
          background: #ffffff;
        }

        .agenda-section {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .agenda-section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          border-left: 3.5px solid #1e3a5f;
          padding-left: 10px;
        }

        .agenda-section-title {
          font-size: 13px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: #0f2942;
          margin: 0;
        }

        .agenda-add-inline-btn {
          font-size: 11px;
          font-weight: 700;
          color: #1e3a5f;
          background: #f1f5f9;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          padding: 3px 9px;
          cursor: pointer;
          transition: all 0.15s;
        }

        .agenda-add-inline-btn:hover {
          background: #e2e8f0;
        }

        .agenda-table {
          width: 100%;
          border-collapse: collapse;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          overflow: hidden;
        }

        .agenda-table thead tr {
          background: #1e3a5f;
          color: #ffffff;
        }

        .agenda-table th {
          font-size: 10.5px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          padding: 7px 10px;
          text-align: left;
          border-right: 1px solid rgba(255, 255, 255, 0.15);
        }

        .agenda-table th:last-child {
          border-right: none;
        }

        .agenda-table tbody tr {
          border-bottom: 1px solid #e2e8f0;
          page-break-inside: avoid;
          break-inside: avoid;
        }

        .agenda-table tbody tr:nth-child(even) {
          background: #f8fafc;
        }

        .agenda-table td {
          padding: 7px 10px;
          vertical-align: top;
          border-right: 1px solid #e2e8f0;
          font-size: 12px;
          line-height: 1.4;
        }

        .agenda-table td:last-child {
          border-right: none;
        }

        .agenda-num-cell {
          text-align: center;
          font-size: 11px;
          font-weight: 700;
          color: #64748b;
          background: rgba(241, 245, 249, 0.6);
        }

        .agenda-cell-text {
          white-space: pre-wrap;
          word-break: break-word;
          min-height: 18px;
        }

        .agenda-subject-print-row {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 8px;
        }

        .agenda-subject-edit-row {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 8px;
        }

        .agenda-duration-badge {
          font-size: 10px;
          font-weight: 800;
          color: #1e3a5f;
          background: #e2e8f0;
          border: 1px solid #cbd5e1;
          border-radius: 4px;
          padding: 1px 6px;
          white-space: nowrap;
          flex-shrink: 0;
          letter-spacing: 0.03em;
        }

        .agenda-duration-input {
          width: 68px;
          flex-shrink: 0;
          font-size: 10.5px;
          font-weight: 700;
          text-transform: uppercase;
          text-align: center;
          color: #1e3a5f;
          background: #f1f5f9;
          border: 1px dashed #cbd5e1;
          border-radius: 5px;
          padding: 2px 5px;
          outline: none;
          font-family: inherit;
          transition: all 0.15s;
        }

        .agenda-duration-input:focus {
          border-style: solid;
          border-color: #1e3a5f;
          background: #ffffff;
        }

        .agenda-table-textarea {
          width: 100%;
          border: none;
          background: transparent;
          font-size: 12px;
          line-height: 1.4;
          color: #0f172a;
          resize: vertical;
          outline: none;
          padding: 0;
          font-family: inherit;
        }

        .agenda-table-input {
          width: 100%;
          border: none;
          background: transparent;
          font-size: 12px;
          color: #0f172a;
          outline: none;
          padding: 0;
          font-family: inherit;
        }

        .agenda-row-delete-btn {
          width: 20px;
          height: 20px;
          border-radius: 4px;
          border: none;
          background: transparent;
          color: #94a3b8;
          font-size: 15px;
          line-height: 1;
          cursor: pointer;
        }

        .agenda-row-delete-btn:hover {
          background: #fee2e2;
          color: #dc2626;
        }

        .agenda-paste-inline-btn {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 10px;
          font-weight: 700;
          color: #0369a1;
          background: #f0f9ff;
          border: 1px dashed #7dd3fc;
          border-radius: 5px;
          padding: 2px 7px;
          cursor: pointer;
          transition: all 0.15s;
        }

        .agenda-paste-inline-btn:hover {
          background: #e0f2fe;
          border-color: #38bdf8;
        }

        .agenda-excerpt-row {
          background: #f8fafc !important;
        }

        .agenda-excerpt-cell {
          padding: 6px 10px 9px !important;
        }

        .agenda-excerpt-box {
          border-left: 3px solid #1e3a5f;
          background: #f1f5f9;
          border-radius: 0 6px 6px 0;
          padding: 6px 10px;
        }

        .agenda-excerpt-text {
          font-size: 11px;
          line-height: 1.45;
          color: #1e293b;
          white-space: pre-wrap;
          word-break: break-word;
        }

        .agenda-excerpt-textarea {
          width: 100%;
          border: 1px solid #cbd5e1;
          border-radius: 5px;
          background: #ffffff;
          font-size: 11px;
          line-height: 1.45;
          color: #1e293b;
          padding: 5px 8px;
          resize: vertical;
          outline: none;
          font-family: inherit;
        }

        .agenda-excerpt-textarea:focus {
          border-color: #1e3a5f;
        }

        .agenda-recs-columns {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .agenda-rec-block {
          display: flex;
          flex-direction: column;
          gap: 4px;
          page-break-inside: avoid;
          break-inside: avoid;
        }

        .agenda-rec-subtitle-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 11.5px;
          font-weight: 800;
          color: #1e3a5f;
          padding: 2px 4px;
        }

        .agenda-rec-count {
          font-size: 10px;
          font-weight: 600;
          color: #64748b;
        }

        .agenda-empty-recs-banner {
          font-size: 11.5px;
          color: #64748b;
          background: #f8fafc;
          border: 1px dashed #cbd5e1;
          border-radius: 8px;
          padding: 10px 14px;
          text-align: center;
        }

        .agenda-empty-row {
          text-align: center;
          color: #94a3b8;
          font-style: italic;
          padding: 14px !important;
        }

        .agenda-footer-note {
          margin-top: auto;
          padding-top: 12px;
          border-top: 1px solid #cbd5e1;
          font-size: 11px;
          font-style: italic;
          font-weight: 600;
          color: #334155;
          line-height: 1.45;
        }

        .agenda-footer-note p {
          margin: 0;
        }

        .agenda-footer-textarea {
          width: 100%;
          border: none;
          background: transparent;
          font-size: 11px;
          font-style: italic;
          font-weight: 600;
          color: #334155;
          resize: none;
          outline: none;
          font-family: inherit;
          line-height: 1.45;
        }

        @media print {
          @page {
            size: A4 portrait;
            margin: 12mm 14mm;
          }

          body {
            background: #ffffff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .agenda-a4-print-root .agenda-a4-page {
            width: 100% !important;
            min-width: 0 !important;
            min-height: 0 !important;
            padding: 0 !important;
            margin: 0 !important;
            border: none !important;
            box-shadow: none !important;
            border-radius: 0 !important;
          }
        }
      `}</style>

      {/* BARRA SUPERIOR DE AÇÕES */}
      <div className="bg-surface-100 border border-surface-300 rounded-3xl p-4 md:p-5 shadow-sm space-y-4 print:hidden relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-600 via-primary-200 to-transparent" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-surface-300 pb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 sm:p-2.5 rounded-xl border border-surface-300 hover:bg-surface-200 text-typography-700 hover:text-typography-900 transition-colors shrink-0 shadow-2xs cursor-pointer"
              title="Voltar ao itinerário"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black text-typography-900 tracking-tight">
                  {agenda.congregationName}
                </h1>
                <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 whitespace-nowrap">
                  Pauta da Reunião de Anciãos
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5 text-xs text-typography-500 font-medium">
                <Calendar size={13} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
                <span>{agenda.visitPeriod || 'Semana da Visita'}</span>
              </div>
            </div>
          </div>

          {/* Botões de Ação */}
          <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto flex-wrap">
            <button
              type="button"
              onClick={handleOpenReplicateModal}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 bg-surface-200 hover:bg-surface-300 border border-surface-300 text-typography-800 px-3.5 py-2.5 rounded-xl font-bold text-xs transition-colors whitespace-nowrap cursor-pointer shadow-2xs"
              title="Copiar assuntos e referências de outra semana"
            >
              <Copy size={15} className="text-indigo-600 dark:text-indigo-400" />
              <span>Replicar de outra semana</span>
            </button>

            <button
              type="button"
              onClick={() => handleSave()}
              disabled={saving}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 bg-primary-200 hover:bg-primary-300 text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-xs transition-all disabled:opacity-50 whitespace-nowrap cursor-pointer"
            >
              <Save size={15} />
              {saving ? 'Salvando...' : 'Salvar Pauta'}
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 bg-surface-200 hover:bg-surface-300 border border-surface-300 text-typography-800 px-3.5 py-2.5 rounded-xl font-bold text-xs transition-colors whitespace-nowrap cursor-pointer"
            >
              <Printer size={15} />
              Imprimir / PDF
            </button>
          </div>
        </div>

        {/* FEEDBACK MENSAGEM */}
        {feedbackMsg && (
          <div
            className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 animate-in fade-in duration-200 ${
              feedbackMsg.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : feedbackMsg.type === 'error'
                ? 'bg-red-50 text-red-800 border border-red-200'
                : 'bg-blue-50 text-blue-800 border border-blue-200'
            }`}
          >
            {feedbackMsg.type === 'success' ? <Check size={15} /> : <AlertCircle size={15} />}
            <span>{feedbackMsg.text}</span>
          </div>
        )}

        {/* SELETOR DE MODO: FORMULÁRIO (CELULAR) VS FOLHA A4 */}
        <div className="flex border-b border-surface-300 gap-2 sm:gap-4 pt-1 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab('form')}
            className={`pb-2.5 text-xs font-bold flex items-center gap-1.5 border-b-2 whitespace-nowrap transition-all cursor-pointer ${
              activeTab === 'form'
                ? 'border-primary-200 text-primary-200'
                : 'border-transparent text-typography-500 hover:text-typography-800'
            }`}
          >
            <Smartphone size={15} />
            Formulário (Celular)
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('preview')}
            className={`pb-2.5 text-xs font-bold flex items-center gap-1.5 border-b-2 whitespace-nowrap transition-all cursor-pointer ${
              activeTab === 'preview'
                ? 'border-primary-200 text-primary-200'
                : 'border-transparent text-typography-500 hover:text-typography-800'
            }`}
          >
            <Eye size={15} />
            Folha A4 Clean (Impressão / PDF)
          </button>
        </div>
      </div>

      {/* CONTEÚDO PRINCIPAL EM TELA */}
      <div className="print:hidden">
        {activeTab === 'form' ? (
          <div className="max-w-2xl mx-auto space-y-4">
            {/* Sub-abas móveis confortáveis */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
              <button
                type="button"
                onClick={() => setMobileSection('assuntos')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold whitespace-nowrap transition-all shrink-0 cursor-pointer ${
                  mobileSection === 'assuntos'
                    ? 'bg-primary-200 text-white shadow-xs'
                    : 'bg-surface-100 text-typography-600 border border-surface-300 hover:bg-surface-200'
                }`}
              >
                <BookOpen size={15} />
                <span>Assuntos e Necessidades</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                    mobileSection === 'assuntos'
                      ? 'bg-white/20 text-white'
                      : 'bg-surface-200 text-typography-600'
                  }`}
                >
                  {agenda.topics.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setMobileSection('recomendacoes')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold whitespace-nowrap transition-all shrink-0 cursor-pointer ${
                  mobileSection === 'recomendacoes'
                    ? 'bg-primary-200 text-white shadow-xs'
                    : 'bg-surface-100 text-typography-600 border border-surface-300 hover:bg-surface-200'
                }`}
              >
                <UserCheck size={15} />
                <span>Recomendações</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                    mobileSection === 'recomendacoes'
                      ? 'bg-white/20 text-white'
                      : 'bg-surface-200 text-typography-600'
                  }`}
                >
                  {totalRecommendations}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setMobileSection('geral')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold whitespace-nowrap transition-all shrink-0 cursor-pointer ${
                  mobileSection === 'geral'
                    ? 'bg-primary-200 text-white shadow-xs'
                    : 'bg-surface-100 text-typography-600 border border-surface-300 hover:bg-surface-200'
                }`}
              >
                <ClipboardList size={15} />
                <span>Cabeçalho & Orações</span>
              </button>
            </div>

            {/* ABA 1: ASSUNTOS E NECESSIDADES DA CONGREGAÇÃO */}
            {mobileSection === 'assuntos' && (
              <div className="space-y-3">
                <div className="bg-surface-100 border border-surface-300 rounded-2xl p-4 shadow-xs flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-primary-200 flex items-center gap-1.5">
                      <BookOpen size={15} />
                      Assuntos e Necessidades da Congregação
                    </h3>
                    <p className="text-[11px] text-typography-500 mt-0.5">
                      Adicione os tópicos e as referências bíblicas ou teocráticas que serão considerados com o corpo.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addTopic}
                    className="shrink-0 flex items-center gap-1.5 bg-primary-200 hover:bg-primary-300 text-white px-3 py-2 rounded-xl text-xs font-bold shadow-2xs transition-all cursor-pointer"
                  >
                    <Plus size={14} />
                    <span>Assunto</span>
                  </button>
                </div>

                {agenda.topics.map((topic, idx) => {
                  const topicKey = topic.id || `topic_${idx}`;
                  const hasExcerpt = Boolean(topic.referenceText && topic.referenceText.trim());
                  const isExcerptOpen = hasExcerpt || Boolean(openExcerptIds[topicKey]);

                  return (
                    <div
                      key={topicKey}
                      className="bg-surface-100 border border-surface-300 rounded-2xl p-4 shadow-xs space-y-3"
                    >
                      <div className="flex items-center justify-between border-b border-surface-300 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-primary-200 bg-primary-200/10 px-2.5 py-0.5 rounded-lg border border-primary-200/20">
                            Assunto #{idx + 1}
                          </span>
                          {topic.duration?.trim() && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-lg bg-surface-200 text-typography-700 border border-surface-300">
                              <Clock size={11} className="text-primary-200" />
                              {formatTopicDuration(topic.duration)}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => moveTopic(idx, 'up')}
                            disabled={idx === 0}
                            className="p-1 rounded-lg text-typography-400 hover:text-typography-800 hover:bg-surface-200 disabled:opacity-30 cursor-pointer"
                            title="Mover para cima"
                          >
                            <ArrowUp size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveTopic(idx, 'down')}
                            disabled={idx === agenda.topics.length - 1}
                            className="p-1 rounded-lg text-typography-400 hover:text-typography-800 hover:bg-surface-200 disabled:opacity-30 cursor-pointer"
                            title="Mover para baixo"
                          >
                            <ArrowDown size={14} />
                          </button>
                          {agenda.topics.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeTopic(idx)}
                              className="p-1 rounded-lg text-typography-400 hover:text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer ml-1"
                              title="Remover assunto"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="space-y-2.5">
                        <div className="grid grid-cols-1 sm:grid-cols-[1fr_170px] gap-2.5">
                          <div className="space-y-1">
                            <label className="text-[11px] font-bold uppercase tracking-wider text-typography-500">
                              Assunto / Necessidade (Caixa Alta)
                            </label>
                            <textarea
                              rows={2}
                              placeholder="EX: PASTOREIO E ENCORAJAMENTO AOS PUBLICADORES IRREGULARES..."
                              value={(topic.subject || '').toUpperCase()}
                              onChange={(e) =>
                                updateTopic(idx, 'subject', e.target.value.toUpperCase())
                              }
                              className="w-full text-xs font-bold uppercase p-2.5 bg-surface-200/50 border border-surface-300 rounded-xl text-typography-900 placeholder:text-typography-400 focus:bg-surface-100 focus:ring-2 focus:ring-primary-200/20 focus:border-primary-200 outline-none transition-all resize-y"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[11px] font-bold uppercase tracking-wider text-typography-500 flex items-center gap-1">
                              <Clock size={12} className="text-primary-200" />
                              Tempo (Opcional)
                            </label>
                            <input
                              type="text"
                              placeholder="Ex: 10 min"
                              value={topic.duration || ''}
                              onChange={(e) => updateTopic(idx, 'duration', e.target.value)}
                              className="w-full text-xs font-bold uppercase p-2 bg-surface-200/50 border border-surface-300 rounded-xl text-typography-900 placeholder:text-typography-400 focus:bg-surface-100 focus:ring-2 focus:ring-primary-200/20 focus:border-primary-200 outline-none transition-all"
                            />
                            <div className="flex items-center gap-1 flex-wrap pt-0.5">
                              {['5 min', '10 min', '15 min', '20 min'].map((preset) => {
                                const isSelected =
                                  (topic.duration || '').trim().toUpperCase() ===
                                  preset.toUpperCase();
                                return (
                                  <button
                                    key={preset}
                                    type="button"
                                    onClick={() =>
                                      updateTopic(
                                        idx,
                                        'duration',
                                        isSelected ? '' : preset
                                      )
                                    }
                                    className={`text-[10px] font-bold px-2 py-0.5 rounded-md border transition-colors cursor-pointer ${
                                      isSelected
                                        ? 'bg-primary-200 text-white border-primary-200'
                                        : 'bg-surface-200/70 text-typography-600 border-surface-300 hover:bg-surface-300'
                                    }`}
                                  >
                                    {preset}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <label className="text-[11px] font-bold uppercase tracking-wider text-typography-500">
                              Referência Bíblica / Teocrática
                            </label>
                            {!isExcerptOpen && (
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handlePasteParagraph(idx, topicKey)}
                                  className="inline-flex items-center gap-1 text-[11px] font-bold text-primary-200 bg-primary-200/10 hover:bg-primary-200/20 border border-primary-200/25 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                                  title="Colar parágrafo copiado do JW Library / WOL"
                                >
                                  <ClipboardPaste size={12} />
                                  <span>Colar parágrafo da referência</span>
                                </button>
                              </div>
                            )}
                          </div>
                          <textarea
                            rows={2}
                            placeholder="Ex: ks cap. 25 §§ 1-4; 1 Ped. 5:2, 3..."
                            value={topic.reference}
                            onChange={(e) => updateTopic(idx, 'reference', e.target.value)}
                            className="w-full text-xs font-medium p-2.5 bg-surface-200/50 border border-surface-300 rounded-xl text-typography-900 placeholder:text-typography-400 focus:bg-surface-100 focus:ring-2 focus:ring-primary-200/20 focus:border-primary-200 outline-none transition-all resize-y"
                          />
                        </div>

                        {isExcerptOpen && (
                          <div className="p-3 bg-surface-200/60 border-l-4 border-l-primary-200 border border-surface-300 rounded-r-xl rounded-l-xs space-y-2">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <span className="text-[11px] font-bold uppercase tracking-wider text-primary-200 flex items-center gap-1.5">
                                <Quote size={12} />
                                Parágrafo / Trecho da Referência (Opcional)
                              </span>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handlePasteParagraph(idx, topicKey)}
                                  className="inline-flex items-center gap-1 text-[11px] font-bold text-primary-200 hover:underline cursor-pointer"
                                  title="Colar parágrafo da área de transferência"
                                >
                                  <ClipboardPaste size={12} />
                                  <span>Colar copiado</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    updateTopic(idx, 'referenceText', '');
                                    setOpenExcerptIds((prev) => ({
                                      ...prev,
                                      [topicKey]: false,
                                    }));
                                  }}
                                  className="text-[11px] font-semibold text-typography-400 hover:text-red-500 transition-colors cursor-pointer"
                                >
                                  Remover trecho
                                </button>
                              </div>
                            </div>
                            <textarea
                              rows={4}
                              placeholder="Cole aqui o parágrafo copiado do JW Library, WOL ou carta para que apareça na pauta logo abaixo do assunto..."
                              value={topic.referenceText || ''}
                              onChange={(e) =>
                                updateTopic(idx, 'referenceText', e.target.value)
                              }
                              className="w-full text-xs leading-relaxed p-2.5 bg-surface-100 border border-surface-300 rounded-xl text-typography-900 placeholder:text-typography-400 focus:ring-2 focus:ring-primary-200/20 focus:border-primary-200 outline-none transition-all resize-y"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                <button
                  type="button"
                  onClick={addTopic}
                  className="w-full py-3 border-2 border-dashed border-primary-200/30 hover:border-primary-200 bg-primary-200/5 hover:bg-primary-200/10 text-primary-200 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Plus size={16} /> Adicionar Assunto à Pauta
                </button>
              </div>
            )}

            {/* ABA 2: RECOMENDAÇÕES SOB DEMANDA */}
            {mobileSection === 'recomendacoes' && (
              <div className="space-y-5">
                <div className="bg-surface-100 border border-surface-300 rounded-2xl p-4 shadow-xs space-y-1">
                  <h3 className="text-xs font-black uppercase tracking-wider text-primary-200 flex items-center gap-1.5">
                    <UserCheck size={15} />
                    Recomendações (Sob Demanda)
                  </h3>
                  <p className="text-[11px] text-typography-500 leading-relaxed">
                    Adicione apenas os irmãos que serão considerados nesta visita. Se uma categoria não tiver nenhuma indicação, ela não ocupará espaço na folha impressa.
                  </p>
                </div>

                {/* BLOCO 1: ANCIÃOS */}
                <div className="bg-surface-100 border border-surface-300 rounded-2xl p-4 shadow-xs space-y-3">
                  <div className="flex items-center justify-between border-b border-surface-300 pb-2.5">
                    <div>
                      <h4 className="text-xs font-black uppercase tracking-wider text-typography-900">
                        Recomendações para Anciãos
                      </h4>
                      <span className="text-[11px] text-typography-500">
                        {agenda.elderRecommendations.length === 0
                          ? 'Nenhuma indicação adicionada'
                          : `${agenda.elderRecommendations.length} ${
                              agenda.elderRecommendations.length === 1 ? 'irmão listado' : 'irmãos listados'
                            }`}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => addRecommendation('elder')}
                      className="flex items-center gap-1.5 bg-primary-200/10 hover:bg-primary-200/20 text-primary-200 border border-primary-200/25 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                    >
                      <Plus size={14} />
                      <span>Adicionar Ancião</span>
                    </button>
                  </div>

                  {agenda.elderRecommendations.length === 0 ? (
                    <div className="py-4 text-center text-xs text-typography-400 bg-surface-200/40 rounded-xl border border-dashed border-surface-300">
                      Nenhuma recomendação de ancião para esta reunião.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {agenda.elderRecommendations.map((rec, idx) => (
                        <div
                          key={rec.id || idx}
                          className="p-3 bg-surface-200/50 border border-surface-300 rounded-xl space-y-2.5"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-primary-200">
                              Ancião #{idx + 1}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeRecommendation('elder', idx)}
                              className="text-typography-400 hover:text-red-500 p-1 rounded-lg hover:bg-red-500/10 transition-colors cursor-pointer"
                              title="Remover recomendação"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold uppercase text-typography-500">
                                Nome do Irmão
                              </label>
                              <input
                                type="text"
                                placeholder="Nome completo"
                                value={rec.name}
                                onChange={(e) =>
                                  updateRecommendation('elder', idx, 'name', e.target.value)
                                }
                                className="w-full text-xs font-medium p-2.5 bg-surface-100 border border-surface-300 rounded-xl text-typography-900 placeholder:text-typography-400 outline-none focus:border-primary-200"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-[10px] font-bold uppercase text-typography-500">
                                Decisão (ou em branco p/ reunião)
                              </label>
                              <input
                                type="text"
                                placeholder="Ex: Recomendado / Aguardar / Em branco"
                                value={rec.decision}
                                onChange={(e) =>
                                  updateRecommendation('elder', idx, 'decision', e.target.value)
                                }
                                className="w-full text-xs font-medium p-2.5 bg-surface-100 border border-surface-300 rounded-xl text-typography-900 placeholder:text-typography-400 outline-none focus:border-primary-200"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* BLOCO 2: SERVOS MINISTERIAIS */}
                <div className="bg-surface-100 border border-surface-300 rounded-2xl p-4 shadow-xs space-y-3">
                  <div className="flex items-center justify-between border-b border-surface-300 pb-2.5">
                    <div>
                      <h4 className="text-xs font-black uppercase tracking-wider text-typography-900">
                        Recomendações para Servos Ministeriais
                      </h4>
                      <span className="text-[11px] text-typography-500">
                        {agenda.servantRecommendations.length === 0
                          ? 'Nenhuma indicação adicionada'
                          : `${agenda.servantRecommendations.length} ${
                              agenda.servantRecommendations.length === 1 ? 'irmão listado' : 'irmãos listados'
                            }`}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => addRecommendation('servant')}
                      className="flex items-center gap-1.5 bg-primary-200/10 hover:bg-primary-200/20 text-primary-200 border border-primary-200/25 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                    >
                      <Plus size={14} />
                      <span>Adicionar Servo</span>
                    </button>
                  </div>

                  {agenda.servantRecommendations.length === 0 ? (
                    <div className="py-4 text-center text-xs text-typography-400 bg-surface-200/40 rounded-xl border border-dashed border-surface-300">
                      Nenhuma recomendação de servo ministerial para esta reunião.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {agenda.servantRecommendations.map((rec, idx) => (
                        <div
                          key={rec.id || idx}
                          className="p-3 bg-surface-200/50 border border-surface-300 rounded-xl space-y-2.5"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-primary-200">
                              Servo Ministerial #{idx + 1}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeRecommendation('servant', idx)}
                              className="text-typography-400 hover:text-red-500 p-1 rounded-lg hover:bg-red-500/10 transition-colors cursor-pointer"
                              title="Remover recomendação"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold uppercase text-typography-500">
                                Nome do Irmão
                              </label>
                              <input
                                type="text"
                                placeholder="Nome completo"
                                value={rec.name}
                                onChange={(e) =>
                                  updateRecommendation('servant', idx, 'name', e.target.value)
                                }
                                className="w-full text-xs font-medium p-2.5 bg-surface-100 border border-surface-300 rounded-xl text-typography-900 placeholder:text-typography-400 outline-none focus:border-primary-200"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-[10px] font-bold uppercase text-typography-500">
                                Decisão (ou em branco p/ reunião)
                              </label>
                              <input
                                type="text"
                                placeholder="Ex: Recomendado / Aguardar / Em branco"
                                value={rec.decision}
                                onChange={(e) =>
                                  updateRecommendation('servant', idx, 'decision', e.target.value)
                                }
                                className="w-full text-xs font-medium p-2.5 bg-surface-100 border border-surface-300 rounded-xl text-typography-900 placeholder:text-typography-400 outline-none focus:border-primary-200"
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

            {/* ABA 3: CABEÇALHO, ORAÇÕES E NOTA BÍBLICA */}
            {mobileSection === 'geral' && (
              <div className="space-y-4">
                <div className="bg-surface-100 border border-surface-300 rounded-2xl p-4 shadow-xs space-y-4">
                  <h3 className="text-xs font-black uppercase tracking-wider text-primary-200 border-b border-surface-300 pb-2 flex items-center gap-2">
                    <ClipboardList size={15} />
                    Dados da Reunião e Orações
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-typography-500">
                        Congregação
                      </label>
                      <input
                        type="text"
                        value={agenda.congregationName}
                        onChange={(e) =>
                          updateAgenda((prev) => ({ ...prev, congregationName: e.target.value }))
                        }
                        className="w-full text-xs font-bold p-2.5 bg-surface-200/50 border border-surface-300 rounded-xl text-typography-900 outline-none focus:border-primary-200"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-typography-500">
                        Local / Data
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: Salão do Reino — Sábado, 17:00"
                        value={agenda.locationAndDate}
                        onChange={(e) =>
                          updateAgenda((prev) => ({ ...prev, locationAndDate: e.target.value }))
                        }
                        className="w-full text-xs font-medium p-2.5 bg-surface-200/50 border border-surface-300 rounded-xl text-typography-900 outline-none focus:border-primary-200"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-typography-500">
                        Oração Inicial
                      </label>
                      <input
                        type="text"
                        placeholder="Nome do ancião"
                        value={agenda.openingPrayer}
                        onChange={(e) =>
                          updateAgenda((prev) => ({ ...prev, openingPrayer: e.target.value }))
                        }
                        className="w-full text-xs font-medium p-2.5 bg-surface-200/50 border border-surface-300 rounded-xl text-typography-900 outline-none focus:border-primary-200"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-typography-500">
                        Oração Final
                      </label>
                      <input
                        type="text"
                        placeholder="Nome do ancião"
                        value={agenda.closingPrayer}
                        onChange={(e) =>
                          updateAgenda((prev) => ({ ...prev, closingPrayer: e.target.value }))
                        }
                        className="w-full text-xs font-medium p-2.5 bg-surface-200/50 border border-surface-300 rounded-xl text-typography-900 outline-none focus:border-primary-200"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-2 border-t border-surface-300">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-typography-500">
                        Nota Bíblica de Rodapé
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          updateAgenda((prev) => ({
                            ...prev,
                            footerNote: DEFAULT_AGENDA_FOOTER_NOTE,
                          }))
                        }
                        className="text-[11px] font-semibold text-primary-200 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <RotateCcw size={11} /> Restaurar padrão
                      </button>
                    </div>
                    <textarea
                      rows={2}
                      value={agenda.footerNote}
                      onChange={(e) =>
                        updateAgenda((prev) => ({ ...prev, footerNote: e.target.value }))
                      }
                      className="w-full text-xs font-medium p-2.5 bg-surface-200/50 border border-surface-300 rounded-xl text-typography-900 outline-none focus:border-primary-200"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-center text-xs text-typography-500">
              💡 <em>Você também pode clicar e editar diretamente na folha A4 abaixo.</em>
            </div>
            <div className="overflow-x-auto pb-6">{renderA4Sheet(false)}</div>
          </div>
        )}
      </div>

      {/* COMPONENTE EXCLUSIVO PARA IMPRESSÃO / PDF */}
      <div className="hidden print:block">{renderA4Sheet(true)}</div>

      {/* BARRA FLUTUANTE DE ALTERAÇÕES NÃO SALVAS */}
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {hasChanges && (
              <div className="fixed bottom-4 sm:bottom-6 left-0 right-0 z-[9999] flex justify-center px-3 pointer-events-none print:hidden">
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 30 }}
                  className="pointer-events-auto bg-surface-100/95 dark:bg-surface-200/95 text-typography-900 backdrop-blur-md px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-2xl shadow-xl flex items-center justify-between gap-2.5 sm:gap-4 border border-surface-300 w-full max-w-md"
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
                        Pauta • {agenda.congregationName}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        if (savedSnapshot) {
                          setAgenda(JSON.parse(JSON.stringify(savedSnapshot)));
                        }
                        setIsDirty(false);
                        isDirtyRef.current = false;
                      }}
                      disabled={saving}
                      className="px-2.5 py-1.5 text-xs font-semibold text-typography-500 hover:text-typography-800 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                    >
                      Descartar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSave()}
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
              </div>
            )}
          </AnimatePresence>,
          document.body
        )}

      {/* MODAL DE REPLICAÇÃO DE PAUTA DE OUTRA SEMANA */}
      <AnimatePresence>
        {isReplicateModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs print:hidden">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-surface-100 border border-surface-300 rounded-3xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col relative"
            >
              <div className="p-4 sm:p-5 border-b border-surface-300 flex items-center justify-between sticky top-0 bg-surface-100/95 backdrop-blur-xs z-10">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                    <Copy size={18} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-typography-900 tracking-tight">
                      Replicar Pauta de Outra Semana
                    </h3>
                    <p className="text-xs text-typography-500">
                      Importe os assuntos gerais e referências que você já preparou no giro
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsReplicateModalOpen(false)}
                  className="p-1.5 rounded-lg text-typography-400 hover:text-typography-900 hover:bg-surface-200 transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-4 sm:p-6 space-y-5 flex-1">
                {loadingPrevious ? (
                  <div className="py-12 flex flex-col items-center justify-center space-y-3">
                    <div className="w-7 h-7 border-3 border-primary-200 border-t-transparent rounded-full animate-spin" />
                    <p className="text-xs text-typography-500 font-medium">
                      Buscando pautas anteriores...
                    </p>
                  </div>
                ) : previousAgendas.length === 0 ? (
                  <div className="py-8 text-center space-y-3 bg-surface-200/50 rounded-2xl p-6 border border-surface-300">
                    <div className="w-12 h-12 bg-primary-200/10 text-primary-200 rounded-2xl flex items-center justify-center mx-auto">
                      <HelpCircle size={24} />
                    </div>
                    <h4 className="text-sm font-bold text-typography-900">
                      Nenhuma outra pauta encontrada
                    </h4>
                    <p className="text-xs text-typography-500 max-w-md mx-auto leading-relaxed">
                      Quando você salvar a pauta de uma congregação, poderá reaproveitar os assuntos e referências base nas próximas visitas com 1 clique.
                    </p>
                  </div>
                ) : (
                  <>
                    {previousAgendas[0] && (
                      <div className="bg-primary-200/5 border border-primary-200/20 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="min-w-0">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-primary-200 block mb-0.5">
                            Última Pauta Salva
                          </span>
                          <h4 className="text-xs font-bold text-typography-900 truncate">
                            {previousAgendas[0].congregationName}
                          </h4>
                          <span className="text-[11px] text-typography-500">
                            {previousAgendas[0].visitPeriod} •{' '}
                            {previousAgendas[0].topics?.length || 0} assuntos
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => executeReplication(previousAgendas[0])}
                          disabled={replicating}
                          className="flex items-center justify-center gap-1.5 bg-primary-200 hover:bg-primary-300 text-white px-3.5 py-2 rounded-xl font-bold text-xs shadow-xs transition-all disabled:opacity-50 shrink-0 cursor-pointer"
                        >
                          <Sparkles size={14} />
                          Copiar da Última Visita
                        </button>
                      </div>
                    )}

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-typography-800 block">
                        Ou escolha outra congregação do histórico:
                      </label>
                      <CustomSelect
                        value={selectedSourceId}
                        onChange={(val) => setSelectedSourceId(val)}
                        options={previousAgendas.map(
                          (p): CustomSelectOption => ({
                            value: p.id || '',
                            label: `${p.congregationName} — ${p.visitPeriod}`,
                            description: `${p.topics?.length || 0} assunto(s)`,
                          })
                        )}
                        placeholder="Selecione a pauta de origem..."
                        size="md"
                        searchable={previousAgendas.length > 4}
                      />
                    </div>

                    <div className="bg-surface-200/60 rounded-2xl p-4 border border-surface-300 text-xs space-y-2">
                      <div className="font-bold text-typography-900 flex items-center gap-1.5">
                        <ShieldCheck size={15} className="text-primary-200" />
                        Replicação Inteligente e Segura
                      </div>
                      <p className="text-[11px] text-typography-600 leading-relaxed">
                        Serão copiados apenas os <strong>Assuntos e Referências</strong>. O nome da congregação atual (<strong>{agenda.congregationName}</strong>), orações e as recomendações locais de anciãos/servos ministeriais permanecem intactos.
                      </p>
                    </div>
                  </>
                )}
              </div>

              <div className="p-4 sm:p-5 border-t border-surface-300 flex items-center justify-end gap-2 bg-surface-100 sticky bottom-0 z-10">
                <button
                  type="button"
                  onClick={() => setIsReplicateModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-surface-300 text-typography-700 hover:bg-surface-200 font-bold text-xs transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                {previousAgendas.length > 0 && selectedSourceAgenda && (
                  <button
                    type="button"
                    onClick={() => executeReplication(selectedSourceAgenda)}
                    disabled={replicating}
                    className="flex items-center gap-1.5 bg-primary-200 hover:bg-primary-300 text-white px-4 py-2 rounded-xl font-bold text-xs shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                  >
                    <CheckCircle2 size={14} />
                    <span>Copiar Assuntos</span>
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

