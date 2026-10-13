'use client';

import CustomSelect, { CustomSelectOption } from '@/components/CustomSelect';
import { db } from '@/lib/firebase';
import {
  generateElderPin,
  generateShareToken,
  normalizeVisitSchedule,
  serializeVisitSchedule,
  VisitSchedule,
} from '@/types/visitSchedule';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  where
} from 'firebase/firestore';
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Eye,
  HelpCircle,
  KeyRound,
  Lock,
  MessageCircle,
  Printer,
  RefreshCw,
  Save,
  Settings2,
  Share2,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Unlock,
  X
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import SemanaVisitaForm from './SemanaVisitaForm';
import SemanaVisitaPrint from './SemanaVisitaPrint';

interface VisitScheduleManagerViewProps {
  userId: string;
  congregationId: string;
  congregationName: string;
  visitPeriod?: string;
  visitId?: string;
  onBack: () => void;
}

export default function VisitScheduleManagerView({
  userId,
  congregationId,
  congregationName,
  visitPeriod = '',
  visitId,
  onBack,
}: VisitScheduleManagerViewProps) {
  const [schedule, setSchedule] = useState<VisitSchedule | null>(null);
  const [savedScheduleSnapshot, setSavedScheduleSnapshot] = useState<VisitSchedule | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const isDirtyRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'form' | 'preview' | 'permissions'>('form');
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null);

  const handleScheduleChange = (updated: VisitSchedule) => {
    setSchedule(updated);
    setIsDirty(true);
    isDirtyRef.current = true;
  };

  const hasChanges = useMemo(
    () =>
      isDirty ||
      Boolean(
        schedule &&
          savedScheduleSnapshot &&
          serializeVisitSchedule(schedule) !== serializeVisitSchedule(savedScheduleSnapshot)
      ),
    [isDirty, schedule, savedScheduleSnapshot]
  );

  // Estados para replicação de dados entre semanas
  const [isReplicateModalOpen, setIsReplicateModalOpen] = useState(false);
  const [previousSchedules, setPreviousSchedules] = useState<VisitSchedule[]>([]);
  const [loadingPreviousSchedules, setLoadingPreviousSchedules] = useState(false);
  const [selectedSourceId, setSelectedSourceId] = useState<string>('');
  const [replicating, setReplicating] = useState(false);

  // ID do documento baseado na congregação, usuário e identificador da visita/período
  const safeUserId = (userId || "default_user").replace(/[\/\s]/g, "_");
  const safeCongId = (congregationId || "cong_temp").replace(/[\/\s]/g, "_");

  // Inclui identificador único da visita para evitar sobreposição entre visitas distintas à mesma congregação
  const safeVisitKey = (visitId || (visitPeriod ? visitPeriod.replace(/[^a-zA-Z0-9]/g, '_') : 'atual'))
    .trim()
    .slice(0, 32);
  const docId = `visit_${safeUserId}_${safeCongId}_${safeVisitKey}`;
  const legacyDocId = `visit_${safeUserId}_${safeCongId}`;

  // URL amigável do link público com parâmetros legíveis de congregação e período
  const getShareUrl = (pathSuffix: string = '') => {
    if (typeof window === 'undefined' || !schedule?.shareToken) return '';
    const url = new URL(`${window.location.origin}/visita/${schedule.shareToken}${pathSuffix}`);
    if (schedule.congregationName) {
      url.searchParams.set('cong', schedule.congregationName.trim());
    }
    if (schedule.visitPeriod) {
      url.searchParams.set('periodo', schedule.visitPeriod.trim());
    }
    return url.toString();
  };

  const friendlyPublicUrl = getShareUrl('');
  const friendlyCongregacaoUrl = getShareUrl('/congregacao');
  // Link único e permanente da esposa: vinculado ao viajante (userId), não muda a cada congregação/semana!
  const permanentWifeToken = `fixo_${encodeURIComponent(userId || safeUserId)}`;
  const friendlyEsposasUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/visita/${permanentWifeToken}/esposa?v=2`
      : '';

  const [copiedType, setCopiedType] = useState<'anciaos' | 'congregacao' | 'esposas' | null>(null);

  const handleSave = async (customSchedule?: VisitSchedule, silent: boolean = false) => {
    const toSave = customSchedule || schedule;
    if (!toSave) return;
    if (!silent) {
      setSaving(true);
      setFeedbackMsg(null);
    }
    try {
      const docRef = doc(db, 'visit_schedules', docId);
      const normalizedData = normalizeVisitSchedule({
        ...toSave,
        id: docId,
        updatedAt: new Date().toISOString(),
      });
      const cleanDataToSave: VisitSchedule = JSON.parse(JSON.stringify(normalizedData));
      isDirtyRef.current = false;
      setIsDirty(false);
      setSchedule(cleanDataToSave);
      setSavedScheduleSnapshot(JSON.parse(JSON.stringify(cleanDataToSave)));
      await setDoc(docRef, cleanDataToSave, { merge: true });
      if (!silent) {
        setFeedbackMsg({ type: 'success', text: 'Programação salva com sucesso!' });
        setTimeout(() => setFeedbackMsg(null), 3000);
      }
    } catch (err: any) {
      console.error('Erro ao salvar:', err);
      if (!silent) {
        setFeedbackMsg({ type: 'error', text: 'Não foi possível salvar as alterações.' });
      }
    } finally {
      if (!silent) setSaving(false);
    }
  };

  const handleCopyTargetLink = async (url: string, type: 'anciaos' | 'congregacao' | 'esposas', label: string) => {
    if (!url) return;
    navigator.clipboard.writeText(url);
    setCopiedType(type);
    setFeedbackMsg({
      type: 'success',
      text:
        type === 'esposas'
          ? 'Dados salvos e Link Único Permanente da Esposa copiado!'
          : type === 'anciaos'
          ? `Link dos Anciãos copiado! (PIN de acesso: ${schedule?.elderAccessPin || '----'})`
          : `Dados salvos e link para ${label} copiado! (${schedule?.congregationName} • ${schedule?.visitPeriod})`,
    });
    setTimeout(() => setCopiedType(null), 2500);
    setTimeout(() => setFeedbackMsg(null), 4000);
    // Salva automaticamente no Firestore para garantir que quem abrir o link veja exatamente o que está na tela
    await handleSave(undefined, true);
  };

  const handleCopyLink = () => handleCopyTargetLink(friendlyPublicUrl, 'anciaos', 'os Anciãos');

  const handleRegeneratePin = async () => {
    if (!schedule) return;
    let nextPin = generateElderPin();
    while (nextPin === schedule.elderAccessPin) {
      nextPin = generateElderPin();
    }
    const updated: VisitSchedule = {
      ...schedule,
      elderAccessPin: nextPin,
    };
    setSchedule(updated);
    await handleSave(updated, true);
    setFeedbackMsg({
      type: 'info',
      text: `Novo PIN dos Anciãos gerado e salvo: ${nextPin}`,
    });
    setTimeout(() => setFeedbackMsg(null), 4000);
  };

  const handleCustomPinChange = async (rawVal: string) => {
    if (!schedule) return;
    const digits = rawVal.replace(/\D/g, '').slice(0, 4);
    const updated: VisitSchedule = {
      ...schedule,
      elderAccessPin: digits,
    };
    setSchedule(updated);
    if (digits.length === 4) {
      await handleSave(updated, true);
    } else {
      setIsDirty(true);
      isDirtyRef.current = true;
    }
  };

  const handleToggleElderLinkLock = async () => {
    if (!schedule) return;
    const nextLocked = !schedule.isElderLinkLocked;
    const updated: VisitSchedule = {
      ...schedule,
      isElderLinkLocked: nextLocked,
    };
    setSchedule(updated);
    await handleSave(updated, true);
    setFeedbackMsg({
      type: nextLocked ? 'info' : 'success',
      text: nextLocked
        ? 'Link dos Anciãos bloqueado! Ninguém conseguirá acessar até você desbloquear.'
        : 'Link dos Anciãos liberado novamente para acesso com PIN.',
    });
    setTimeout(() => setFeedbackMsg(null), 4000);
  };

  const handleWhatsAppShare = async () => {
    if (!friendlyPublicUrl || !schedule) return;
    await handleSave(undefined, true);
    const pinText = schedule.elderAccessPin ? `\n🔑 *Código PIN de Acesso:* *${schedule.elderAccessPin}*\n` : '';
    const msg = encodeURIComponent(
      `🏛️ *Semana da Visita — Congregação ${schedule.congregationName}*\n` +
      `🗓️ *Período:* ${schedule.visitPeriod}\n\n` +
      `Olá, irmãos da comissão de serviço!\n\n` +
      `Segue o link para preenchimento da programação de atividades da congregação e envio de informações para a reunião de anciãos:\n\n` +
      `👉 ${friendlyPublicUrl}\n` +
      pinText +
      `\n🔒 *Atenção (Uso Confidencial):* Esta página é protegida por PIN e contém informações restritas ao corpo de anciãos. Por favor, *não compartilhe este link ou o PIN com outros irmãos* (para a congregação, utilize apenas o link do Mural Público).\n\n` +
      `_Basta abrir pelo celular ou computador e digitar o PIN acima. As informações são sincronizadas automaticamente com o viajante._`
    );
    window.open(`https://api.whatsapp.com/send?text=${msg}`, '_blank');
  };

  const handleWhatsAppShareCongregacao = async () => {
    if (!friendlyCongregacaoUrl || !schedule) return;
    await handleSave(undefined, true);
    const msg = encodeURIComponent(
      `🏛️ *Mural da Visita — Congregação ${schedule.congregationName}*\n` +
      `🗓️ *Período:* ${schedule.visitPeriod}\n\n` +
      `Prezados irmãos da congregação,\n\n` +
      `Segue o link com a programação das *Saídas de Campo* e *Reuniões* da semana da visita do superintendente de circuito:\n\n` +
      `👉 ${friendlyCongregacaoUrl}\n\n` +
      `_Acompanhe os horários e locais das atividades congregacionais._`
    );
    window.open(`https://api.whatsapp.com/send?text=${msg}`, '_blank');
  };

  const handleWhatsAppShareEsposas = async () => {
    if (!friendlyEsposasUrl || !schedule) return;
    await handleSave(undefined, true);
    const msg = encodeURIComponent(
      `🌸 *Programação Semanal da Visita*\n\n` +
      `Segue o nosso *link fixo* para você acompanhar a programação das nossas visitas (saídas de campo, estudos bíblicos, reuniões e almoços):\n\n` +
      `👉 ${friendlyEsposasUrl}\n\n` +
      `_Você pode salvar ou fixar este link! Ele abre automaticamente na visita da semana atual e também permite ver a próxima semana ou semanas anteriores._`
    );
    window.open(`https://api.whatsapp.com/send?text=${msg}`, '_blank');
  };

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let isCancelled = false;

    // Redefinir estados locais ao trocar de congregação/visita para garantir isolamento e unicidade total
    setSchedule(null);
    setSavedScheduleSnapshot(null);
    setIsDirty(false);
    isDirtyRef.current = false;
    setLoading(true);
    setCopied(false);
    setFeedbackMsg(null);

    const initAndSubscribe = async () => {
      try {
        const primaryDocRef = doc(db, 'visit_schedules', docId);
        const primarySnap = await getDoc(primaryDocRef);

        if (isCancelled) return;

        if (primarySnap.exists()) {
          // Documento já existe com token persistido
          const loadedData = normalizeVisitSchedule(primarySnap.data() as VisitSchedule);
          setSchedule(loadedData);
          setSavedScheduleSnapshot(JSON.parse(JSON.stringify(loadedData)));
        } else {
          // Documento ainda não existe no Firestore
          // Verificar compatibilidade retroativa com chave antiga legada (visit_${userId}_${congregationId})
          let baseData: Partial<VisitSchedule> | null = null;
          if (docId !== legacyDocId) {
            try {
              const legacyDocRef = doc(db, 'visit_schedules', legacyDocId);
              const legacySnap = await getDoc(legacyDocRef);
              if (legacySnap.exists()) {
                const lData = legacySnap.data() as VisitSchedule;
                if (!lData.visitPeriod || lData.visitPeriod === visitPeriod || lData.visitPeriod === 'Semana da Visita') {
                  baseData = lData;
                }
              }
            } catch (legacyErr) {
              console.warn("Verificação de documento legado ignorada:", legacyErr);
            }
          }

          const newSchedule: VisitSchedule = normalizeVisitSchedule({
            ...(baseData || {}),
            id: docId,
            userId,
            congregationId,
            congregationName,
            visitPeriod: visitPeriod || baseData?.visitPeriod || "Semana da Visita",
            // Gera SEMPRE um novo shareToken exclusivo para este docId para nunca colidir com documentos legados no Firestore
            shareToken: generateShareToken(),
            createdAt: baseData?.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });

          // CRÍTICO: Persistir imediatamente no Firestore!
          // Isso garante que se o usuário copiar o link ou enviar no WhatsApp logo após abrir a tela,
          // o link público (/visita/[token]) encontrará o documento sem falhas ("Link Não Encontrado").
          await setDoc(primaryDocRef, newSchedule, { merge: true });
          if (!isCancelled) {
            setSchedule(newSchedule);
            setSavedScheduleSnapshot(JSON.parse(JSON.stringify(newSchedule)));
          }
        }

        if (isCancelled) return;
        setLoading(false);

        // Assinar atualizações em tempo real para sincronização com preenchimentos dos anciãos
        unsubscribe = onSnapshot(primaryDocRef, (snap) => {
          if (snap.exists() && !isCancelled && !isDirtyRef.current) {
            const incoming = normalizeVisitSchedule(snap.data() as VisitSchedule);
            setSchedule(incoming);
            setSavedScheduleSnapshot(JSON.parse(JSON.stringify(incoming)));
          }
        }, (error) => {
          console.error("Erro no listener em tempo real da visita:", error);
          if (!isCancelled) {
            setFeedbackMsg({ type: "error", text: "Erro ao sincronizar dados em tempo real com o banco." });
            setLoading(false);
          }
        });

      } catch (err: any) {
        console.error('Erro ao inicializar programação da visita:', err);
        if (!isCancelled) {
          const fallbackSchedule: VisitSchedule = normalizeVisitSchedule({
            id: docId,
            userId,
            congregationId,
            congregationName,
            visitPeriod: visitPeriod || "Semana da Visita",
            shareToken: generateShareToken(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
          setSchedule(fallbackSchedule);
          setSavedScheduleSnapshot(JSON.parse(JSON.stringify(fallbackSchedule)));
          setFeedbackMsg({ type: 'error', text: 'Não foi possível inicializar a persistência. Verifique a conexão.' });
          setLoading(false);
        }
      }
    };

    initAndSubscribe();

    return () => {
      isCancelled = true;
      if (unsubscribe) unsubscribe();
    };
  }, [docId, legacyDocId, userId, congregationId, congregationName, visitPeriod]);

  // Buscar visitas anteriores para replicação de modelo
  const handleOpenReplicateModal = async () => {
    setIsReplicateModalOpen(true);
    setLoadingPreviousSchedules(true);
    try {
      const q1 = query(
        collection(db, 'visit_schedules'),
        where('userId', '==', userId)
      );
      const snap = await getDocs(q1);
      const list: VisitSchedule[] = [];
      snap.forEach((d) => {
        const item = normalizeVisitSchedule(d.data() as VisitSchedule);
        if (d.id !== docId && item.shareToken !== schedule?.shareToken) {
          list.push({ ...item, id: d.id });
        }
      });

      if (list.length === 0 && safeUserId !== userId) {
        const q2 = query(
          collection(db, 'visit_schedules'),
          where('userId', '==', safeUserId)
        );
        const snap2 = await getDocs(q2);
        snap2.forEach((d) => {
          const item = normalizeVisitSchedule(d.data() as VisitSchedule);
          if (d.id !== docId && item.shareToken !== schedule?.shareToken) {
            list.push({ ...item, id: d.id });
          }
        });
      }

      // Ordenar pelas mais recentes
      list.sort((a, b) => {
        const dateA = new Date(a.updatedAt || a.createdAt || 0).getTime();
        const dateB = new Date(b.updatedAt || b.createdAt || 0).getTime();
        return dateB - dateA;
      });

      setPreviousSchedules(list);
      if (list.length > 0) {
        setSelectedSourceId(list[0].id || '');
      }
    } catch (err) {
      console.error('Erro ao buscar visitas anteriores para replicação:', err);
      setFeedbackMsg({ type: 'error', text: 'Não foi possível carregar o histórico de visitas.' });
    } finally {
      setLoadingPreviousSchedules(false);
    }
  };

  // Executar a replicação dos campos do viajante mantendo intactos os dados da congregação atual
  const executeReplication = async (sourceSchedule: VisitSchedule) => {
    if (!schedule) return;
    setReplicating(true);
    try {
      const replicated: VisitSchedule = {
        ...schedule,

        // 1. Dados fixos do viajante e casal
        circuit: sourceSchedule.circuit || schedule.circuit,
        coupleNames: sourceSchedule.coupleNames || schedule.coupleNames,
        mealsHeaderTime: sourceSchedule.mealsHeaderTime || schedule.mealsHeaderTime,

        // 2. Configurações de dias ativos e permissões concedidas
        activeDays: sourceSchedule.activeDays ? { ...sourceSchedule.activeDays } : schedule.activeDays,
        permissions: sourceSchedule.permissions ? { ...sourceSchedule.permissions } : schedule.permissions,

        // 3. Reuniões: temas de discursos e cânticos (os horários da reunião do meio de semana e fim de semana NÃO devem ser replicados, pois dependem da congregação)
        meetings: {
          ...schedule.meetings,
          midweek: {
            ...schedule.meetings?.midweek,
            time: schedule.meetings?.midweek?.time || '19:30', // Mantém o horário da congregação atual
            serviceTalkTheme: sourceSchedule.meetings?.midweek?.serviceTalkTheme || '',
            serviceTalkSong: sourceSchedule.meetings?.midweek?.serviceTalkSong || '',
            finalPrayerBrother: schedule.meetings?.midweek?.finalPrayerBrother || '',
          },
          weekend: {
            ...schedule.meetings?.weekend,
            day: schedule.meetings?.weekend?.day || sourceSchedule.meetings?.weekend?.day || 'domingo',
            time: schedule.meetings?.weekend?.time || '09:00', // Mantém o horário da congregação atual
            publicTalkTheme: sourceSchedule.meetings?.weekend?.publicTalkTheme || '',
            publicTalkSong: sourceSchedule.meetings?.weekend?.publicTalkSong || '',
            finalTalkTheme: sourceSchedule.meetings?.weekend?.finalTalkTheme || '',
            finalTalkSong: sourceSchedule.meetings?.weekend?.finalTalkSong || '',
          },
        },

        // 4. Reuniões Adicionais (Pioneiros e Anciãos/SM)
        additionalMeetings: {
          ...schedule.additionalMeetings,
          pioneers: {
            ...schedule.additionalMeetings?.pioneers,
            day: sourceSchedule.additionalMeetings?.pioneers?.day || schedule.additionalMeetings?.pioneers?.day,
            time: sourceSchedule.additionalMeetings?.pioneers?.time || schedule.additionalMeetings?.pioneers?.time,
          },
          eldersAndServants: {
            ...schedule.additionalMeetings?.eldersAndServants,
            day: sourceSchedule.additionalMeetings?.eldersAndServants?.day || schedule.additionalMeetings?.eldersAndServants?.day,
            time: sourceSchedule.additionalMeetings?.eldersAndServants?.time || schedule.additionalMeetings?.eldersAndServants?.time,
          },
        },

        // 5. Estudos bíblicos e revisitas planejados do casal e acompanhantes
        studiesAndVisits: {
          ...schedule.studiesAndVisits,
          husbandName: sourceSchedule.studiesAndVisits?.husbandName || schedule.studiesAndVisits?.husbandName || '',
          wifeName: sourceSchedule.studiesAndVisits?.wifeName || schedule.studiesAndVisits?.wifeName || '',
          husbandRows: sourceSchedule.studiesAndVisits?.husbandRows?.map((r) => ({
            id: r.id || Date.now().toString() + Math.random().toString(36).substring(2, 6),
            day: r.day || '',
            time: r.time || '',
            lesson: r.lesson || '',
            companionPhone: '', // Campo a ser preenchido pela congregação
          })) || schedule.studiesAndVisits?.husbandRows || [],
          wifeRows: sourceSchedule.studiesAndVisits?.wifeRows?.map((r) => ({
            id: r.id || Date.now().toString() + Math.random().toString(36).substring(2, 6),
            day: r.day || '',
            time: r.time || '',
            lesson: r.lesson || '',
            companionPhone: '', // Campo a ser preenchido pela congregação
          })) || schedule.studiesAndVisits?.wifeRows || [],
          companions: sourceSchedule.studiesAndVisits?.companions?.map((c) => ({
            id: c.id || Date.now().toString() + Math.random().toString(36).substring(2, 6),
            name: c.name || '',
            hasWife: !!c.hasWife,
            wifeName: c.wifeName || '',
            rows: (c.rows || []).map((r) => ({
              id: r.id || Date.now().toString() + Math.random().toString(36).substring(2, 6),
              day: r.day || '',
              time: r.time || '',
              lesson: r.lesson || '',
              companionPhone: '',
            })),
            wifeRows: (c.wifeRows || []).map((r) => ({
              id: r.id || Date.now().toString() + Math.random().toString(36).substring(2, 6),
              day: r.day || '',
              time: r.time || '',
              lesson: r.lesson || '',
              companionPhone: '',
            })),
            hasShepherding: !!c.hasShepherding,
            shepherding: (c.shepherding && c.shepherding.length > 0)
              ? c.shepherding.map((sh, idx) => ({
                  id: sh.id || Date.now().toString() + idx,
                  dateTime: sh.dateTime || '',
                  family: '',
                  companion: '',
                  situation: '',
                }))
              : [],
          })) || schedule.studiesAndVisits?.companions || [],
        },

        // 6. Saídas de Campo: replica apenas os dias e horários definidos pelo viajante. Os locais NUNCA devem vir pois são locais!
        fieldService: (sourceSchedule.fieldService || []).map((fs, idx) => ({
          id: fs.id || Date.now().toString() + idx,
          day: fs.day || '',
          time: fs.time || '',
          location: schedule.fieldService?.[idx]?.location || '', // preserva local da congregação atual se houver, ou vazio
        })),

        // 7. Pastoreio: replica a quantidade e os dias/horários das visitas da semana de origem (sem dados confidenciais de famílias/irmãos locais)
        shepherding: (sourceSchedule.shepherding && sourceSchedule.shepherding.length > 0)
          ? sourceSchedule.shepherding.map((sh, idx) => ({
              id: sh.id || Date.now().toString() + idx,
              dateTime: sh.dateTime || '',
              family: schedule.shepherding?.[idx]?.family || '',
              companion: schedule.shepherding?.[idx]?.companion || '',
              situation: schedule.shepherding?.[idx]?.situation || '',
            }))
          : schedule.shepherding,

        // 8. Refeições: replica os dias e se algum dia o almoço é na hospedagem (isLodging), preservando anfitriões locais nos demais dias
        meals:
          sourceSchedule.meals && sourceSchedule.meals.length > 0
            ? sourceSchedule.meals.map((srcMeal, idx) => {
                const cleanDay = (srcMeal.day || '').replace(/-feira/gi, '').trim();
                const existingLocalMeal =
                  (schedule.meals || []).find(
                    (m) => (m.day || '').replace(/-feira/gi, '').trim().toLowerCase() === cleanDay.toLowerCase()
                  ) || schedule.meals?.[idx];

                const isLodging = !!srcMeal.isLodging;
                const localHost =
                  existingLocalMeal && !existingLocalMeal.isLodging && existingLocalMeal.host !== 'Hospedagem'
                    ? existingLocalMeal.host
                    : '';
                const localAddressPhone =
                  existingLocalMeal &&
                  !existingLocalMeal.isLodging &&
                  existingLocalMeal.addressPhone !== 'Almoço na Hospedagem'
                    ? existingLocalMeal.addressPhone
                    : '';

                return {
                  id: existingLocalMeal?.id || srcMeal.id || `meal_${idx}`,
                  day: cleanDay,
                  isLodging,
                  host: isLodging ? 'Hospedagem' : localHost,
                  addressPhone: isLodging ? 'Almoço na Hospedagem' : localAddressPhone,
                };
              })
            : schedule.meals,

        // 9. DADOS ESPECÍFICOS DA CONGREGAÇÃO ATUAL MANTIDOS RIGOROSAMENTE INTACTOS:
        id: docId,
        userId: schedule.userId,
        congregationId: schedule.congregationId,
        congregationName: schedule.congregationName,
        visitPeriod: schedule.visitPeriod,
        shareToken: schedule.shareToken, // Mantém o token exclusivo da congregação atual
        elderAccessPin: schedule.elderAccessPin,
        isElderLinkLocked: schedule.isElderLinkLocked,
        eldersMeetingInput: schedule.eldersMeetingInput, // Mantém sugestões de pauta e indicações locais
        status: schedule.status,
        updatedAt: new Date().toISOString(),
      };

      const normalizedReplicated = normalizeVisitSchedule(replicated);
      await handleSave(normalizedReplicated, true);
      setIsReplicateModalOpen(false);
      setFeedbackMsg({
        type: 'success',
        text: `Dados do viajante replicados com sucesso de "${sourceSchedule.congregationName}" (${sourceSchedule.visitPeriod})!`,
      });
      setTimeout(() => setFeedbackMsg(null), 4000);
    } catch (err) {
      console.error('Erro ao replicar dados da visita:', err);
      setFeedbackMsg({ type: 'error', text: 'Erro ao aplicar os dados replicados.' });
    } finally {
      setReplicating(false);
    }
  };

  const selectedSourceSchedule = useMemo(() => {
    return previousSchedules.find(p => p.id === selectedSourceId) || previousSchedules[0] || null;
  }, [previousSchedules, selectedSourceId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 space-y-4">
        <div className="w-8 h-8 border-4 border-primary-200 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-medium text-typography-600">Carregando programação da visita...</p>
      </div>
    );
  }

  if (!schedule) return null;

  return (
    <div className="space-y-6 max-w-6xl mx-auto w-full pb-16">
      {/* BARRA SUPERIOR DE AÇÕES (Não sai na impressão) */}
      <div className="bg-surface-100 border border-surface-300 rounded-3xl p-4 md:p-5 shadow-sm space-y-4 print:hidden relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary-200 via-primary-150 to-transparent" />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-surface-300 pb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 sm:p-2.5 rounded-xl border border-surface-300 hover:bg-surface-200 text-typography-700 hover:text-typography-900 transition-colors shrink-0 shadow-2xs cursor-pointer"
              title="Voltar"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black text-typography-900 tracking-tight">
                  {schedule.congregationName}
                </h1>
                <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-primary-200/10 text-primary-200 border border-primary-200/20 whitespace-nowrap">
                  Programação de Atividades
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5 text-xs text-typography-500 font-medium">
                <Calendar size={13} className="text-primary-200 shrink-0" />
                <span>{schedule.visitPeriod}</span>
              </div>
            </div>
          </div>

          {/* Botões de Ação */}
          <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto flex-wrap">
            <button
              type="button"
              onClick={handleOpenReplicateModal}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 bg-surface-200 hover:bg-surface-300 border border-surface-300 text-typography-800 px-3.5 py-2.5 rounded-xl font-bold text-xs transition-colors whitespace-nowrap cursor-pointer shadow-2xs"
              title="Replicar modelo ou discursos de outra semana"
            >
              <Copy size={15} className="text-primary-200" />
              <span>Replicar de outra semana</span>
            </button>

            <button
              onClick={() => handleSave()}
              disabled={saving}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 bg-primary-200 hover:bg-primary-300 text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-xs transition-all disabled:opacity-50 whitespace-nowrap cursor-pointer"
            >
              <Save size={15} />
              {saving ? 'Salvando...' : 'Salvar Alterações'}
            </button>

            <button
              onClick={() => window.print()}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 bg-surface-200 hover:bg-surface-300 border border-surface-300 text-typography-800 px-3.5 py-2.5 rounded-xl font-bold text-xs transition-colors whitespace-nowrap cursor-pointer"
            >
              <Printer size={15} />
              Imprimir / PDF
            </button>
          </div>
        </div>

        {/* ÁREA DE COMPARTILHAMENTO COM 3 LINKS DISTINTOS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* 1. Link para os Anciãos (Edição / Preenchimento) */}
          <div className="bg-primary-200/5 border border-primary-200/20 rounded-2xl p-4 flex flex-col justify-between gap-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary-200" />
                  <h3 className="text-xs font-black uppercase tracking-wide text-primary-200 flex items-center gap-1.5">
                    <Share2 size={14} />
                    1. Link dos Anciãos
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={handleToggleElderLinkLock}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border transition-colors cursor-pointer ${
                    schedule.isElderLinkLocked
                      ? 'bg-red-500/15 text-red-700 border-red-500/30 hover:bg-red-500/25'
                      : 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30 hover:bg-emerald-500/25'
                  }`}
                  title={
                    schedule.isElderLinkLocked
                      ? 'Clique para liberar o acesso dos anciãos'
                      : 'Clique para bloquear o acesso a este link'
                  }
                >
                  {schedule.isElderLinkLocked ? <Lock size={11} /> : <Unlock size={11} />}
                  {schedule.isElderLinkLocked ? 'Bloqueado' : 'Acesso Ativo'}
                </button>
              </div>
              <p className="text-xs text-typography-600 leading-snug">
                Protegido por <strong>PIN de 4 dígitos</strong>. Usado pelos anciãos para preencher programação, recomendações e pauta.
              </p>

              {/* Controle do Código PIN */}
              <div className="flex items-center justify-between gap-2 bg-surface-100 px-2.5 py-1.5 rounded-xl border border-surface-300">
                <div className="flex items-center gap-1.5 min-w-0">
                  <KeyRound size={13} className="text-primary-200 shrink-0" />
                  <span className="text-[11px] font-bold text-typography-700 whitespace-nowrap">
                    PIN de Acesso:
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={4}
                    value={schedule.elderAccessPin || ''}
                    onChange={(e) => handleCustomPinChange(e.target.value)}
                    placeholder="0000"
                    className="w-14 text-center font-mono text-xs font-black tracking-widest text-primary-200 bg-primary-200/10 border border-primary-200/30 rounded-lg py-0.5 focus:outline-none focus:border-primary-200"
                    title="Você pode digitar um PIN personalizado de 4 números"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleRegeneratePin}
                  className="inline-flex items-center gap-1 text-[10px] font-bold text-typography-500 hover:text-primary-200 px-1.5 py-0.5 rounded-md hover:bg-surface-200 transition-colors cursor-pointer shrink-0"
                  title="Gerar um novo código PIN de 4 dígitos"
                >
                  <RefreshCw size={11} />
                  <span>Trocar PIN</span>
                </button>
              </div>

              {friendlyPublicUrl && (
                <div className="text-[10px] text-typography-500 font-mono truncate bg-surface-100 p-1.5 rounded-lg border border-surface-300">
                  {friendlyPublicUrl}
                </div>
              )}
            </div>

            <div className="flex items-center gap-1.5 pt-1">
              <button
                onClick={handleCopyLink}
                className="flex-1 flex items-center justify-center gap-1.5 bg-surface-100 border border-surface-300 text-typography-800 hover:bg-surface-200 px-2.5 py-1.5 rounded-lg text-xs font-bold shadow-2xs transition-colors cursor-pointer"
                title="Copiar link dos Anciãos"
              >
                {copiedType === 'anciaos' ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                {copiedType === 'anciaos' ? 'Copiado!' : 'Copiar'}
              </button>

              <button
                onClick={handleWhatsAppShare}
                className="flex-1 flex items-center justify-center gap-1.5 bg-[#25D366] hover:bg-[#20bd5a] text-white px-2.5 py-1.5 rounded-lg text-xs font-bold shadow-2xs transition-colors cursor-pointer"
                title="Compartilhar Link + PIN no WhatsApp com Anciãos"
              >
                <MessageCircle size={13} />
                WhatsApp
              </button>

              {friendlyPublicUrl && (
                <a
                  href={friendlyPublicUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1.5 text-typography-400 hover:text-primary-200 rounded-lg hover:bg-surface-200 transition-colors"
                  title="Abrir página em nova aba"
                >
                  <ExternalLink size={14} />
                </a>
              )}
            </div>
          </div>

          {/* 2. Link Público para a Congregação (Mural) */}
          <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-4 flex flex-col justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <h3 className="text-xs font-black uppercase tracking-wide text-emerald-800 flex items-center gap-1.5">
                  <Share2 size={14} />
                  2. Mural da Congregação
                </h3>
              </div>
              <p className="text-xs text-typography-600 leading-snug">
                Público para todos os irmãos. Mostra <strong>apenas</strong> Saídas de Campo e Reuniões (sem pastoreio nem refeições).
              </p>
              {friendlyCongregacaoUrl && (
                <div className="text-[10px] text-typography-500 font-mono truncate bg-surface-100 p-1.5 rounded-lg border border-surface-300">
                  {friendlyCongregacaoUrl}
                </div>
              )}
            </div>

            <div className="flex items-center gap-1.5 pt-1">
              <button
                onClick={() => handleCopyTargetLink(friendlyCongregacaoUrl, 'congregacao', 'o Mural da Congregação')}
                className="flex-1 flex items-center justify-center gap-1.5 bg-surface-100 border border-surface-300 text-typography-800 hover:bg-surface-200 px-2.5 py-1.5 rounded-lg text-xs font-bold shadow-2xs transition-colors cursor-pointer"
                title="Copiar link do Mural da Congregação"
              >
                {copiedType === 'congregacao' ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                {copiedType === 'congregacao' ? 'Copiado!' : 'Copiar'}
              </button>

              <button
                onClick={handleWhatsAppShareCongregacao}
                className="flex-1 flex items-center justify-center gap-1.5 bg-[#25D366] hover:bg-[#20bd5a] text-white px-2.5 py-1.5 rounded-lg text-xs font-bold shadow-2xs transition-colors cursor-pointer"
                title="Compartilhar no WhatsApp com a Congregação"
              >
                <MessageCircle size={13} />
                WhatsApp
              </button>

              {friendlyCongregacaoUrl && (
                <a
                  href={friendlyCongregacaoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1.5 text-typography-400 hover:text-emerald-600 rounded-lg hover:bg-surface-200 transition-colors"
                  title="Abrir mural em nova aba"
                >
                  <ExternalLink size={14} />
                </a>
              )}
            </div>
          </div>

          {/* 3. Link Único Permanente para a Esposa (Sem Pastoreio) */}
          <div className="bg-pink-500/5 border border-pink-500/20 rounded-2xl p-4 flex flex-col justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-pink-500" />
                  <h3 className="text-xs font-black uppercase tracking-wide text-pink-700 flex items-center gap-1.5">
                    <Share2 size={14} />
                    3. Link Único da Esposa
                  </h3>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-pink-500/15 text-pink-700 border border-pink-500/25">
                  Link Fixo
                </span>
              </div>
              <p className="text-xs text-typography-600 leading-snug">
                <strong>Não muda nunca!</strong> Abre automaticamente na visita da semana atual e permite ver a próxima semana ou anteriores (sem pastoreio).
              </p>
              {friendlyEsposasUrl && (
                <div className="text-[10px] text-typography-500 font-mono truncate bg-surface-100 p-1.5 rounded-lg border border-surface-300">
                  {friendlyEsposasUrl}
                </div>
              )}
            </div>

            <div className="flex items-center gap-1.5 pt-1">
              <button
                onClick={() => handleCopyTargetLink(friendlyEsposasUrl, 'esposas', 'a Esposa')}
                className="flex-1 flex items-center justify-center gap-1.5 bg-surface-100 border border-surface-300 text-typography-800 hover:bg-surface-200 px-2.5 py-1.5 rounded-lg text-xs font-bold shadow-2xs transition-colors cursor-pointer"
                title="Copiar link da Esposa"
              >
                {copiedType === 'esposas' ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                {copiedType === 'esposas' ? 'Copiado!' : 'Copiar'}
              </button>

              <button
                onClick={handleWhatsAppShareEsposas}
                className="flex-1 flex items-center justify-center gap-1.5 bg-[#25D366] hover:bg-[#20bd5a] text-white px-2.5 py-1.5 rounded-lg text-xs font-bold shadow-2xs transition-colors cursor-pointer"
                title="Compartilhar no WhatsApp com a Esposa"
              >
                <MessageCircle size={13} />
                WhatsApp
              </button>

              {friendlyEsposasUrl && (
                <a
                  href={friendlyEsposasUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1.5 text-typography-400 hover:text-pink-600 rounded-lg hover:bg-surface-200 transition-colors"
                  title="Abrir página em nova aba"
                >
                  <ExternalLink size={14} />
                </a>
              )}
            </div>
          </div>
        </div>

        {/* FEEDBACK MENSAGEM */}
        {feedbackMsg && (
          <div className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 animate-in fade-in duration-200 ${
            feedbackMsg.type === 'success' 
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
              : feedbackMsg.type === 'error'
              ? 'bg-red-50 text-red-800 border border-red-200'
              : 'bg-blue-50 text-blue-800 border border-blue-200'
          }`}>
            {feedbackMsg.type === 'success' ? <Check size={15} /> : <AlertCircle size={15} />}
            <span>{feedbackMsg.text}</span>
          </div>
        )}

        {/* NAVEGAÇÃO DE ABAS */}
        <div className="flex border-b border-surface-300 gap-2 sm:gap-4 pt-1 overflow-x-auto no-scrollbar">
          <button
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
            onClick={() => setActiveTab('preview')}
            className={`pb-2.5 text-xs font-bold flex items-center gap-1.5 border-b-2 whitespace-nowrap transition-all cursor-pointer ${
              activeTab === 'preview'
                ? 'border-primary-200 text-primary-200'
                : 'border-transparent text-typography-500 hover:text-typography-800'
            }`}
          >
            <Eye size={15} />
            Folha da Visita (A4)
          </button>

          <button
            onClick={() => setActiveTab('permissions')}
            className={`pb-2.5 text-xs font-bold flex items-center gap-1.5 border-b-2 whitespace-nowrap transition-all cursor-pointer ${
              activeTab === 'permissions'
                ? 'border-primary-200 text-primary-200'
                : 'border-transparent text-typography-500 hover:text-typography-800'
            }`}
          >
            <Settings2 size={15} />
            Permissões dos Anciãos
          </button>
        </div>
      </div>

      {/* CONTEÚDO DA ABA (TELA) */}
      <div className="print:hidden">
        {activeTab === 'form' && (
          <div className="space-y-4">
            {/* Dica rápida de replicação de modelo */}
            <div className="bg-surface-100 border border-surface-300 rounded-2xl p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-2xs">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-1.5 rounded-lg bg-primary-200/10 text-primary-200 shrink-0">
                  <Sparkles size={16} />
                </div>
                <div className="text-typography-700">
                  Preenchendo uma nova semana? Você pode <strong className="text-typography-900">replicar seus discursos, horários padrão e estudos</strong> de outra congregação com 1 clique.
                </div>
              </div>
              <button
                type="button"
                onClick={handleOpenReplicateModal}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-primary-200/10 hover:bg-primary-200/20 text-primary-200 border border-primary-200/30 rounded-xl font-bold text-xs transition-colors shrink-0 cursor-pointer"
              >
                <Copy size={13} />
                Replicar de outra semana
              </button>
            </div>

            <SemanaVisitaForm
              data={schedule}
              onChange={handleScheduleChange}
              elderMode={false}
            />
          </div>
        )}

        {activeTab === 'preview' && (
          <div className="space-y-4">
            <div className="text-center text-xs text-typography-500">
              💡 <em>Você pode editar diretamente na folha abaixo. As alterações serão salvas ao clicar em Salvar Alterações.</em>
            </div>

            <div className="overflow-x-auto pb-6">
              <SemanaVisitaPrint
                data={schedule}
                onChange={handleScheduleChange}
                isReadOnly={false}
                elderMode={false}
              />
            </div>
          </div>
        )}

        {activeTab === 'permissions' && (
          <div className="bg-surface-100 border border-surface-300 rounded-3xl p-6 shadow-xs space-y-6 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary-200 via-primary-150 to-transparent" />
            <div>
              <h2 className="text-base font-bold text-typography-900">O que os Anciãos podem preencher?</h2>
              <p className="text-xs text-typography-500 mt-1">
                Defina quais seções da folha ficarão liberadas para edição quando os anciãos abrirem o link público.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                {
                  key: 'allowFieldServiceEdit',
                  label: 'Locais do Serviço de Campo',
                  desc: 'Permite que definam o local de cada saída de campo (os horários são definidos pelo viajante).',
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
                  key: 'allowMidweekMeetingTimeEdit',
                  label: 'Horário da Reunião de Meio de Semana',
                  desc: 'Permite que a congregação informe o horário de início da reunião de meio de semana.',
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
                {
                  key: 'allowEldersAgendaInputEdit',
                  label: 'Sugestões de Pauta, Recomendações e Remoções',
                  desc: 'Permite que os anciãos enviem sugestões de assuntos para a pauta, recomendações e remoções.',
                },
              ].map((item) => {
                const isAllowed = !!(schedule.permissions as any)?.[item.key];
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
                      handleScheduleChange(updated);
                    }}
                    className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex items-start gap-3.5 ${
                      isAllowed
                        ? 'border-primary-200 bg-primary-200/10 text-typography-900'
                        : 'border-surface-300 bg-surface-200/40 text-typography-500'
                    }`}
                  >
                    <div
                      className={`mt-0.5 p-1.5 rounded-lg ${
                        isAllowed ? 'bg-primary-200 text-white' : 'bg-surface-300 text-typography-400'
                      }`}
                    >
                      {isAllowed ? <Unlock size={14} /> : <Lock size={14} />}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-typography-900">{item.label}</h4>
                      <p className="text-[11px] text-typography-500 mt-0.5">{item.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* COMPONENTE EXCLUSIVO PARA IMPRESSÃO (sempre pronto quando apertar Imprimir) */}
      <div className="hidden print:block">
        <SemanaVisitaPrint
          data={schedule}
          isReadOnly={true}
          elderMode={false}
        />
      </div>

      {/* BARRA FLUTUANTE SUSPENSA PARA SALVAR (quando houver alterações não salvas) */}
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

      {/* MODAL DE REPLICAÇÃO DE DADOS ENTRE SEMANAS */}
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {isReplicateModalOpen && (
              <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs print:hidden">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 10 }}
                  className="bg-surface-100 border border-surface-300 rounded-3xl w-full max-w-xl max-h-[84dvh] sm:max-h-[88vh] overflow-hidden shadow-2xl flex flex-col relative"
                >
                  {/* Header do Modal (Fixo no topo) */}
                  <div className="p-4 sm:p-5 border-b border-surface-300 flex items-center justify-between shrink-0 bg-surface-100">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-primary-200/10 text-primary-200">
                        <Copy size={18} />
                      </div>
                      <div>
                        <h3 className="text-base font-black text-typography-900 tracking-tight">
                          Replicar Dados de Outra Semana
                        </h3>
                        <p className="text-xs text-typography-500">
                          Importe seus temas de discursos, horários padrão e rotina fixa
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setIsReplicateModalOpen(false)}
                      className="p-1.5 rounded-lg text-typography-400 hover:text-typography-900 hover:bg-surface-200 transition-colors cursor-pointer"
                      title="Fechar"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  {/* Corpo do Modal (Rolável) */}
                  <div className="p-4 sm:p-6 space-y-4 flex-1 min-h-0 overflow-y-auto">
                    {loadingPreviousSchedules ? (
                      <div className="py-12 flex flex-col items-center justify-center space-y-3">
                        <div className="w-7 h-7 border-3 border-primary-200 border-t-transparent rounded-full animate-spin" />
                        <p className="text-xs text-typography-500 font-medium">Buscando semanas anteriores...</p>
                      </div>
                    ) : previousSchedules.length === 0 ? (
                      <div className="py-8 text-center space-y-3 bg-surface-200/50 rounded-2xl p-6 border border-surface-300">
                        <div className="w-12 h-12 bg-primary-200/10 text-primary-200 rounded-2xl flex items-center justify-center mx-auto">
                          <HelpCircle size={24} />
                        </div>
                        <h4 className="text-sm font-bold text-typography-900">Nenhuma outra visita encontrada</h4>
                        <p className="text-xs text-typography-500 max-w-md mx-auto leading-relaxed">
                          Quando você cadastrar e salvar a programação de outras semanas no itinerário, poderá copiá-las aqui com 1 clique para preencher instantaneamente as próximas congregações!
                        </p>
                      </div>
                    ) : (
                      <>
                        {/* Botão Rápido: Copiar da Última Visita */}
                        {previousSchedules[0] && (
                          <div className="bg-primary-200/5 border border-primary-200/20 rounded-2xl p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="min-w-0">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-primary-200 block mb-0.5">
                                Opção Mais Rápida (Última Atualizada)
                              </span>
                              <h4 className="text-xs font-bold text-typography-900 truncate">
                                {previousSchedules[0].congregationName}
                              </h4>
                              <span className="text-[11px] text-typography-500">
                                {previousSchedules[0].visitPeriod}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => executeReplication(previousSchedules[0])}
                              disabled={replicating}
                              className="flex items-center justify-center gap-1.5 bg-primary-200 hover:bg-primary-300 text-white px-3.5 py-2 rounded-xl font-bold text-xs shadow-xs transition-all disabled:opacity-50 shrink-0 cursor-pointer"
                            >
                              <Sparkles size={14} />
                              Copiar da Última Visita
                            </button>
                          </div>
                        )}

                        {/* Ou Selecionar Visita Específica */}
                        <div className="bg-surface-200/40 border border-surface-300 rounded-2xl p-3.5 sm:p-4 space-y-3">
                          <label className="text-xs font-bold text-typography-800 block">
                            Ou selecione outra semana do histórico:
                          </label>
                          <CustomSelect
                            className="w-full"
                            value={selectedSourceId}
                            onChange={(val) => setSelectedSourceId(val)}
                            options={previousSchedules.map((p): CustomSelectOption => ({
                              value: p.id || '',
                              label: `${p.congregationName} — ${p.visitPeriod}`,
                              description: p.coupleNames ? `Casal: ${p.coupleNames}` : undefined,
                            }))}
                            placeholder="Escolha a visita de origem..."
                            size="md"
                            searchable={previousSchedules.length > 4}
                          />

                          {selectedSourceSchedule && (
                            <button
                              type="button"
                              onClick={() => executeReplication(selectedSourceSchedule)}
                              disabled={replicating}
                              className="w-full flex items-center justify-center gap-2 bg-primary-200 hover:bg-primary-300 text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                            >
                              {replicating ? (
                                <RefreshCw size={14} className="animate-spin shrink-0" />
                              ) : (
                                <CheckCircle2 size={14} className="shrink-0" />
                              )}
                              <span className="truncate">
                                {replicating
                                  ? 'Replicando...'
                                  : `Replicar de: ${selectedSourceSchedule.congregationName}`}
                              </span>
                            </button>
                          )}
                        </div>

                        {/* Card Informativo com o que é copiado vs preservado */}
                        <div className="bg-surface-200/60 rounded-2xl p-4 border border-surface-300 text-xs space-y-3">
                          <div className="font-bold text-typography-900 flex items-center gap-1.5">
                            <ShieldCheck size={15} className="text-primary-200" />
                            O que acontece ao replicar?
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
                            <div className="bg-surface-100 p-2.5 rounded-xl border border-surface-300 space-y-1">
                              <span className="font-bold text-emerald-700 flex items-center gap-1">
                                <Check size={12} /> Copiado do Viajante:
                              </span>
                              <ul className="text-typography-600 space-y-0.5 list-disc list-inside">
                                <li>Temas e cânticos dos discursos</li>
                                <li>Horários padrão e dias de hospedagem</li>
                                <li>Nomes do casal e circuito</li>
                                <li>Estudos/revisitas planejados</li>
                                <li>Reuniões de pioneiros e anciãos</li>
                                <li>Dias ativos e permissões</li>
                              </ul>
                            </div>

                            <div className="bg-surface-100 p-2.5 rounded-xl border border-surface-300 space-y-1">
                              <span className="font-bold text-primary-200 flex items-center gap-1">
                                <Lock size={12} /> Mantido Intacto (Atual):
                              </span>
                              <ul className="text-typography-600 space-y-0.5 list-disc list-inside">
                                <li><strong>{schedule.congregationName}</strong> (Nome e ID)</li>
                                <li><strong>{schedule.visitPeriod}</strong> (Período atual)</li>
                                <li>Link exclusivo e PIN dos anciãos</li>
                                <li>Locais de saída de campo</li>
                                <li>Anfitriões e pastoreios locais</li>
                              </ul>
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Rodapé do Modal (Sempre visível e fixo na base) */}
                  <div className="p-3.5 sm:p-4 border-t border-surface-300 flex items-center justify-end gap-2 bg-surface-100 shrink-0">
                    <button
                      type="button"
                      onClick={() => setIsReplicateModalOpen(false)}
                      className="px-4 py-2 rounded-xl border border-surface-300 text-typography-700 hover:bg-surface-200 font-bold text-xs transition-colors cursor-pointer"
                    >
                      Cancelar
                    </button>

                    {previousSchedules.length > 0 && selectedSourceSchedule && (
                      <button
                        type="button"
                        onClick={() => executeReplication(selectedSourceSchedule)}
                        disabled={replicating}
                        className="flex items-center gap-1.5 bg-primary-200 hover:bg-primary-300 text-white px-4 py-2 rounded-xl font-bold text-xs shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                      >
                        {replicating ? (
                          <RefreshCw size={14} className="animate-spin" />
                        ) : (
                          <CheckCircle2 size={14} />
                        )}
                        {replicating ? 'Replicando...' : 'Replicar Semana Selecionada'}
                      </button>
                    )}
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </div>
  );
}
