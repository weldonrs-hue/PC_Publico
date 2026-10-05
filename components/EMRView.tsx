'use client';

import { useState, useEffect, useRef, useMemo, Fragment } from 'react';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { 
  GraduationCap, 
  ChevronLeft, 
  Calendar, 
  Clock, 
  BookOpen, 
  User, 
  Save, 
  Loader2, 
  Printer, 
  MapPin, 
  Check, 
  X, 
  Mail,
  CalendarDays,
  FileDown,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Coffee,
  Music,
  Edit3,
  CheckCircle2,
  Users,
  LayoutGrid,
  FileText,
  Search,
  Circle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '@/utils/firestore';
import { useDialog } from '@/hooks/useDialog';
import { cleanPSSMetadata, formatDocxError } from '@/lib/docxUtils';

interface EMRViewProps {
  userId: string;
  onBack: () => void;
  congregations?: any[];
  initialSchoolType?: 'ancians' | 'servants';
}

interface EMRDetails {
  data: string;
  local: string;
  endereco: string;
  anfitria: string;
  horarioInicio: string;
  horarioFim: string;
  horarioEsposas: string;
}

interface EMRPartData {
  speakers: Record<string, string>;
  congregations: Record<string, string>;
  confirmations: Record<string, boolean>;
  notes: Record<string, string>;
  details: EMRDetails;
}

export interface EMRProgramItem {
  id: string;
  num?: string;
  time?: string;
  title: string;
  duration?: string;
  sigla?: string;
  noSpeaker?: boolean;
  isInterval?: boolean;
  isSeries?: boolean;
  label?: string;
  note?: string;
  subitems?: {
    id: string;
    num: string;
    time: string;
    title: string;
    duration: string;
    sigla: string;
  }[];
}

export interface EMRProgramSession {
  period: string;
  subtitle?: string;
  items: EMRProgramItem[];
}

export interface EMRProgramConfig {
  title: string;
  modalidade: string;
  year: string;
  themeVerse: string;
  themeText: string;
  color: string;
  gradient: string;
  accentColor: string;
  sessions: EMRProgramSession[];
}

export const EMR_ANCIANS_CONFIG: EMRProgramConfig = {
  title: 'Escola do Ministério do Reino de 2027 — Anciãos',
  modalidade: 'Anciãos',
  year: '2027',
  themeVerse: '1 Timóteo 5:17',
  themeText: '“Vocês são dignos de dupla honra”',
  color: '#37616b',
  gradient: 'from-[#37616b] via-[#2c4d55] to-slate-900',
  accentColor: 'text-[#37616b]',
  sessions: [
    {
      period: 'Parte 1 (Manhã)',
      subtitle: 'Fortaleça o seu amor e cumpra seu ministério com dedicação',
      items: [
        { id: 'p1_1', time: '8:00', title: 'Cântico 101 e oração' },
        { id: 'p1_2', num: '1', time: '8:05', title: 'Bem-vindos à Escola do Ministério do Reino de 2027', duration: '15 min', sigla: 'IA/SC*' },
        { id: 'p1_3', num: '2', time: '8:20', title: 'Vocês são “dignos de dupla honra”', duration: '25 min', sigla: 'SC/A#' },
        { 
          id: 'p1_4', 
          label: 'SÉRIE DE DISCURSOS:', 
          title: 'Fortaleça o seu amor por', 
          isSeries: true,
          subitems: [
            { id: 'p1_4_1', num: '3', time: '8:45', title: 'Jeová', duration: '25 min', sigla: 'A' },
            { id: 'p1_4_2', num: '4', time: '9:10', title: 'Jesus', duration: '25 min', sigla: 'A' },
            { id: 'p1_4_3', num: '5', time: '9:35', title: 'Outros anciãos e servos ministeriais', duration: '25 min', sigla: 'A' },
            { id: 'p1_4_4', num: '6', time: '10:00', title: 'Seus irmãos e irmãs', duration: '25 min', sigla: 'A' }
          ]
        },
        { id: 'p1_5', time: '10:25', title: 'INTERVALO', duration: '15 min', noSpeaker: true, isInterval: true },
        { id: 'p1_6', num: '7', time: '10:40', title: 'Necessidades do território da nossa filial', duration: '20 min', sigla: 'IA/SC*' },
        { id: 'p1_7', num: '8', time: '11:00', title: 'Faça bom uso do Pastoreiem o Rebanho de Deus', duration: '20 min', sigla: 'SC/A#' },
        { id: 'p1_8', num: '9', time: '11:20', title: '‘Lance toda a sua ansiedade’ sobre Jeová', duration: '25 min', sigla: 'IA/SC*' },
        { id: 'p1_9', time: '11:45', title: 'Cântico 33', noSpeaker: true },
        { id: 'p1_10', time: '11:50', title: 'INTERVALO PARA O ALMOÇO', duration: '70 min', noSpeaker: true, isInterval: true }
      ]
    },
    {
      period: 'Parte 2 (Tarde)',
      subtitle: 'Seja fervoroso no espírito e cuide de suas preciosas designações',
      items: [
        { id: 'p2_1', time: '1:00', title: 'Cântico 78', noSpeaker: true },
        { 
          id: 'p2_2', 
          label: 'SÉRIE DE DISCURSOS:', 
          title: 'Seja “fervoroso no espírito”', 
          isSeries: true,
          subitems: [
            { id: 'p2_2_1', num: '10', time: '1:05', title: 'Tire mais proveito do seu estudo pessoal', duration: '20 min', sigla: 'A' },
            { id: 'p2_2_2', num: '11', time: '1:25', title: 'Faça discursos motivadores', duration: '20 min', sigla: 'A' },
            { id: 'p2_2_3', num: '12', time: '1:45', title: 'Ensine com entusiasmo', duration: '20 min', sigla: 'A' },
            { id: 'p2_2_4', num: '13', time: '2:05', title: 'Peça e aceite conselhos práticos', duration: '20 min', sigla: 'A' }
          ]
        },
        { id: 'p2_3', time: '2:25', title: 'INTERVALO', duration: '20 min', noSpeaker: true, isInterval: true },
        { id: 'p2_4', num: '14', time: '2:45', title: 'Mulheres de grande fé', duration: '35 min', sigla: 'SC/A#', note: 'Esposas convidadas a assistir' },
        { id: 'p2_5', num: '15', time: '3:20', title: 'O que Jesus vê em você?', duration: '35 min', sigla: 'IA/SC*', note: 'Esposas convidadas a assistir' },
        { id: 'p2_6', time: '3:55', title: 'Cântico 107 e oração' }
      ]
    }
  ]
};

export const EMR_SERVANTS_CONFIG: EMRProgramConfig = {
  title: 'Escola do Ministério do Reino de 2027 — Servos Ministeriais',
  modalidade: 'Servos Ministeriais',
  year: '2027',
  themeVerse: 'Atos 6:3',
  themeText: '“Homens cheios de espírito e de sabedoria”',
  color: '#4F46E5',
  gradient: 'from-indigo-900 via-indigo-950 to-slate-900',
  accentColor: 'text-indigo-600',
  sessions: [
    {
      period: 'Parte 1 (Manhã)',
      subtitle: 'Fortaleça o seu amor e cumpra suas responsabilidades espirituais',
      items: [
        { id: 's1_1', time: '8:00', title: 'Cântico 101 e oração' },
        { id: 's1_2', num: '1', time: '8:05', title: 'Bem-vindos à Escola do Ministério do Reino de 2027', duration: '15 min', sigla: 'IA/SC*' },
        { id: 's1_3', num: '2', time: '8:20', title: 'Vocês são homens “cheios de espírito e de sabedoria”', duration: '25 min', sigla: 'SC/A#' },
        { 
          id: 's1_4', 
          label: 'SÉRIE DE DISCURSOS:', 
          title: 'Fortaleça o seu amor por', 
          isSeries: true,
          subitems: [
            { id: 's1_4_1', num: '3', time: '8:45', title: 'Jeová', duration: '25 min', sigla: 'A' },
            { id: 's1_4_2', num: '4', time: '9:10', title: 'Jesus', duration: '25 min', sigla: 'A' },
            { id: 's1_4_3', num: '5', time: '9:35', title: 'Outros anciãos e servos ministeriais', duration: '25 min', sigla: 'A' },
            { id: 's1_4_4', num: '6', time: '10:00', title: 'Seus irmãos e irmãs', duration: '25 min', sigla: 'A' }
          ]
        },
        { id: 's1_5', time: '10:25', title: 'INTERVALO', duration: '15 min', noSpeaker: true, isInterval: true },
        { id: 's1_6', num: '7', time: '10:40', title: 'Cumpram suas responsabilidades como servos ministeriais', duration: '20 min', sigla: 'A' },
        { id: 's1_7', num: '8', time: '11:00', title: 'Continuem progredindo como homens espirituais', duration: '20 min', sigla: 'SC/A#' },
        { id: 's1_8', num: '9', time: '11:20', title: '‘Lance toda a sua ansiedade’ sobre Jeová', duration: '25 min', sigla: 'IA/SC*' },
        { id: 's1_9', time: '11:45', title: 'Cântico 33', noSpeaker: true },
        { id: 's1_10', time: '11:50', title: 'INTERVALO PARA O ALMOÇO', duration: '70 min', noSpeaker: true, isInterval: true }
      ]
    },
    {
      period: 'Parte 2 (Tarde)',
      subtitle: 'Seja fervoroso no espírito e continue progredindo na fé',
      items: [
        { id: 's2_1', time: '1:00', title: 'Cântico 78', noSpeaker: true },
        { 
          id: 's2_2', 
          label: 'SÉRIE DE DISCURSOS:', 
          title: 'Seja “fervoroso no espírito”', 
          isSeries: true,
          subitems: [
            { id: 's2_2_1', num: '10', time: '1:05', title: 'Tire mais proveito do seu estudo pessoal', duration: '20 min', sigla: 'A' },
            { id: 's2_2_2', num: '11', time: '1:25', title: 'Faça discursos motivadores', duration: '20 min', sigla: 'A' },
            { id: 's2_2_3', num: '12', time: '1:45', title: 'Ensine com entusiasmo', duration: '20 min', sigla: 'A' },
            { id: 's2_2_4', num: '13', time: '2:05', title: 'Peça e aceite conselhos práticos', duration: '20 min', sigla: 'A' }
          ]
        },
        { id: 's2_3', time: '2:25', title: 'INTERVALO', duration: '20 min', noSpeaker: true, isInterval: true },
        { id: 's2_4', num: '14', time: '2:45', title: 'Mulheres de grande fé', duration: '35 min', sigla: 'SC/A#', note: 'Esposas convidadas a assistir' },
        { id: 's2_5', num: '15', time: '3:20', title: 'O que Jesus vê em você?', duration: '35 min', sigla: 'IA/SC*', note: 'Esposas convidadas a assistir' },
        { id: 's2_6', time: '3:55', title: 'Cântico 107 e oração' }
      ]
    }
  ]
};

const createEmptyTurmas = (): Record<number, EMRPartData> => ({
  0: { speakers: {}, congregations: {}, confirmations: {}, notes: {}, details: { data: '', local: '', endereco: '', anfitria: '', horarioInicio: '08:00', horarioFim: '16:00', horarioEsposas: '14:45 às 16:00' } },
  1: { speakers: {}, congregations: {}, confirmations: {}, notes: {}, details: { data: '', local: '', endereco: '', anfitria: '', horarioInicio: '08:00', horarioFim: '16:00', horarioEsposas: '14:45 às 16:00' } },
  2: { speakers: {}, congregations: {}, confirmations: {}, notes: {}, details: { data: '', local: '', endereco: '', anfitria: '', horarioInicio: '08:00', horarioFim: '16:00', horarioEsposas: '14:45 às 16:00' } },
});

export default function EMRView({ 
  userId, 
  onBack, 
  congregations = [],
  initialSchoolType = 'ancians'
}: EMRViewProps) {
  const { showAlert } = useDialog();
  const [selectedSchoolType, setSelectedSchoolType] = useState<'ancians' | 'servants'>(initialSchoolType);
  const [selectedTurma, setSelectedTurma] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [personalData, setPersonalData] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState<string | null>(null);

  // View mode: 'responsive' | 'a4'
  const [viewMode, setViewMode] = useState<'responsive' | 'a4'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('progcir_emr_view_mode') as 'responsive' | 'a4';
      if (saved === 'responsive' || saved === 'a4') return saved;
      return window.innerWidth < 1024 ? 'responsive' : 'a4';
    }
    return 'responsive';
  });

  const handleViewModeChange = (mode: 'responsive' | 'a4') => {
    setViewMode(mode);
    try {
      localStorage.setItem('progcir_emr_view_mode', mode);
    } catch {}
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [activeSessionTab, setActiveSessionTab] = useState<number>(-1);

  // Zoom state
  const [zoom, setZoom] = useState<number>(100);
  const containerRef = useRef<HTMLDivElement>(null);

  // Data sets for both schools
  const [anciansParts, setAnciansParts] = useState<Record<number, EMRPartData>>(createEmptyTurmas());
  const [servantsParts, setServantsParts] = useState<Record<number, EMRPartData>>(createEmptyTurmas());
  
  const [initialAnciansParts, setInitialAnciansParts] = useState<string>('');
  const [initialServantsParts, setInitialServantsParts] = useState<string>('');

  const currentConfig = selectedSchoolType === 'ancians' ? EMR_ANCIANS_CONFIG : EMR_SERVANTS_CONFIG;
  const currentParts = selectedSchoolType === 'ancians' ? anciansParts : servantsParts;
  const initialCurrentParts = selectedSchoolType === 'ancians' ? initialAnciansParts : initialServantsParts;

  const hasChanges = initialCurrentParts !== JSON.stringify(currentParts);

  const currentTurmaData = currentParts[selectedTurma] || createEmptyTurmas()[0];
  const speakers = currentTurmaData.speakers || {};
  const speakerCongs = currentTurmaData.congregations || {};
  const confirmations = currentTurmaData.confirmations || {};
  const details = currentTurmaData.details || { data: '', local: '', endereco: '', anfitria: '', horarioInicio: '08:00', horarioFim: '16:00', horarioEsposas: '14:45 às 16:00' };

  // Estatísticas de preenchimento para o painel responsivo
  const stats = useMemo(() => {
    let totalWithSpeaker = 0;
    let assignedCount = 0;
    let confirmedCount = 0;

    currentConfig.sessions.forEach(session => {
      session.items.forEach(item => {
        if (item.subitems && item.subitems.length > 0) {
          item.subitems.forEach(sub => {
            totalWithSpeaker++;
            if (speakers[sub.id]?.trim()) assignedCount++;
            if (confirmations[sub.id]) confirmedCount++;
          });
        } else if (!item.noSpeaker && !item.isInterval) {
          totalWithSpeaker++;
          if (speakers[item.id]?.trim()) assignedCount++;
          if (confirmations[item.id]) confirmedCount++;
        }
      });
    });

    const percentageAssigned = totalWithSpeaker > 0 ? Math.round((assignedCount / totalWithSpeaker) * 100) : 0;
    return { totalWithSpeaker, assignedCount, confirmedCount, percentageAssigned };
  }, [currentConfig, speakers, confirmations]);

  // Fit to screen helper
  const handleFitToScreen = () => {
    if (!containerRef.current) return;
    const containerWidth = containerRef.current.clientWidth - 48;
    const a4WidthPx = (210 * 96) / 25.4;
    const newZoom = Math.min(150, Math.max(40, Math.round((containerWidth / a4WidthPx) * 100)));
    setZoom(newZoom);
  };

  // Load data for both Anciãos and Servos
  useEffect(() => {
    let isMounted = true;
    const loadAll = async () => {
      setLoading(true);
      try {
        const docRefAncians = doc(db, 'emr_ancians_data', userId);
        const snapAncians = await getDoc(docRefAncians);
        if (snapAncians.exists() && isMounted) {
          const data = snapAncians.data();
          if (data.parts) {
            setAnciansParts(data.parts);
            setInitialAnciansParts(JSON.stringify(data.parts));
          } else {
            setInitialAnciansParts(JSON.stringify(createEmptyTurmas()));
          }
        } else if (isMounted) {
          setInitialAnciansParts(JSON.stringify(createEmptyTurmas()));
        }

        const docRefServants = doc(db, 'emr_servants_data', userId);
        const snapServants = await getDoc(docRefServants);
        if (snapServants.exists() && isMounted) {
          const data = snapServants.data();
          if (data.parts) {
            setServantsParts(data.parts);
            setInitialServantsParts(JSON.stringify(data.parts));
          } else {
            setInitialServantsParts(JSON.stringify(createEmptyTurmas()));
          }
        } else if (isMounted) {
          setInitialServantsParts(JSON.stringify(createEmptyTurmas()));
        }

        const personalSnap = await getDoc(doc(db, 'personal_data', userId));
        if (personalSnap.exists() && isMounted) {
          setPersonalData(personalSnap.data());
        }
      } catch (err) {
        console.error('Error loading EMR data:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadAll();
    return () => { isMounted = false; };
  }, [userId]);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setZoom(75);
    } else {
      setZoom(95);
    }
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (selectedSchoolType === 'ancians') {
        await setDoc(doc(db, 'emr_ancians_data', userId), {
          parts: anciansParts,
          updatedAt: new Date().toISOString()
        }, { merge: true });
        setInitialAnciansParts(JSON.stringify(anciansParts));
      } else {
        await setDoc(doc(db, 'emr_servants_data', userId), {
          parts: servantsParts,
          updatedAt: new Date().toISOString()
        }, { merge: true });
        setInitialServantsParts(JSON.stringify(servantsParts));
      }
      await showAlert(`Programação de ${currentConfig.modalidade} salva com sucesso!`, 'Sucesso');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, selectedSchoolType === 'ancians' ? 'emr_ancians_data' : 'emr_servants_data');
    } finally {
      setIsSaving(false);
    }
  };

  const updateSpeaker = (itemId: string, name: string) => {
    const setter = selectedSchoolType === 'ancians' ? setAnciansParts : setServantsParts;
    setter(prev => ({
      ...prev,
      [selectedTurma]: {
        ...prev[selectedTurma],
        speakers: {
          ...prev[selectedTurma].speakers,
          [itemId]: name
        }
      }
    }));
  };

  const updateSpeakerCongregation = (itemId: string, cong: string) => {
    const setter = selectedSchoolType === 'ancians' ? setAnciansParts : setServantsParts;
    setter(prev => ({
      ...prev,
      [selectedTurma]: {
        ...prev[selectedTurma],
        congregations: {
          ...(prev[selectedTurma].congregations || {}),
          [itemId]: cong
        }
      }
    }));
  };

  const toggleConfirmation = (itemId: string) => {
    const setter = selectedSchoolType === 'ancians' ? setAnciansParts : setServantsParts;
    setter(prev => ({
      ...prev,
      [selectedTurma]: {
        ...prev[selectedTurma],
        confirmations: {
          ...prev[selectedTurma].confirmations,
          [itemId]: !prev[selectedTurma].confirmations?.[itemId]
        }
      }
    }));
  };

  const updateDetail = (field: keyof EMRDetails, value: string) => {
    const setter = selectedSchoolType === 'ancians' ? setAnciansParts : setServantsParts;
    setter(prev => ({
      ...prev,
      [selectedTurma]: {
        ...prev[selectedTurma],
        details: {
          ...prev[selectedTurma].details,
          [field]: value
        }
      }
    }));
  };

  const generateLetter = async (partId: string) => {
    setIsGenerating(partId);
    try {
      const templateId = 'emr_instrutor';
      const privateId = `${userId}_${templateId}`;
      let templateSnap = await getDoc(doc(db, 'document_templates', privateId));
      if (!templateSnap.exists()) {
        templateSnap = await getDoc(doc(db, 'document_templates', templateId));
      }

      if (!templateSnap.exists()) {
        await showAlert('Modelo "Carta ao Instrutor" não encontrado. Configure-o em Cartas > EMR.', 'Erro');
        return;
      }

      const templateData = templateSnap.data();
      const binaryString = window.atob(templateData.content);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const now = new Date();
      const hoje = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }).format(now);
      
      const travelerName = personalData?.nome || '________________';
      const circuit = personalData?.circuito || '________________';
      const telefoneCircuito = personalData?.telefoneCircuito || personalData?.telefone || '________________';
      const emailCircuito = personalData?.email || '________________';
      const signatureImage = personalData?.signatureImage || '';
      const hasImage = Boolean(signatureImage && typeof signatureImage === 'string' && signatureImage.startsWith('data:image'));
      const signatureText = `${travelerName} (${circuit})`;
      const signatureValue = hasImage ? signatureImage : signatureText;

      const speakerName = speakers[partId] || '________________';
      const speakerCongregation = speakerCongs[partId] || '________________';
      
      let partTheme = '________________';
      let partNum = '';
      let partTime = '________________';
      let partDuration = '________________';

      currentConfig.sessions.forEach(s => {
        s.items.forEach(item => {
          if (item.id === partId) {
            partTheme = item.title;
            partNum = item.num || '';
            partTime = item.time || '________________';
            partDuration = item.duration || '________________';
          }
          if (item.subitems) {
            item.subitems.forEach(sub => {
              if (sub.id === partId) {
                partTheme = `${item.label || 'Série de discursos:'} ${item.title} — ${sub.title}`;
                partNum = sub.num || '';
                partTime = sub.time || '________________';
                partDuration = sub.duration || '________________';
              }
            });
          }
        });
      });

      const replacements = {
        'TURMA': `Turma ${selectedTurma + 1}`,
        'MODALIDADE': currentConfig.modalidade,
        'ESCOLA': currentConfig.title,
        'DATA': details.data || hoje,
        'LOCAL': details.local || '________________',
        'ENDERECO': details.endereco || '________________',
        'ENDEREÇO': details.endereco || '________________',
        'ANFITRIA': details.anfitria || '________________',
        'HORARIO_INICIO': details.horarioInicio || '________________',
        'HORARIO_FIM': details.horarioFim || '________________',
        'HORARIO_ESPOSAS': details.horarioEsposas || '________________',
        'HORARIO': `${details.horarioInicio || '08:00'} às ${details.horarioFim || '16:00'}`,
        'ORADOR': speakerCongregation && speakerCongregation !== '________________' ? `${speakerName} — ${speakerCongregation}` : speakerName,
        'INSTRUTOR': speakerCongregation && speakerCongregation !== '________________' ? `${speakerName} — ${speakerCongregation}` : speakerName,
        'CONGREGACAO': speakerCongregation,
        'CONGREGAÇÃO': speakerCongregation,
        'CONGREGACAO_INSTRUTOR': speakerCongregation,
        'TEMA': partTheme,
        'TITULO': partTheme,
        'DESIGNACAO': partTheme,
        'DESIGNAÇÃO': partTheme,
        'NUMERO': partNum,
        'N': partNum,
        'HORA': partTime,
        'DURACAO': partDuration,
        'TEMPO': partDuration,
        'TEMA_DISCURSO': partTheme,
        'NUMERO_DISCURSO': partNum,
        'HORARIO_DISCURSO': partTime,
        'DURACAO_DISCURSO': partDuration,
        'HOJE': hoje,
        'ANO': currentConfig.year,
        'VIAJANTE': travelerName,
        'viajante': travelerName,
        'CIRCUITO': circuit,
        'circuito': circuit,
        'TELEFONE': telefoneCircuito,
        'EMAIL': emailCircuito,
        'ASSINATURA': signatureValue,
        'assinatura': signatureValue,
        'ASSINATURA_GLOBAL': signatureValue,
        'assinatura_global': signatureValue,
        '%ASSINATURA': hasImage ? signatureValue : '',
        '%assinatura': hasImage ? signatureValue : '',
      };

      const signatureScale = personalData?.signatureSize || 60;
      let sigHeight = signatureScale;
      let sigWidth = sigHeight * 2.5;

      if (hasImage) {
        try {
          const img = new window.Image();
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = signatureImage;
          });
          const aspectRatio = img.width / img.height;
          sigHeight = signatureScale;
          sigWidth = sigHeight * aspectRatio;
          if (sigWidth > 350) {
            sigWidth = 350;
            sigHeight = sigWidth / aspectRatio;
          }
        } catch (e) {
          console.warn('Could not determine signature dimensions:', e);
        }
      }

      const imgOpts: any = {
        centered: false,
        getImage: (tagValue: string) => {
          if (!tagValue || typeof tagValue !== 'string' || !tagValue.startsWith('data:image')) return null;
          try {
            const base64Data = tagValue.split(',')[1];
            if (!base64Data) return null;
            const binaryStringArray = window.atob(base64Data);
            const len = binaryStringArray.length;
            const bytesArray = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
              bytesArray[i] = binaryStringArray.charCodeAt(i);
            }
            return bytesArray.buffer;
          } catch (e) {
            console.error('Error decoding image:', e);
            return null;
          }
        },
        getSize: () => [sigWidth, sigHeight],
      };

      const cleanedBuffer = cleanPSSMetadata(bytes.buffer);
      const zip = new PizZip(cleanedBuffer);
      
      const xmlFiles = zip.file(/word\/(document|header\d+|footer\d+)\.xml/);
      xmlFiles.forEach(xmlResource => {
        let xmlContent = xmlResource.asText();
        
        const requiredNamespaces = [
          { prefix: 'xmlns:wp=', value: 'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"' },
          { prefix: 'xmlns:wps=', value: 'xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"' },
          { prefix: 'xmlns:wpc=', value: 'xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas"' },
          { prefix: 'xmlns:wpg=', value: 'xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup"' },
          { prefix: 'xmlns:v=', value: 'xmlns:v="urn:schemas-microsoft-com:vml"' },
          { prefix: 'xmlns:o=', value: 'xmlns:o="urn:schemas-microsoft-com:office:office"' },
          { prefix: 'xmlns:a=', value: 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"' },
          { prefix: 'xmlns:pic=', value: 'xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"' }
        ];

        xmlContent = xmlContent.replace(/(<w:(?:document|hdr|ftr)[^>]*)/, (match) => {
          let newMatch = match;
          requiredNamespaces.forEach(ns => {
            if (!newMatch.includes(ns.prefix)) {
              newMatch += ` ${ns.value}`;
            }
          });
          return newMatch;
        });

        xmlContent = xmlContent.replace(/<w:proofErr w:type="(?:spell|gram)(?:Start|End)"\/>/g, "");
        xmlContent = xmlContent.replace(/<w:noProof\/>/g, "");

        for (let i = 0; i < 6; i++) {
          xmlContent = xmlContent.replace(/(@|\[[#\/^>?]?)([A-Za-z0-9À-ÿ\u00C0-\u00FF\_]*)(<\/w:t>(?:<(?!w:p|w:tr|w:tbl|w:br|w:tc|w:tr)[^>]+>)*?<w:t[^>]*>)([A-Za-z0-9À-ÿ\u00C0-\u00FF\_]+|\])/g, "$1$2$4$3");
        }

        xmlContent = xmlContent.replace(/(<w:t[^>]*>)(.*?)(<\/w:t>)/g, (match: string, opening: string, text: string, closing: string) => {
          let newText = text;
          const sigRegex = /@Assinatura(?:[\s\_]Global)?|\[%?ASSINATURA(?:[\s\_]Global)?\]/gi;
          if (hasImage) {
            newText = newText.replace(sigRegex, '[%ASSINATURA]');
          } else {
            newText = newText.replace(sigRegex, '[ASSINATURA]');
          }
          newText = newText.replace(/(^|[\s\W])@([A-Za-z0-9À-ÿ\_]+)/g, (m: string, p1: string, p2: string) => {
            const tagName = p2.toUpperCase();
            if (tagName === 'ASSINATURA') return m;
            return `${p1}[${tagName}]`;
          });
          return `${opening}${newText}${closing}`;
        });
        zip.file(xmlResource.name, xmlContent);
      });

      const ImageModule = (await import('docxtemplater-image-module-free')).default;
      const docInstance = new Docxtemplater(zip, {
        modules: hasImage && ImageModule ? [new ImageModule(imgOpts)] : [],
        delimiters: { start: '[', end: ']' },
        paragraphLoop: true,
        linebreaks: true,
        nullGetter: () => ''
      });

      docInstance.render(replacements);
      const out = docInstance.getZip().generate({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
      
      const url = window.URL.createObjectURL(out);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Carta_Instrutor_${speakerName.replace(/\s+/g, '_')}_EMR.docx`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error('Error generating letter:', error);
      await showAlert('Erro ao gerar carta: ' + formatDocxError(error), 'Erro');
    } finally {
      setIsGenerating(null);
    }
  };

  const generateGeneralLetter = async (templateId: string) => {
    setIsGenerating(templateId);
    try {
      const privateId = `${userId}_${templateId}`;
      let templateSnap = await getDoc(doc(db, 'document_templates', privateId));
      if (!templateSnap.exists()) {
        templateSnap = await getDoc(doc(db, 'document_templates', templateId));
      }

      if (!templateSnap.exists()) {
        const name = templateId === 'emr_anfitria' ? 'Carta às congregações Anfitriãs' : 'Carta convite';
        await showAlert(`Modelo "${name}" não encontrado. Configure-o em Cartas > EMR.`, 'Erro');
        return;
      }

      const templateData = templateSnap.data();
      const binaryString = window.atob(templateData.content);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const now = new Date();
      const hoje = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }).format(now);
      
      const travelerName = personalData?.nome || '________________';
      const circuit = personalData?.circuito || '________________';
      const telefoneCircuito = personalData?.telefoneCircuito || personalData?.telefone || '________________';
      const emailCircuito = personalData?.email || '________________';
      const signatureImage = personalData?.signatureImage || '';
      const hasImage = Boolean(signatureImage && typeof signatureImage === 'string' && signatureImage.startsWith('data:image'));
      const signatureText = `${travelerName} (${circuit})`;
      const signatureValue = hasImage ? signatureImage : signatureText;

      const instrutor1 = (speakers['p1_2'] || speakers['s1_2'] || '');
      const instrutor2 = (speakers['p1_3'] || speakers['s1_3'] || '');
      const cong1 = (speakerCongs['p1_2'] || speakerCongs['s1_2'] || '');
      const cong2 = (speakerCongs['p1_3'] || speakerCongs['s1_3'] || '');
      
      const allSpeakersList = Object.values(speakers).filter(Boolean) as string[];
      const uniqueSpeakersWithCong = Array.from(new Set(Object.keys(speakers).filter(k => speakers[k]).map(k => {
        const s = speakers[k];
        const c = speakerCongs[k];
        return c ? `${s} — ${c}` : s;
      })));

      const uniqueSpeakers = Array.from(new Set(allSpeakersList));
      const instrutoresLista = uniqueSpeakersWithCong.length > 0
        ? uniqueSpeakersWithCong.join(', ')
        : (instrutor1 && instrutor2 ? `${instrutor1}${cong1 ? ` — ${cong1}` : ''} e ${instrutor2}${cong2 ? ` — ${cong2}` : ''}` : (instrutor1 || instrutor2 || '________________'));

      const replacements = {
        'TURMA': `Turma ${selectedTurma + 1}`,
        'MODALIDADE': currentConfig.modalidade,
        'ESCOLA': currentConfig.title,
        'TIPO_ESCOLA': currentConfig.modalidade,
        'DATA': details.data || hoje,
        'DATA_ESCOLA': details.data || hoje,
        'DATA_TURMA': details.data || hoje,
        'LOCAL': details.local || '________________',
        'LOCAL_ESCOLA': details.local || '________________',
        'ENDERECO': details.endereco || '________________',
        'ENDEREÇO': details.endereco || '________________',
        'ANFITRIA': details.anfitria || '________________',
        'CONGREGACAO_ANFITRIA': details.anfitria || '________________',
        'HORARIO_INICIO': details.horarioInicio || '________________',
        'HORARIO_FIM': details.horarioFim || '________________',
        'HORARIO_FINAL': details.horarioFim || '________________',
        'HORARIO_ESPOSAS': details.horarioEsposas || '________________',
        'HORARIO': `${details.horarioInicio || '08:00'} às ${details.horarioFim || '16:00'}`,
        'HORARIOS': `${details.horarioInicio || '08:00'} às ${details.horarioFim || '16:00'}`,
        'INSTRUTORES': instrutoresLista,
        'INSTRUTOR1': instrutor1 ? (cong1 ? `${instrutor1} — ${cong1}` : instrutor1) : '________________',
        'INSTRUTOR2': instrutor2 ? (cong2 ? `${instrutor2} — ${cong2}` : instrutor2) : '________________',
        'HOJE': hoje,
        'ANO': currentConfig.year,
        'VIAJANTE': travelerName,
        'viajante': travelerName,
        'CIRCUITO': circuit,
        'circuito': circuit,
        'TELEFONE': telefoneCircuito,
        'EMAIL': emailCircuito,
        'ASSINATURA': signatureValue,
        'assinatura': signatureValue,
        'ASSINATURA_GLOBAL': signatureValue,
        'assinatura_global': signatureValue,
        '%ASSINATURA': hasImage ? signatureValue : '',
        '%assinatura': hasImage ? signatureValue : '',
      };

      const signatureScale = personalData?.signatureSize || 60;
      let sigHeight = signatureScale;
      let sigWidth = sigHeight * 2.5;

      if (hasImage) {
        try {
          const img = new window.Image();
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = signatureImage;
          });
          const aspectRatio = img.width / img.height;
          sigHeight = signatureScale;
          sigWidth = sigHeight * aspectRatio;
          if (sigWidth > 350) {
            sigWidth = 350;
            sigHeight = sigWidth / aspectRatio;
          }
        } catch (e) {
          console.warn('Could not determine signature dimensions:', e);
        }
      }

      const imgOpts: any = {
        centered: false,
        getImage: (tagValue: string) => {
          if (!tagValue || typeof tagValue !== 'string' || !tagValue.startsWith('data:image')) return null;
          try {
            const base64Data = tagValue.split(',')[1];
            if (!base64Data) return null;
            const binaryStringArray = window.atob(base64Data);
            const len = binaryStringArray.length;
            const bytesArray = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
              bytesArray[i] = binaryStringArray.charCodeAt(i);
            }
            return bytesArray.buffer;
          } catch (e) {
            console.error('Error decoding image:', e);
            return null;
          }
        },
        getSize: () => [sigWidth, sigHeight],
      };

      const cleanedBuffer = cleanPSSMetadata(bytes.buffer);
      const zip = new PizZip(cleanedBuffer);
      
      const xmlFiles = zip.file(/word\/(document|header\d+|footer\d+)\.xml/);
      xmlFiles.forEach(xmlResource => {
        let xmlContent = xmlResource.asText();
        
        const requiredNamespaces = [
          { prefix: 'xmlns:wp=', value: 'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"' },
          { prefix: 'xmlns:wps=', value: 'xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"' },
          { prefix: 'xmlns:wpc=', value: 'xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas"' },
          { prefix: 'xmlns:wpg=', value: 'xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup"' },
          { prefix: 'xmlns:v=', value: 'xmlns:v="urn:schemas-microsoft-com:vml"' },
          { prefix: 'xmlns:o=', value: 'xmlns:o="urn:schemas-microsoft-com:office:office"' },
          { prefix: 'xmlns:a=', value: 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"' },
          { prefix: 'xmlns:pic=', value: 'xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"' }
        ];

        xmlContent = xmlContent.replace(/(<w:(?:document|hdr|ftr)[^>]*)/, (match) => {
          let newMatch = match;
          requiredNamespaces.forEach(ns => {
            if (!newMatch.includes(ns.prefix)) {
              newMatch += ` ${ns.value}`;
            }
          });
          return newMatch;
        });

        xmlContent = xmlContent.replace(/<w:proofErr w:type="(?:spell|gram)(?:Start|End)"\/>/g, "");
        xmlContent = xmlContent.replace(/<w:noProof\/>/g, "");

        for (let i = 0; i < 6; i++) {
          xmlContent = xmlContent.replace(/(@|\[[#\/^>?]?)([A-Za-z0-9À-ÿ\u00C0-\u00FF\_]*)(<\/w:t>(?:<(?!w:p|w:tr|w:tbl|w:br|w:tc|w:tr)[^>]+>)*?<w:t[^>]*>)([A-Za-z0-9À-ÿ\u00C0-\u00FF\_]+|\])/g, "$1$2$4$3");
        }

        xmlContent = xmlContent.replace(/(<w:t[^>]*>)(.*?)(<\/w:t>)/g, (match: string, opening: string, text: string, closing: string) => {
          let newText = text;
          const sigRegex = /@Assinatura(?:[\s\_]Global)?|\[%?ASSINATURA(?:[\s\_]Global)?\]/gi;
          if (hasImage) {
            newText = newText.replace(sigRegex, '[%ASSINATURA]');
          } else {
            newText = newText.replace(sigRegex, '[ASSINATURA]');
          }
          newText = newText.replace(/(^|[\s\W])@([A-Za-z0-9À-ÿ\_]+)/g, (m: string, p1: string, p2: string) => {
            const tagName = p2.toUpperCase();
            if (tagName === 'ASSINATURA') return m;
            return `${p1}[${tagName}]`;
          });
          return `${opening}${newText}${closing}`;
        });
        zip.file(xmlResource.name, xmlContent);
      });

      const ImageModule = (await import('docxtemplater-image-module-free')).default;
      const docInstance = new Docxtemplater(zip, {
        modules: hasImage && ImageModule ? [new ImageModule(imgOpts)] : [],
        delimiters: { start: '[', end: ']' },
        paragraphLoop: true,
        linebreaks: true,
        nullGetter: () => ''
      });

      docInstance.render(replacements);
      const out = docInstance.getZip().generate({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
      
      const url = window.URL.createObjectURL(out);
      const a = document.createElement('a');
      const name = templateId === 'emr_anfitria' ? 'Carta_Anfitria' : 'Carta_Convite';
      a.href = url;
      a.download = `${name}_Turma_${selectedTurma + 1}_${currentConfig.modalidade.replace(/\s+/g, '_')}.docx`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error('Error generating letter:', error);
      await showAlert('Erro ao gerar carta: ' + formatDocxError(error), 'Erro');
    } finally {
      setIsGenerating(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 space-y-4">
        <Loader2 className="w-12 h-12 text-[#37616b] animate-spin" />
        <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">Carregando Programação EMR...</p>
      </div>
    );
  }

  return (
    <div id="emr-meeting-print-content" className="space-y-6 pb-16 print:p-0 print:m-0 print:space-y-0">
      <style jsx global>{`
        @media screen {
          .print-only {
            display: none !important;
          }
        }

        @media print {
          @page { 
            size: A4 portrait; 
            margin: 0; 
          }
          
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            width: 210mm !important;
            height: auto !important;
            background: #ffffff !important;
          }

          body * { 
            visibility: hidden; 
          }
          
          #emr-meeting-print-content,
          #emr-meeting-print-content * { 
            visibility: visible !important; 
          }
          
          #emr-meeting-print-content {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 210mm !important;
            max-width: 210mm !important;
            margin: 0 !important;
            padding: 0 !important;
            display: block !important;
          }
          
          .emr-viewport,
          .emr-session-wrapper,
          .emr-scale-wrapper {
            margin: 0 !important;
            padding: 0 !important;
            gap: 0 !important;
            height: auto !important;
            min-height: 0 !important;
            max-height: none !important;
            width: 210mm !important;
            min-width: 210mm !important;
            max-width: 210mm !important;
            border: none !important;
            background: transparent !important;
            box-shadow: none !important;
            display: block !important;
            position: static !important;
            overflow: visible !important;
            transform: none !important;
          }

          .emr-a4-page { 
            position: relative !important; 
            top: 0 !important; 
            left: 0 !important; 
            width: 210mm !important; 
            min-width: 210mm !important; 
            max-width: 210mm !important; 
            height: 297mm !important; 
            min-height: 297mm !important; 
            max-height: 297mm !important; 
            display: flex !important; 
            flex-direction: column !important; 
            justify-content: space-between !important; 
            background: #ffffff !important; 
            color: #111827 !important; 
            padding: 8mm 10mm !important; 
            margin: 0 auto !important; 
            border: none !important; 
            box-shadow: none !important; 
            transform: none !important; 
            zoom: 1 !important; 
            overflow: hidden !important; 
            box-sizing: border-box !important; 
            page-break-inside: avoid !important; 
            break-inside: avoid !important; 
            page-break-after: always !important; 
            break-after: page !important; 
          }

          .emr-session-wrapper:last-child .emr-a4-page,
          .emr-a4-page:last-child,
          .emr-a4-page:last-of-type {
            page-break-after: avoid !important;
            break-after: avoid !important;
          }
          
          .no-print,
          .no-print * { 
            display: none !important; 
            visibility: hidden !important; 
          }
          
          body {
            background: #ffffff !important;
            color: #111827 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            font-family: var(--font-sans, "Inter"), system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
          }

          .emr-a4-page input {
            border: none !important;
            background: transparent !important;
            padding: 0 !important;
            margin: 0 !important;
            color: #111827 !important;
            max-width: 100% !important;
            line-height: 1.25 !important;
            height: auto !important;
          }
          .emr-a4-page input::placeholder {
            color: transparent !important;
          }
        }
      `}</style>

      {/* Screen Header & Top Controls (no-print) */}
      <div className="space-y-3 no-print">
        {/* Top bar: Back, Title & Action Bar */}
        <div className="flex items-center justify-between gap-3 bg-surface-100 p-3 sm:p-4 rounded-3xl border border-surface-300 shadow-xs flex-wrap">
          <div className="flex items-center gap-3">
            <button 
              onClick={onBack} 
              className="p-2 sm:p-2.5 hover:bg-surface-200 rounded-full transition-all text-primary-200 bg-primary-200/10 shadow-xs border border-primary-200/20 cursor-pointer active:scale-95 shrink-0"
              title="Voltar às Escolas"
            >
              <ChevronLeft size={20} strokeWidth={2.5} />
            </button>
            <div className="flex flex-col min-w-0">
              <h2 className="text-base sm:text-lg font-black text-typography-900 leading-tight truncate flex items-center gap-2">
                <GraduationCap className="text-primary-200 shrink-0" size={20} />
                <span>Escola do Ministério do Reino</span>
              </h2>
              <p className="text-[11px] sm:text-xs font-medium text-typography-500 truncate hidden sm:block">
                Temporada {currentConfig.year} • {currentConfig.modalidade}
              </p>
            </div>
          </div>

          {/* Action Bar */}
          <div className="flex items-center gap-1.5 sm:gap-2 ml-auto flex-wrap">
            {/* Toggle de Modo: Painel Responsivo vs Folha A4 */}
            <div className="flex items-center bg-surface-200/80 p-0.5 rounded-xl border border-surface-300 shadow-2xs">
              <button
                onClick={() => handleViewModeChange('responsive')}
                className={`h-8 sm:h-9 px-3 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  viewMode === 'responsive'
                    ? 'bg-primary-200 text-white shadow-xs'
                    : 'text-typography-600 hover:text-typography-900'
                }`}
                title="Visualização responsiva otimizada para celular e computador"
              >
                <LayoutGrid size={14} />
                <span>Painel</span>
              </button>
              <button
                onClick={() => handleViewModeChange('a4')}
                className={`h-8 sm:h-9 px-3 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  viewMode === 'a4'
                    ? 'bg-primary-200 text-white shadow-xs'
                    : 'text-typography-600 hover:text-typography-900'
                }`}
                title="Folha oficial A4 com zoom e prévia de impressão"
              >
                <FileText size={14} />
                <span>Folha A4</span>
              </button>
            </div>

            {/* Salvar */}
            <button
              onClick={handleSave}
              disabled={isSaving}
              className={`h-8 sm:h-9 px-3 sm:px-4 rounded-xl text-xs font-bold shadow-xs flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50 ${
                hasChanges 
                  ? 'bg-primary-200 hover:bg-primary-150 text-white animate-pulse' 
                  : 'bg-surface-200 hover:bg-surface-300 text-typography-700 border border-surface-300'
              }`}
              title="Salvar alterações no banco de dados"
            >
              {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              <span>{isSaving ? 'Salvando...' : 'Salvar'}</span>
            </button>

            {/* Dados da Escola */}
            <button 
              onClick={() => setShowDetailsModal(true)}
              className="h-8 sm:h-9 px-2.5 sm:px-3 rounded-xl text-xs font-bold text-amber-800 dark:text-amber-300 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 shadow-xs flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] cursor-pointer"
              title="Editar dados da escola (data, local, anfitriã, horários)"
            >
              <CalendarDays size={14} className="shrink-0 text-amber-600 dark:text-amber-400" />
              <span className="hidden md:inline">Dados da Turma</span>
            </button>

            {/* Carta Anfitriã */}
            <button 
              onClick={() => generateGeneralLetter('emr_anfitria')}
              disabled={isGenerating === 'emr_anfitria'}
              className="h-8 sm:h-9 px-2.5 sm:px-3 rounded-xl text-xs font-bold text-sky-800 dark:text-sky-300 bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 shadow-xs flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50"
              title="Gerar Carta às Congregações Anfitriãs"
            >
              {isGenerating === 'emr_anfitria' ? <Loader2 size={14} className="animate-spin text-sky-600" /> : <Mail size={14} className="shrink-0 text-sky-600 dark:text-sky-400" />}
              <span className="hidden sm:inline">Carta Anfitriã</span>
            </button>

            {/* Carta Convite */}
            <button 
              onClick={() => generateGeneralLetter('emr_convite')}
              disabled={isGenerating === 'emr_convite'}
              className="h-8 sm:h-9 px-2.5 sm:px-3.5 rounded-xl text-xs font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 shadow-xs flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50"
              title="Gerar Carta Convite para os Alunos"
            >
              {isGenerating === 'emr_convite' ? <Loader2 size={14} className="animate-spin text-emerald-600" /> : <Mail size={14} className="shrink-0 text-emerald-600 dark:text-emerald-400" />}
              <span className="hidden sm:inline">Carta Convite</span>
            </button>

            {/* Imprimir A4 */}
            <button 
              onClick={() => window.print()} 
              className="h-8 sm:h-9 px-2.5 sm:px-3 rounded-xl text-xs font-bold text-typography-700 bg-surface-200 hover:bg-surface-300 border border-surface-300 shadow-xs flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] cursor-pointer"
              title="Imprimir folha A4 em modo Retrato"
            >
              <Printer size={14} className="shrink-0 text-typography-500" />
              <span className="hidden md:inline">Imprimir A4</span>
            </button>
          </div>
        </div>

        {/* Compact Navigation Bar: Modalidade & Turmas Selector */}
        <div className="flex items-center justify-between gap-2 p-1.5 bg-surface-100 rounded-2xl border border-surface-300 shadow-2xs flex-wrap">
          {/* Seletor de Modalidade (Anciãos vs Servos) */}
          <div className="flex items-center gap-1 bg-surface-200/60 p-0.5 rounded-xl border border-surface-300 shadow-2xs shrink-0">
            <button
              onClick={() => setSelectedSchoolType('ancians')}
              className={`h-8 sm:h-9 px-3 sm:px-4 rounded-lg text-xs transition-all whitespace-nowrap active:scale-[0.98] flex items-center gap-1.5 cursor-pointer ${
                selectedSchoolType === 'ancians'
                  ? 'bg-[#37616b] text-white shadow-xs font-bold'
                  : 'text-typography-600 hover:text-typography-900 hover:bg-surface-200 font-medium'
              }`}
            >
              <User size={13} />
              <span>Anciãos</span>
            </button>
            <button
              onClick={() => setSelectedSchoolType('servants')}
              className={`h-8 sm:h-9 px-3 sm:px-4 rounded-lg text-xs transition-all whitespace-nowrap active:scale-[0.98] flex items-center gap-1.5 cursor-pointer ${
                selectedSchoolType === 'servants'
                  ? 'bg-indigo-600 text-white shadow-xs font-bold'
                  : 'text-typography-600 hover:text-typography-900 hover:bg-surface-200 font-medium'
              }`}
            >
              <Users size={13} />
              <span>Servos Ministeriais</span>
            </button>
          </div>

          {/* Seletor de Turmas (1, 2, 3) */}
          <div className="flex items-center gap-1 bg-surface-200/60 p-0.5 rounded-xl border border-surface-300 shadow-2xs shrink-0 ml-auto">
            {[0, 1, 2].map((turma) => {
              const isActive = selectedTurma === turma;
              return (
                <button
                  key={turma}
                  onClick={() => setSelectedTurma(turma)}
                  className={`h-8 sm:h-9 px-2.5 sm:px-3.5 rounded-lg text-xs transition-all whitespace-nowrap active:scale-[0.98] flex items-center justify-center cursor-pointer ${
                    isActive 
                      ? `${selectedSchoolType === 'ancians' ? 'bg-[#37616b]' : 'bg-indigo-600'} text-white shadow-xs font-bold` 
                      : 'text-typography-600 hover:text-typography-900 hover:bg-surface-200 font-medium'
                  }`}
                  title={`Turma ${turma + 1}`}
                >
                  <span className="hidden sm:inline">Turma </span>
                  <span>{turma + 1}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Zoom & Document Viewport Toolbar (Apenas no Modo Folha A4) */}
        {viewMode === 'a4' && (
          <div className="flex items-center justify-end gap-2 p-2 bg-slate-900 text-white rounded-2xl shadow-md flex-wrap">
            <div className="flex items-center gap-1.5 shrink-0 ml-auto flex-wrap">
              {/* Zoom Out */}
              <button
                onClick={() => setZoom(prev => Math.max(35, prev - 10))}
                className="p-1.5 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg transition-colors cursor-pointer"
                title="Reduzir zoom (-10%)"
                aria-label="Reduzir zoom"
              >
                <ZoomOut size={16} />
              </button>

              {/* Direct Zoom Presets */}
              <div className="flex items-center bg-slate-800 rounded-lg p-0.5">
                {[60, 80, 100, 125].map(preset => (
                  <button
                    key={preset}
                    onClick={() => setZoom(preset)}
                    className={`px-2 py-1 text-[11px] font-bold rounded-md transition-all cursor-pointer ${
                      zoom === preset ? (selectedSchoolType === 'ancians' ? 'bg-[#37616b] text-white shadow-xs' : 'bg-indigo-600 text-white shadow-xs') : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {preset}%
                  </button>
                ))}
              </div>

              {/* Zoom In */}
              <button
                onClick={() => setZoom(prev => Math.min(200, prev + 10))}
                className="p-1.5 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg transition-colors cursor-pointer"
                title="Aumentar zoom (+10%)"
                aria-label="Aumentar zoom"
              >
                <ZoomIn size={16} />
              </button>

              {/* Fit to screen */}
              <button
                onClick={handleFitToScreen}
                className="px-2.5 py-1 text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                title="Ajustar documento à largura da tela"
              >
                <Maximize2 size={13} />
                <span className="hidden sm:inline">Ajustar</span>
              </button>

              {/* Current Zoom Level */}
              <span className="text-xs font-bold text-slate-400 min-w-[40px] text-center">
                {zoom}%
              </span>
            </div>
          </div>
        )}
      </div>

      {/* MODO DE VISUALIZAÇÃO RESPONSIVO (PAINEL MOBILE-FIRST) */}
      {viewMode === 'responsive' && (
        <div className="no-print space-y-6">
          {/* Hero Card com Tema e Metadados da Turma */}
          <div className="relative rounded-3xl overflow-hidden bg-surface-100 border border-surface-300 shadow-xs p-5 sm:p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider text-white shadow-2xs ${
                  selectedSchoolType === 'ancians' ? 'bg-[#37616b]' : 'bg-indigo-600'
                }`}>
                  E.M.R. • {currentConfig.year}
                </span>
                <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-surface-200 text-typography-700 border border-surface-300">
                  TURMA {selectedTurma + 1} • {currentConfig.modalidade.toUpperCase()}
                </span>
              </div>

              <button
                onClick={() => setShowDetailsModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-surface-200 hover:bg-surface-300 text-typography-800 transition-colors border border-surface-300 cursor-pointer"
              >
                <Edit3 size={13} />
                <span>Editar Dados da Turma</span>
              </button>
            </div>

            {/* Tema e Escritura */}
            <div className="space-y-1">
              <h2 className="text-lg sm:text-2xl font-black text-typography-900 tracking-tight leading-tight">
                {currentConfig.themeText}
              </h2>
              <p className="text-xs sm:text-sm font-bold text-primary-200">
                — {currentConfig.themeVerse}
              </p>
              <p className="text-xs text-typography-500 font-medium pt-0.5">
                {currentConfig.title}
              </p>
            </div>

            {/* Metadados: Data, Local, Anfitriã / Horário */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-surface-300/70">
              <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-surface-200/50 border border-surface-300/60 text-xs">
                <Calendar size={16} className="text-primary-200 shrink-0" />
                <div className="min-w-0">
                  <span className="block text-[10px] uppercase font-bold text-typography-400">Data</span>
                  <span className="font-bold text-typography-900 truncate block">
                    {details.data || 'A definir'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-surface-200/50 border border-surface-300/60 text-xs">
                <MapPin size={16} className="text-primary-200 shrink-0" />
                <div className="min-w-0">
                  <span className="block text-[10px] uppercase font-bold text-typography-400">Local da Turma</span>
                  <span className="font-bold text-typography-900 truncate block">
                    {details.local || 'A definir'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-surface-200/50 border border-surface-300/60 text-xs">
                <Clock size={16} className="text-primary-200 shrink-0" />
                <div className="min-w-0">
                  <span className="block text-[10px] uppercase font-bold text-typography-400">Horários</span>
                  <span className="font-bold text-typography-900 truncate block">
                    {details.horarioInicio || '08:00'} às {details.horarioFim || '16:00'}
                  </span>
                </div>
              </div>
            </div>

            {/* KPIs de Progresso */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
              <div className="p-3 rounded-2xl bg-surface-200/60 border border-surface-300 text-center">
                <span className="text-[10px] uppercase font-black tracking-wider text-typography-400 block mb-0.5">
                  Designadas
                </span>
                <div className="text-base sm:text-xl font-black text-typography-900">
                  {stats.assignedCount}<span className="text-typography-400 text-xs font-bold">/{stats.totalWithSpeaker}</span>
                </div>
                <div className="w-full bg-surface-300 h-1.5 rounded-full mt-1.5 overflow-hidden">
                  <div
                    className="bg-primary-200 h-full rounded-full transition-all duration-500"
                    style={{ width: `${stats.percentageAssigned}%` }}
                  />
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-surface-200/60 border border-surface-300 text-center">
                <span className="text-[10px] uppercase font-black tracking-wider text-typography-400 block mb-0.5">
                  Confirmadas
                </span>
                <div className="text-base sm:text-xl font-black text-emerald-600 dark:text-emerald-400">
                  {stats.confirmedCount}<span className="text-typography-400 text-xs font-bold">/{stats.totalWithSpeaker}</span>
                </div>
                <div className="w-full bg-surface-300 h-1.5 rounded-full mt-1.5 overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${stats.totalWithSpeaker > 0 ? Math.round((stats.confirmedCount / stats.totalWithSpeaker) * 100) : 0}%` }}
                  />
                </div>
              </div>

              <div className="col-span-2 sm:col-span-1 p-3 rounded-2xl bg-surface-200/60 border border-surface-300 text-center flex flex-col justify-center">
                <span className="text-[10px] uppercase font-black tracking-wider text-typography-400 block mb-0.5">
                  Anfitriã
                </span>
                <div className="text-xs sm:text-sm font-bold text-typography-800 truncate">
                  {details.anfitria || 'A definir'}
                </div>
              </div>
            </div>
          </div>

          {/* Barra de Filtro e Busca Rápida */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Tabs de Sessões */}
            <div className="flex items-center gap-1 bg-surface-100 p-1 rounded-2xl border border-surface-300 shadow-2xs overflow-x-auto">
              <button
                onClick={() => setActiveSessionTab(-1)}
                className={`h-9 px-3.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  activeSessionTab === -1
                    ? 'bg-primary-200 text-white shadow-xs'
                    : 'text-typography-600 hover:text-typography-900'
                }`}
              >
                Todas as Partes
              </button>
              {currentConfig.sessions.map((session, sIdx) => (
                <button
                  key={sIdx}
                  onClick={() => setActiveSessionTab(sIdx)}
                  className={`h-9 px-3.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                    activeSessionTab === sIdx
                      ? 'bg-primary-200 text-white shadow-xs'
                      : 'text-typography-600 hover:text-typography-900'
                  }`}
                >
                  {session.period}
                </button>
              ))}
            </div>

            {/* Input de Busca */}
            <div className="relative w-full sm:w-72">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-typography-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Buscar parte ou orador..."
                className="w-full h-10 pl-9 pr-8 rounded-2xl bg-surface-100 border border-surface-300 text-xs font-medium text-typography-900 placeholder:text-typography-400 focus:outline-none focus:border-primary-200 focus:ring-2 focus:ring-primary-200/20 transition-all shadow-2xs"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-typography-400 hover:text-typography-700"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Lista de Partes por Sessão */}
          <div className="space-y-6">
            {currentConfig.sessions
              .filter((_, idx) => activeSessionTab === -1 || activeSessionTab === idx)
              .map((session, sIdx) => {
                const sessionItems = session.items.filter(item => {
                  if (!searchQuery.trim()) return true;
                  const q = searchQuery.toLowerCase();
                  if (item.title?.toLowerCase().includes(q)) return true;
                  if (item.num?.toLowerCase().includes(q)) return true;
                  if (speakers[item.id]?.toLowerCase().includes(q)) return true;
                  if (speakerCongs[item.id]?.toLowerCase().includes(q)) return true;
                  if (item.subitems?.some(s => 
                    s.title?.toLowerCase().includes(q) || 
                    s.num?.toLowerCase().includes(q) || 
                    speakers[s.id]?.toLowerCase().includes(q) ||
                    speakerCongs[s.id]?.toLowerCase().includes(q)
                  )) return true;
                  return false;
                });

                if (sessionItems.length === 0) return null;

                return (
                  <div key={session.period || sIdx} className="space-y-3">
                    <div className="flex items-center gap-2.5 px-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-primary-200" />
                      <div>
                        <h3 className="text-sm font-black text-typography-900 uppercase tracking-wider">
                          {session.period}
                        </h3>
                        {session.subtitle && (
                          <p className="text-xs text-typography-500 font-medium">
                            {session.subtitle}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-3">
                      {sessionItems.map((item, itemIdx) => {
                        const isSymposium = item.isSeries && item.subitems && item.subitems.length > 0;
                        const hasSpeaker = !item.noSpeaker && !item.isInterval;

                        // Simpósio / Série de Discursos
                        if (isSymposium) {
                          return (
                            <div
                              key={item.id || itemIdx}
                              className="p-4 sm:p-5 rounded-3xl bg-surface-100 border-2 border-primary-200/25 shadow-xs space-y-4"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-primary-200/10 text-primary-200 border border-primary-200/20">
                                      {item.label || 'SÉRIE DE DISCURSOS'}
                                    </span>
                                  </div>
                                  <h4 className="text-sm sm:text-base font-black text-typography-900 leading-tight">
                                    {item.title}
                                  </h4>
                                </div>
                              </div>

                              {/* Subpartes do Simpósio */}
                              <div className="space-y-3 pt-1">
                                {item.subitems!.map((sub, subIdx) => {
                                  const subSpeaker = speakers[sub.id] || '';
                                  const subCong = speakerCongs[sub.id] || '';
                                  const isConfirmed = Boolean(confirmations[sub.id]);

                                  return (
                                    <div
                                      key={sub.id || subIdx}
                                      className="p-3.5 sm:p-4 rounded-2xl bg-surface-200/50 border border-surface-300 space-y-3 transition-all hover:border-surface-300/90"
                                    >
                                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                          <span className="w-6 h-6 rounded-lg bg-primary-200/15 text-primary-200 text-xs font-black flex items-center justify-center shrink-0">
                                            {sub.num || subIdx + 1}
                                          </span>
                                          <h5 className="text-xs sm:text-sm font-bold text-typography-900 leading-tight">
                                            {sub.title}
                                          </h5>
                                        </div>

                                        <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
                                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-surface-100 border border-surface-300 text-typography-600">
                                            {sub.time} • {sub.duration}
                                          </span>
                                          {sub.sigla && (
                                            <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30">
                                              {sub.sigla}
                                            </span>
                                          )}
                                        </div>
                                      </div>

                                      {/* Inputs de Orador, Congregação e Ações */}
                                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 pt-1">
                                        {/* Orador */}
                                        <div className="sm:col-span-6 relative">
                                          <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-typography-400" />
                                          <input
                                            type="text"
                                            value={subSpeaker}
                                            onChange={e => updateSpeaker(sub.id, e.target.value)}
                                            placeholder="Nome do orador..."
                                            className="w-full h-9 pl-8 pr-3 rounded-xl bg-surface-100 border border-surface-300 text-xs font-bold text-typography-900 placeholder:text-typography-400 focus:outline-none focus:border-primary-200 focus:ring-1 focus:ring-primary-200"
                                          />
                                        </div>

                                        {/* Congregação */}
                                        <div className="sm:col-span-3 relative">
                                          <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-typography-400 z-10" />
                                          <input
                                            type="text"
                                            list={`cong-list-${sub.id}`}
                                            value={subCong}
                                            onChange={e => updateSpeakerCongregation(sub.id, e.target.value)}
                                            placeholder="Congregação..."
                                            className="w-full h-9 pl-8 pr-3 rounded-xl bg-surface-100 border border-surface-300 text-xs font-medium text-typography-800 placeholder:text-typography-400 focus:outline-none focus:border-primary-200 focus:ring-1 focus:ring-primary-200"
                                          />
                                          <datalist id={`cong-list-${sub.id}`}>
                                            {congregations.map(c => (
                                              <option key={c.id} value={c.nome} />
                                            ))}
                                          </datalist>
                                        </div>

                                        {/* Confirmação e Carta */}
                                        <div className="sm:col-span-3 flex items-center gap-1.5">
                                          <button
                                            type="button"
                                            onClick={() => toggleConfirmation(sub.id)}
                                            className={`flex-1 h-9 px-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap shadow-2xs ${
                                              isConfirmed
                                                ? 'bg-emerald-100 hover:bg-emerald-200/80 border-emerald-400 text-emerald-950 dark:bg-emerald-950/80 dark:border-emerald-600 dark:text-emerald-200'
                                                : 'bg-surface-100 hover:bg-surface-200 border-surface-300 text-typography-600 dark:bg-surface-200 dark:text-typography-400'
                                            }`}
                                            title={isConfirmed ? "Orador Confirmado" : "Clique para confirmar"}
                                          >
                                            {isConfirmed ? (
                                              <CheckCircle2 size={14} className="text-emerald-700 dark:text-emerald-400 stroke-[2.5]" />
                                            ) : (
                                              <Circle size={14} className="text-typography-400 stroke-[2]" />
                                            )}
                                            <span>{isConfirmed ? 'Confirmado' : 'Pendente'}</span>
                                          </button>

                                          <button
                                            type="button"
                                            onClick={() => generateLetter(sub.id)}
                                            disabled={isGenerating === sub.id}
                                            className="h-9 px-2.5 rounded-xl text-xs font-bold bg-surface-100 hover:bg-surface-200 text-typography-700 border border-surface-300 flex items-center justify-center transition-all cursor-pointer shrink-0 disabled:opacity-50"
                                            title="Gerar Carta ao Instrutor"
                                          >
                                            {isGenerating === sub.id ? <Loader2 size={14} className="animate-spin text-primary-200" /> : <Mail size={14} />}
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        }

                        // Discurso normal com orador
                        if (hasSpeaker) {
                          const itemSpeaker = speakers[item.id] || '';
                          const itemCong = speakerCongs[item.id] || '';
                          const isConfirmed = Boolean(confirmations[item.id]);

                          return (
                            <div
                              key={item.id || itemIdx}
                              className="p-4 sm:p-5 rounded-3xl bg-surface-100 border border-surface-300 shadow-xs space-y-3.5 hover:border-surface-300/90 transition-all"
                            >
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div className="flex items-center gap-2.5">
                                  {item.num && (
                                    <span className="w-6 h-6 rounded-lg bg-primary-200/15 text-primary-200 text-xs font-black flex items-center justify-center shrink-0">
                                      {item.num}
                                    </span>
                                  )}
                                  <div>
                                    <h4 className="text-xs sm:text-base font-bold text-typography-900 leading-tight">
                                      {item.title}
                                    </h4>
                                    {item.note && (
                                      <p className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 mt-0.5">
                                        • {item.note}
                                      </p>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
                                  <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-surface-200 border border-surface-300 text-typography-600">
                                    {item.time} {item.duration ? `• ${item.duration}` : ''}
                                  </span>
                                  {item.sigla && (
                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30">
                                      {item.sigla}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Inputs de Orador, Congregação e Ações */}
                              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 pt-1">
                                <div className="sm:col-span-6 relative">
                                  <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-typography-400" />
                                  <input
                                    type="text"
                                    value={itemSpeaker}
                                    onChange={e => updateSpeaker(item.id, e.target.value)}
                                    placeholder="Nome do orador..."
                                    className="w-full h-9 pl-8 pr-3 rounded-xl bg-surface-200/50 border border-surface-300 text-xs font-bold text-typography-900 placeholder:text-typography-400 focus:outline-none focus:border-primary-200 focus:ring-1 focus:ring-primary-200"
                                  />
                                </div>

                                <div className="sm:col-span-3 relative">
                                  <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-typography-400 z-10" />
                                  <input
                                    type="text"
                                    list={`cong-list-${item.id}`}
                                    value={itemCong}
                                    onChange={e => updateSpeakerCongregation(item.id, e.target.value)}
                                    placeholder="Congregação..."
                                    className="w-full h-9 pl-8 pr-3 rounded-xl bg-surface-200/50 border border-surface-300 text-xs font-medium text-typography-800 placeholder:text-typography-400 focus:outline-none focus:border-primary-200 focus:ring-1 focus:ring-primary-200"
                                  />
                                  <datalist id={`cong-list-${item.id}`}>
                                    {congregations.map(c => (
                                      <option key={c.id} value={c.nome} />
                                    ))}
                                  </datalist>
                                </div>

                                <div className="sm:col-span-3 flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => toggleConfirmation(item.id)}
                                    className={`flex-1 h-9 px-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap shadow-2xs ${
                                      isConfirmed
                                        ? 'bg-emerald-100 hover:bg-emerald-200/80 border-emerald-400 text-emerald-950 dark:bg-emerald-950/80 dark:border-emerald-600 dark:text-emerald-200'
                                        : 'bg-surface-100 hover:bg-surface-200 border-surface-300 text-typography-600 dark:bg-surface-200 dark:text-typography-400'
                                    }`}
                                    title={isConfirmed ? "Orador Confirmado" : "Clique para confirmar"}
                                  >
                                    {isConfirmed ? (
                                      <CheckCircle2 size={14} className="text-emerald-700 dark:text-emerald-400 stroke-[2.5]" />
                                    ) : (
                                      <Circle size={14} className="text-typography-400 stroke-[2]" />
                                    )}
                                    <span>{isConfirmed ? 'Confirmado' : 'Pendente'}</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => generateLetter(item.id)}
                                    disabled={isGenerating === item.id}
                                    className="h-9 px-2.5 rounded-xl text-xs font-bold bg-surface-100 hover:bg-surface-200 text-typography-700 border border-surface-300 flex items-center justify-center transition-all cursor-pointer shrink-0 disabled:opacity-50"
                                    title="Gerar Carta ao Instrutor"
                                  >
                                    {isGenerating === item.id ? <Loader2 size={14} className="animate-spin text-primary-200" /> : <Mail size={14} />}
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        }

                        // Cântico ou Intervalo
                        return (
                          <div
                            key={item.id || itemIdx}
                            className="p-3 rounded-2xl bg-surface-200/40 border border-surface-300/70 flex items-center justify-between gap-3 text-xs text-typography-600"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              {item.isInterval ? (
                                <Coffee size={15} className="text-amber-600 dark:text-amber-400 shrink-0" />
                              ) : (
                                <Music size={15} className="text-primary-200 shrink-0" />
                              )}
                              <span className="font-bold text-typography-800 truncate">
                                {item.title}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-[10px] font-semibold text-typography-400">
                                {item.time} {item.duration ? `• ${item.duration}` : ''}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* A4 Document Viewport Container */}
      <div 
        ref={containerRef}
        className={`emr-viewport w-full overflow-x-auto overflow-y-auto bg-slate-200/80 rounded-3xl p-3 sm:p-6 lg:p-8 flex flex-col items-center gap-8 shadow-inner custom-scrollbar relative border border-slate-300/80 ${
          viewMode === 'a4' ? 'flex' : 'hidden print:flex'
        }`}
        style={{
          minHeight: viewMode === 'a4' ? '400px' : '0',
          touchAction: 'pan-x pan-y',
        }}
      >
        {/* Render 2 Physical A4 Pages: Page 1 (Parte 1 Manhã) & Page 2 (Parte 2 Tarde) */}
        {currentConfig.sessions.map((session, pageIdx) => {
          const pageNum = pageIdx + 1;
          const totalPages = currentConfig.sessions.length;
          const isPage1 = pageIdx === 0;

          return (
            <div key={session.period || pageIdx} className="emr-session-wrapper flex flex-col items-center w-full">
              {/* Scaled Document Wrapper — Strict Proportional Model (A4 Portrait) */}
              <div 
                className="emr-scale-wrapper mx-auto shrink-0 relative transition-all duration-150"
                style={{
                  width: `${(210 * zoom) / 100}mm`,
                  minWidth: `${(210 * zoom) / 100}mm`,
                  height: `${(297 * zoom) / 100}mm`,
                  minHeight: `${(297 * zoom) / 100}mm`,
                }}
              >
                {/* Physical A4 Sheet (210 x 297 mm) */}
                <div 
                  id={`emr-a4-page-${pageNum}`}
                  className="emr-a4-page bg-white text-slate-900 shadow-2xl rounded-xs border border-gray-300 print:shadow-none print:border-none print:m-0 flex flex-col justify-between box-border select-text"
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '210mm',
                    minWidth: '210mm',
                    maxWidth: '210mm',
                    height: '297mm',
                    minHeight: '297mm',
                    maxHeight: '297mm',
                    padding: '8mm 10mm',
                    boxSizing: 'border-box',
                    overflow: 'hidden',
                    transform: `scale(${zoom / 100})`,
                    transformOrigin: 'top left',
                    transition: 'transform 0.15s ease-out',
                  }}
                >
                  {/* Top Content Block */}
                  <div className="flex flex-col flex-1 min-h-0">
                    {/* Header Banner (Full on Page 1, Compact on Page 2) */}
                    {isPage1 ? (
                      <div className={`relative w-full rounded-2xl overflow-hidden mb-3 shadow-md border border-slate-200 bg-gradient-to-br ${currentConfig.gradient} text-white shrink-0`}>
                        <div className="relative z-10 p-3.5 flex flex-col justify-between min-h-[34mm]">
                          {/* Top Bar: Title & Turma Badge */}
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-[7.5pt] font-black uppercase tracking-widest text-emerald-200/90 drop-shadow-sm flex items-center gap-1.5 min-w-0">
                              <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0"></span>
                              <span className="truncate">{currentConfig.title.toUpperCase()}</span>
                            </div>
                            <span className="text-[7.5pt] font-black uppercase tracking-wider text-slate-900 bg-emerald-300 px-2.5 py-0.5 rounded-full shadow-sm shrink-0">
                              TURMA {selectedTurma + 1} • {currentConfig.modalidade.toUpperCase()}
                            </span>
                          </div>

                          {/* Theme Verse */}
                          <div className="my-1.5 space-y-0.5">
                            <div className="text-[12pt] font-black uppercase tracking-tight text-white drop-shadow-md leading-tight">
                              {currentConfig.themeText}
                            </div>
                            <div className="text-[8pt] font-bold text-emerald-200/90">
                              — {currentConfig.themeVerse}
                            </div>
                          </div>

                          {/* Metadata Strip */}
                          <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/10 flex-wrap">
                            <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1">
                              <div className="flex items-center gap-1.5 text-[7.5pt] font-bold uppercase tracking-wider text-white/95 drop-shadow-sm">
                                <CalendarDays size={12} className="text-emerald-300 shrink-0" />
                                <span>{details.data || 'Data a definir'}</span>
                              </div>
                              <div className="flex items-center gap-1.5 text-[7.5pt] font-bold uppercase tracking-wider text-white/95 drop-shadow-sm">
                                <MapPin size={12} className="text-emerald-300 shrink-0" />
                                <span>{details.local || 'Local a definir'}</span>
                              </div>
                              {details.anfitria && (
                                <div className="flex items-center gap-1.5 text-[7.5pt] font-bold uppercase tracking-wider text-white/95 drop-shadow-sm">
                                  <BookOpen size={12} className="text-emerald-300 shrink-0" />
                                  <span>Anfitriã: {details.anfitria}</span>
                                </div>
                              )}
                              <div className="flex items-center gap-1.5 text-[7.5pt] font-bold uppercase tracking-wider text-white/95 drop-shadow-sm">
                                <Clock size={12} className="text-emerald-300 shrink-0" />
                                <span>Horário: {details.horarioInicio || '08:00'} às {details.horarioFim || '16:00'}</span>
                              </div>
                              {details.horarioEsposas && (
                                <div className="flex items-center gap-1.5 text-[7pt] font-bold uppercase tracking-wider text-emerald-200 drop-shadow-sm">
                                  <Clock size={11} className="text-emerald-300 shrink-0" />
                                  <span>Esposas: {details.horarioEsposas}</span>
                                </div>
                              )}
                            </div>

                            <button
                              onClick={() => setShowDetailsModal(true)}
                              className="no-print text-[7pt] font-bold text-emerald-200 hover:text-white flex items-center gap-1 cursor-pointer bg-white/15 hover:bg-white/25 px-2 py-0.5 rounded-md transition-all ml-auto drop-shadow-sm"
                              title="Editar dados da escola"
                            >
                              <Edit3 size={10} />
                              <span>Editar</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* Compact Header for Page 2 */
                      <div className={`w-full rounded-xl p-2.5 mb-2.5 bg-gradient-to-r ${currentConfig.gradient} text-white flex items-center justify-between gap-3 shadow-xs shrink-0`}>
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                          <span className="text-[8pt] font-black uppercase tracking-wider truncate">
                            {currentConfig.title}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[7pt] font-bold text-white/90">
                          <span>Turma {selectedTurma + 1}</span>
                          <span>•</span>
                          <span>{details.data || '2027'}</span>
                          <span>•</span>
                          <span>{details.local || 'Salão do Reino'}</span>
                        </div>
                      </div>
                    )}

                    {/* Session Section Header Bar */}
                    <div className={`flex items-baseline justify-between border-b-2 ${selectedSchoolType === 'ancians' ? 'border-[#37616b]' : 'border-indigo-600'} pb-1 mb-2 shrink-0`}>
                      <div className="flex items-center gap-2">
                        <h3 className={`text-[10pt] font-black tracking-wider uppercase ${selectedSchoolType === 'ancians' ? 'text-[#37616b]' : 'text-indigo-900'}`}>
                          {session.period.toUpperCase()}
                        </h3>
                        {session.subtitle && (
                          <span className="text-[7pt] font-semibold text-gray-500 hidden sm:inline">
                            — {session.subtitle}
                          </span>
                        )}
                      </div>
                      <span className="text-[7pt] font-bold tracking-wider uppercase text-gray-400">
                        Nº • HORÁRIO • TEMA • TEMPO • SIGLA • INSTRUTOR
                      </span>
                    </div>

                    {/* Items List */}
                    <div className="space-y-1.5 flex-1 flex flex-col justify-start">
                      {session.items.map((item) => {
                        const isSymposium = item.isSeries && item.subitems && item.subitems.length > 0;
                        const isIntermission = item.isInterval;
                        const isSong = item.noSpeaker && !isIntermission;

                        // Case 1: Symposium
                        if (isSymposium) {
                          return (
                            <div 
                              key={item.id} 
                              className={`rounded-lg p-1.5 border my-1 ${selectedSchoolType === 'ancians' ? 'bg-[#37616b]/5 border-[#37616b]/20' : 'bg-indigo-50/40 border-indigo-100'}`}
                            >
                              {/* Main Series Header */}
                              <div className="flex items-start gap-2 mb-1">
                                <span className={`text-[8pt] font-black w-10 shrink-0 mt-0.5 ${selectedSchoolType === 'ancians' ? 'text-[#37616b]' : 'text-indigo-700'}`}>
                                  {item.time}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <span className={`text-[7pt] font-black uppercase tracking-wider block leading-tight ${selectedSchoolType === 'ancians' ? 'text-[#37616b]' : 'text-indigo-700'}`}>
                                    {item.label || 'SÉRIE DE DISCURSOS:'}
                                  </span>
                                  <span className="text-[9pt] font-black text-gray-900 leading-tight">
                                    {item.title}
                                  </span>
                                </div>
                              </div>

                              {/* Symposium Subitems */}
                              <div className={`ml-10 border-l-2 pl-2 space-y-1 mt-1 ${selectedSchoolType === 'ancians' ? 'border-[#37616b]/30' : 'border-indigo-300/80'}`}>
                                {item.subitems?.map((sub) => {
                                  const subSpeaker = speakers[sub.id] || '';
                                  const subCong = speakerCongs[sub.id] || '';
                                  const isConfirmed = !!confirmations[sub.id];

                                  return (
                                    <div key={sub.id} className="border-b border-gray-100/80 pb-1 last:border-b-0">
                                      <div className="flex items-start justify-between gap-1.5">
                                        <div className="flex items-start gap-1.5 flex-1 min-w-0">
                                          <span className={`font-black text-[8pt] shrink-0 mt-0.5 ${selectedSchoolType === 'ancians' ? 'text-[#37616b]' : 'text-indigo-700'}`}>
                                            {sub.num}.
                                          </span>
                                          <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                              <span className="text-[8.5pt] font-bold text-gray-900 leading-tight">
                                                {sub.title}
                                              </span>
                                              <span className="text-[7pt] font-bold text-gray-500 bg-gray-100 px-1 rounded">
                                                {sub.time}
                                              </span>
                                              <span className="text-[7pt] font-semibold text-gray-400">
                                                ({sub.duration})
                                              </span>
                                              <span className={`text-[7pt] font-black px-1 rounded ${selectedSchoolType === 'ancians' ? 'bg-[#37616b]/10 text-[#37616b]' : 'bg-indigo-100 text-indigo-700'}`}>
                                                {sub.sigla}
                                              </span>
                                            </div>

                                            <div className="grid grid-cols-2 gap-2 mt-1">
                                              <div className="relative flex items-center">
                                                <input
                                                  type="text"
                                                  placeholder="Nome do instrutor..."
                                                  value={subSpeaker}
                                                  onChange={e => updateSpeaker(sub.id, e.target.value)}
                                                  className={`w-full text-[8pt] font-bold text-gray-900 bg-transparent border-b border-gray-200 focus:border-[#37616b] outline-none placeholder:text-gray-300 py-0.5 ${isConfirmed ? 'text-emerald-800 font-extrabold' : ''}`}
                                                />
                                              </div>
                                              <div className="relative flex items-center">
                                                <input
                                                  type="text"
                                                  placeholder="Congregação..."
                                                  value={subCong}
                                                  onChange={e => updateSpeakerCongregation(sub.id, e.target.value)}
                                                  className="w-full text-[7.5pt] font-medium text-gray-600 bg-transparent border-b border-gray-200 focus:border-[#37616b] outline-none placeholder:text-gray-300 py-0.5"
                                                />
                                              </div>
                                            </div>
                                          </div>
                                        </div>

                                        <div className="flex items-center gap-1 shrink-0 ml-1 mt-0.5 no-print">
                                          <button
                                            onClick={() => toggleConfirmation(sub.id)}
                                            className={`p-1 rounded-md transition-all cursor-pointer ${
                                              isConfirmed
                                                ? 'bg-emerald-500 text-white shadow-xs'
                                                : 'text-gray-300 hover:text-gray-600 hover:bg-gray-100'
                                            }`}
                                            title={isConfirmed ? "Confirmado" : "Marcar confirmação"}
                                          >
                                            <Check size={11} strokeWidth={3} />
                                          </button>
                                          {subSpeaker && (
                                            <button
                                              onClick={() => generateLetter(sub.id)}
                                              disabled={isGenerating === sub.id}
                                              className="p-1 text-blue-600 hover:bg-blue-50 rounded-md transition-colors cursor-pointer"
                                              title="Gerar Carta ao Instrutor"
                                            >
                                              {isGenerating === sub.id ? <Loader2 size={11} className="animate-spin" /> : <Mail size={11} />}
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        }

                        // Case 2: Intermission
                        if (isIntermission) {
                          return (
                            <div key={item.id} className="flex items-center justify-between bg-amber-50/70 border border-amber-200/60 rounded px-2.5 py-1 my-1">
                              <div className="flex items-center gap-2">
                                <Coffee size={12} className="text-amber-600" />
                                <span className="text-[8pt] font-black uppercase tracking-wider text-amber-900">
                                  {item.title}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-[7.5pt] font-bold text-amber-700">
                                <span>{item.time}</span>
                                {item.duration && <span>• {item.duration}</span>}
                              </div>
                            </div>
                          );
                        }

                        // Case 3: Song / Prayer
                        if (isSong) {
                          return (
                            <div key={item.id} className="flex items-center justify-between py-1 px-1 border-b border-gray-100">
                              <div className="flex items-center gap-2">
                                <Music size={12} className="text-gray-400" />
                                <span className="text-[8pt] font-bold italic text-gray-600">
                                  {item.title}
                                </span>
                              </div>
                              <span className="text-[7.5pt] font-bold text-gray-400">
                                {item.time}
                              </span>
                            </div>
                          );
                        }

                        // Case 4: Standard Discourse
                        const itemSpeaker = speakers[item.id] || '';
                        const itemCong = speakerCongs[item.id] || '';
                        const isConfirmed = !!confirmations[item.id];

                        return (
                          <div key={item.id} className="border-b border-gray-100 pb-1.5 pt-0.5">
                            <div className="flex items-start justify-between gap-1.5">
                              <div className="flex items-start gap-2 flex-1 min-w-0">
                                <span className={`font-black text-[8.5pt] w-5 text-center shrink-0 mt-0.5 rounded px-0.5 ${selectedSchoolType === 'ancians' ? 'bg-[#37616b]/10 text-[#37616b]' : 'bg-indigo-100 text-indigo-700'}`}>
                                  {item.num}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-[9pt] font-black text-gray-900 leading-tight">
                                      {item.title}
                                    </span>
                                    {item.note && (
                                      <span className="text-[7pt] font-black text-rose-600 bg-rose-50 border border-rose-100 px-1 rounded">
                                        {item.note}
                                      </span>
                                    )}
                                    <span className="text-[7pt] font-bold text-gray-500 bg-gray-100 px-1 rounded">
                                      {item.time}
                                    </span>
                                    <span className="text-[7pt] font-semibold text-gray-400">
                                      ({item.duration})
                                    </span>
                                    <span className={`text-[7pt] font-black px-1 rounded ${selectedSchoolType === 'ancians' ? 'bg-[#37616b]/10 text-[#37616b]' : 'bg-indigo-100 text-indigo-700'}`}>
                                      {item.sigla}
                                    </span>
                                  </div>

                                  <div className="grid grid-cols-2 gap-2 mt-1">
                                    <div className="relative flex items-center">
                                      <input
                                        type="text"
                                        placeholder="Nome do instrutor..."
                                        value={itemSpeaker}
                                        onChange={e => updateSpeaker(item.id, e.target.value)}
                                        className={`w-full text-[8.5pt] font-bold text-gray-900 bg-transparent border-b border-gray-200 focus:border-[#37616b] outline-none placeholder:text-gray-300 py-0.5 ${isConfirmed ? 'text-emerald-800 font-extrabold' : ''}`}
                                      />
                                    </div>
                                    <div className="relative flex items-center">
                                      <input
                                        type="text"
                                        placeholder="Congregação..."
                                        value={itemCong}
                                        onChange={e => updateSpeakerCongregation(item.id, e.target.value)}
                                        className="w-full text-[7.5pt] font-medium text-gray-600 bg-transparent border-b border-gray-200 focus:border-[#37616b] outline-none placeholder:text-gray-300 py-0.5"
                                      />
                                    </div>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-1 shrink-0 ml-1 mt-0.5 no-print">
                                <button
                                  onClick={() => toggleConfirmation(item.id)}
                                  className={`p-1 rounded-md transition-all cursor-pointer ${
                                    isConfirmed
                                      ? 'bg-emerald-500 text-white shadow-xs'
                                      : 'text-gray-300 hover:text-gray-600 hover:bg-gray-100'
                                  }`}
                                  title={isConfirmed ? "Confirmado" : "Marcar confirmação"}
                                >
                                  <Check size={11} strokeWidth={3} />
                                </button>
                                {itemSpeaker && (
                                  <button
                                    onClick={() => generateLetter(item.id)}
                                    disabled={isGenerating === item.id}
                                    className="p-1 text-blue-600 hover:bg-blue-50 rounded-md transition-colors cursor-pointer"
                                    title="Gerar Carta ao Instrutor"
                                  >
                                    {isGenerating === item.id ? <Loader2 size={11} className="animate-spin" /> : <Mail size={11} />}
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Document Footer on A4 */}
                  <div className="pt-2 mt-2 border-t border-gray-200 flex items-center justify-between text-[7pt] text-gray-400 font-bold shrink-0">
                    <div className="truncate pr-2">
                      {isPage1 ? (
                        <span>*IA/SC: Betel / Instrutor em campo ou SC | #SC/A: SC ou Ancião Local</span>
                      ) : (
                        <span>*# Discursos proferidos conforme diretrizes da filial | Esposas convidadas às 14:45</span>
                      )}
                    </div>
                    <div className="shrink-0 text-gray-500">
                      Página {pageNum} de {totalPages} • EMR {currentConfig.year}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal de Edição de Dados da Escola */}
      <AnimatePresence>
        {showDetailsModal && (
          <div className="fixed inset-0 z-[1001] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md no-print">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-surface-100 rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden border border-surface-300"
            >
              <div className={`p-6 border-b flex items-center justify-between ${
                selectedSchoolType === 'ancians'
                  ? 'bg-[#37616b]/5 border-[#37616b]/10'
                  : 'bg-indigo-500/5 border-indigo-500/10'
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl ${
                    selectedSchoolType === 'ancians'
                      ? 'bg-[#37616b]/10 text-[#37616b]'
                      : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                  }`}>
                    <Calendar size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-typography-900 uppercase tracking-tight">Dados da Escola</h3>
                    <p className="text-xs text-typography-500">Turma {selectedTurma + 1} • {currentConfig.modalidade} ({currentConfig.year})</p>
                  </div>
                </div>
                <button onClick={() => setShowDetailsModal(false)} className="p-2 text-typography-400 hover:text-typography-900 transition-colors cursor-pointer rounded-lg hover:bg-surface-200/60">
                  <X size={22} />
                </button>
              </div>

              <div className="flex flex-col max-h-[calc(100vh-140px)] sm:max-h-[85vh]">
                <div className="flex-1 p-6 space-y-4 overflow-y-auto custom-scrollbar scroll-smooth">
                  {/* Local da Turma */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-typography-500 ml-1">Local da Turma (Salão do Reino)</label>
                    <div className="relative">
                      <MapPin size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-typography-400 z-10" />
                      <input 
                        type="text" 
                        list="emr-locais-modal"
                        value={details.local || ''} 
                        onChange={e => {
                          const val = e.target.value;
                          const found = congregations.find(c => c.nome === val);
                          if (found) {
                            const setter = selectedSchoolType === 'ancians' ? setAnciansParts : setServantsParts;
                            setter(prev => ({
                              ...prev,
                              [selectedTurma]: {
                                ...prev[selectedTurma],
                                details: {
                                  ...prev[selectedTurma].details,
                                  local: found.nome,
                                  endereco: found.endereco || ''
                                }
                              }
                            }));
                          } else {
                            updateDetail('local', val);
                          }
                        }}
                        placeholder="Ex: Salão do Reino Central"
                        className="w-full pl-11 pr-4 py-3 bg-surface-200/60 border border-surface-300 rounded-2xl text-sm font-bold text-typography-900 placeholder:text-typography-400 focus:border-[#37616b] outline-none transition-all"
                      />
                      <datalist id="emr-locais-modal">
                        {congregations.map(c => (
                          <option key={c.id} value={c.nome} />
                        ))}
                      </datalist>
                    </div>
                  </div>

                  {/* Endereço */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-typography-500 ml-1">Endereço Completo</label>
                    <div className="relative">
                      <MapPin size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-typography-400" />
                      <input 
                        type="text" 
                        value={details.endereco || ''} 
                        onChange={e => updateDetail('endereco', e.target.value)}
                        placeholder="Ex: Rua das Flores, 123 - Centro"
                        className="w-full pl-11 pr-4 py-3 bg-surface-200/60 border border-surface-300 rounded-2xl text-sm font-bold text-typography-900 placeholder:text-typography-400 focus:border-[#37616b] outline-none transition-all"
                      />
                    </div>
                  </div>

                  {/* Data da Escola */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-typography-500 ml-1">Data da Escola</label>
                    <div className="relative">
                      <Calendar size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-typography-400" />
                      <input 
                        type="text" 
                        value={details.data || ''} 
                        onChange={e => updateDetail('data', e.target.value)}
                        placeholder="Ex: 15 de Outubro de 2027"
                        className="w-full pl-11 pr-4 py-3 bg-surface-200/60 border border-surface-300 rounded-2xl text-sm font-bold text-typography-900 placeholder:text-typography-400 focus:border-[#37616b] outline-none transition-all"
                      />
                    </div>
                  </div>

                  {/* Congregação Anfitriã */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-typography-500 ml-1">Congregação Anfitriã</label>
                    <div className="relative">
                      <BookOpen size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-typography-400" />
                      <input 
                        type="text" 
                        value={details.anfitria || ''} 
                        onChange={e => updateDetail('anfitria', e.target.value)}
                        placeholder="Ex: Congregação Central"
                        className="w-full pl-11 pr-4 py-3 bg-surface-200/60 border border-surface-300 rounded-2xl text-sm font-bold text-typography-900 placeholder:text-typography-400 focus:border-[#37616b] outline-none transition-all"
                      />
                    </div>
                  </div>

                  {/* Horários */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase text-typography-500 ml-1">Início</label>
                      <div className="relative">
                        <Clock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-typography-400" />
                        <input 
                          type="text" 
                          value={details.horarioInicio || '08:00'} 
                          onChange={e => updateDetail('horarioInicio', e.target.value)}
                          placeholder="08:00"
                          className="w-full pl-11 pr-4 py-3 bg-surface-200/60 border border-surface-300 rounded-2xl text-sm font-bold text-typography-900 placeholder:text-typography-400 focus:border-[#37616b] outline-none transition-all"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase text-typography-500 ml-1">Término</label>
                      <div className="relative">
                        <Clock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-typography-400" />
                        <input 
                          type="text" 
                          value={details.horarioFim || '16:00'} 
                          onChange={e => updateDetail('horarioFim', e.target.value)}
                          placeholder="16:00"
                          className="w-full pl-11 pr-4 py-3 bg-surface-200/60 border border-surface-300 rounded-2xl text-sm font-bold text-typography-900 placeholder:text-typography-400 focus:border-[#37616b] outline-none transition-all"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Horário Esposas */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-typography-500 ml-1">Horário Especial (Esposas)</label>
                    <div className="relative">
                      <Clock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-typography-400" />
                      <input 
                        type="text" 
                        value={details.horarioEsposas || '14:45 às 16:00'} 
                        onChange={e => updateDetail('horarioEsposas', e.target.value)}
                        placeholder="Ex: 14:45 às 16:00"
                        className="w-full pl-11 pr-4 py-3 bg-surface-200/60 border border-surface-300 rounded-2xl text-sm font-bold text-typography-900 placeholder:text-typography-400 focus:border-[#37616b] outline-none transition-all"
                      />
                    </div>
                  </div>

                  <button 
                    onClick={() => setShowDetailsModal(false)}
                    className={`w-full mt-4 py-3.5 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg transition-all active:scale-95 cursor-pointer ${
                      selectedSchoolType === 'ancians'
                        ? 'bg-[#37616b] hover:bg-[#37616b]/90 shadow-[#37616b]/20'
                        : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/20'
                    }`}
                  >
                    Confirmar Dados
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Floating Save Bar */}
      <AnimatePresence>
        {hasChanges && !showDetailsModal && (
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            className="fixed bottom-6 portrait:bottom-20 landscape:bottom-6 sm:bottom-6 left-1/2 -translate-x-1/2 z-[1002] bg-gray-950/95 text-white backdrop-blur-lg px-4 sm:px-6 py-2.5 sm:py-3 rounded-2xl shadow-2xl flex items-center justify-between gap-3 sm:gap-6 border border-white/15 max-w-[calc(100vw-1.5rem)] w-auto no-print"
          >
            <div className="flex items-center gap-2.5 shrink-0">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <div className="flex flex-col">
                <span className="text-xs sm:text-sm font-semibold text-gray-200 whitespace-nowrap">
                  Alterações não salvas
                </span>
                <span className="text-[10px] text-gray-400 font-mono hidden sm:inline">
                  EMR 2027 • {currentConfig.modalidade} • Turma {selectedTurma + 1}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => {
                  if (selectedSchoolType === 'ancians') {
                    setAnciansParts(JSON.parse(initialAnciansParts || JSON.stringify(createEmptyTurmas())));
                  } else {
                    setServantsParts(JSON.parse(initialServantsParts || JSON.stringify(createEmptyTurmas())));
                  }
                }}
                disabled={isSaving}
                className="px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-gray-300 hover:text-white rounded-lg transition-colors cursor-pointer disabled:opacity-50"
              >
                Descartar
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-4 sm:px-5 py-1.5 sm:py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-emerald-900/20 flex items-center gap-2 disabled:opacity-50 active:scale-95 cursor-pointer"
              >
                {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                <span>Salvar</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
