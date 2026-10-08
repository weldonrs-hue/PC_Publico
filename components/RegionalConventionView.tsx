'use client';

import CustomSelect from '@/components/CustomSelect';
import { useDialog } from '@/hooks/useDialog';
import { db } from '@/lib/firebase';
import { handleFirestoreError, OperationType } from '@/utils/firestore';
import Docxtemplater from 'docxtemplater';
import { collection, doc, getDoc, getDocs, limit, query, setDoc, where } from 'firebase/firestore';
import {
  AlertTriangle,
  BookOpen,
  Calendar,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Circle,
  Clock,
  Edit3,
  FileDown, FileText,
  Info,
  Landmark,
  LayoutGrid,
  LayoutList,
  Loader2,
  Table as TableIcon,
  MapPin,
  Maximize2,
  Music,
  Plus,
  Printer,
  Save,
  Trash2,
  User,
  UserCheck,
  ZoomIn, ZoomOut
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import PizZip from 'pizzip';
import { useEffect, useMemo, useRef, useState } from 'react';

interface RegionalConventionViewProps {
  userId: string;
  isGuest?: boolean;
  onBack: () => void;
}

interface ConventionDetails {
  eventDate: string;
  eventLocation: string;
  conventionTheme: string;
  trainingDate: string;
  trainingLocation: string;
  congressAssistant: string;
  congressAssistants?: string[];
}

const regionalConventionProgram = [
  {
    day: 'Sexta-feira',
    title: 'SEXTA-FEIRA',
    color: '#ea580c', // Orange
    subtitle: 'Programa do congresso de 2026 — Felicidade Eterna',
    theme: '“Felizes os que têm consciência de sua necessidade espiritual” — Mateus 5:3',
    headerImage: 'https://cms-imgp.jw-cdn.org/img/p/1102026194/univ/art/1102026194_univ_cnt_1_lg.jpg',
    sessions: [
      {
        period: 'Manhã',
        items: [
          { id: 'm0', title: 'PRESIDENTE DE SESSÃO', icon: User, isRole: true },
          { id: 'm1', time: '9:20', title: 'Vídeo musical', icon: Music, noSpeaker: true },
          { id: 'm2', time: '9:30', title: 'Cântico 160 e oração', icon: Music },
          { 
            id: 'm3',
            time: '9:40', 
            label: 'DISCURSO DE ABERTURA:', 
            title: 'Felicidade sem fim — Sonho ou realidade?', 
            icon: BookOpen 
          },
          { 
            id: 'm4',
            time: '10:10', 
            label: 'VÍDEO PRINCIPAL:',
            title: 'A História e o Ministério de Jesus: Episódio 4', 
            subtitle: '‘Foi Por Isso Que Eu Vim’',
            icon: Calendar,
            noSpeaker: true
          },
          { id: 'm5', time: '11:05', title: 'Cântico 17 e anúncios', icon: Info, noSpeaker: true },
          { 
            id: 'm6',
            time: '11:15', 
            label: 'SÉRIE DE DISCURSOS:',
            title: 'As profecias sobre o Messias se cumpriram!',
            icon: BookOpen,
            noSpeaker: true,
            subitems: [
              { id: 'm6_1', title: '“Ele mesmo levou nossas doenças”' },
              { id: 'm6_2', title: '“Não discutirá, nem gritará”' },
              { id: 'm6_3', title: '“Nada lhes falava sem ilustração”' }
            ]
          },
          { id: 'm7', time: '12:10', title: 'Cântico 14 e intervalo', icon: Clock, noSpeaker: true }
        ]
      },
      {
        period: 'Tarde',
        items: [
          { id: 't0', title: 'PRESIDENTE DE SESSÃO', icon: User, isRole: true },
          { id: 't1', time: '1:35', title: 'Vídeo musical', icon: Music, noSpeaker: true },
          { id: 't2', time: '1:45', title: 'Cântico 23 e oração', icon: Music },
          { 
            id: 't3', 
            time: '1:50', 
            title: 'O que Jesus ensinou sobre o sábado?', 
            icon: BookOpen 
          },
          { 
            id: 't4',
            time: '2:10', 
            label: 'SÉRIE DE DISCURSOS:',
            title: 'Imite aqueles que apoiaram Jesus!',
            icon: BookOpen,
            noSpeaker: true,
            subitems: [
              { id: 't4_1', title: 'Os apóstolos' },
              { id: 't4_2', title: 'Muitas mulheres' }
            ]
          },
          { id: 't5', time: '2:50', title: 'Cântico 76 e anúncios', icon: Info, noSpeaker: true },
          { 
            id: 't6', 
            time: '3:00', 
            title: '“Felizes os que lavam as suas vestes compridas”', 
            icon: BookOpen 
          },
          { id: 't7', time: '3:30', title: 'Cântico 155 e oração final', icon: Music }
        ]
      }
    ]
  },
  {
    day: 'Sábado',
    title: 'SÁBADO',
    color: '#1d4ed8', // Blue
    subtitle: 'Programa do congresso de 2026 — Felicidade Eterna',
    theme: '“Há mais felicidade em dar do que em receber” — Atos 20:35',
    headerImage: 'https://cms-imgp.jw-cdn.org/img/p/1102026195/univ/art/1102026195_univ_cnt_1_lg.jpg',
    sessions: [
      {
        period: 'Manhã',
        items: [
          { id: 'sat_m0', title: 'PRESIDENTE SÁBADO MANHÃ', icon: User, isRole: true },
          { id: 'sat_m1', time: '9:20', title: 'Vídeo musical', icon: Music, noSpeaker: true },
          { id: 'sat_m2', time: '9:30', title: 'Cântico 111 e oração', icon: Music },
          { id: 'sat_m3', time: '9:40', title: '“Ele abriu a boca e começou a ensiná-los”', icon: BookOpen },
          { 
            id: 'sat_m4', 
            time: '9:50', 
            label: 'VÍDEO PRINCIPAL:', 
            title: 'A História e o Ministério de Jesus: Episódio 5', 
            subtitle: '‘Maravilhados com Seu Modo de Ensinar’', 
            icon: Calendar, 
            noSpeaker: true 
          },
          { id: 'sat_m5', time: '10:25', title: 'Cântico 89 e anúncios', icon: Info, noSpeaker: true },
          { id: 'sat_m6', time: '10:35', title: 'O que pode nos impedir de ser feliz?', icon: BookOpen },
          { id: 'sat_m7', time: '10:50', title: 'Consegue ver o princípio por trás da lei?', icon: BookOpen },
          { 
            id: 'sat_m8', 
            time: '11:15', 
            label: 'SÉRIE DE DISCURSOS:', 
            title: 'Lições da terra de Jesus', 
            icon: BookOpen, 
            noSpeaker: true, 
            subitems: [
              { id: 'sat_m8_1', title: 'Sal e luz' },
              { id: 'sat_m8_2', title: 'Plantas e animais' }
            ]
          },
          { id: 'sat_m9', time: '11:40', label: 'BATISMO:', title: '“Seu Pai, que observa em secreto, o recompensará”', icon: BookOpen },
          { id: 'sat_m10', time: '12:10', title: 'Cântico 51 e intervalo', icon: Clock, noSpeaker: true }
        ]
      },
      {
        period: 'Tarde',
        items: [
          { id: 'sat_t0', title: 'PRESIDENTE SÁBADO TARDE', icon: User, isRole: true },
          { id: 'sat_t1', time: '1:35', title: 'Vídeo musical', icon: Music, noSpeaker: true },
          { id: 'sat_t2', time: '1:45', title: 'Cântico 125 e oração', icon: Music },
          { 
            id: 'sat_t3', 
            time: '1:50', 
            label: 'SÉRIE DE DISCURSOS:', 
            title: '“Felizes . . . ”', 
            icon: BookOpen, 
            noSpeaker: true, 
            subitems: [
              { id: 'sat_t3_1', title: '“Os que têm consciência de sua necessidade espiritual”' },
              { id: 'sat_t3_2', title: '“Os que choram”' },
              { id: 'sat_t3_3', title: '“Os de temperamento brando”' },
              { id: 'sat_t3_4', title: '“Os que têm fome e sede de justiça”' },
              { id: 'sat_t3_5', title: '“Os misericordiosos”' },
              { id: 'sat_t3_6', title: '“Os puros de coração”' },
              { id: 'sat_t3_7', title: '“Os pacificadores”' },
              { id: 'sat_t3_8', title: '“Os que são perseguidos por causa da justiça”' },
              { id: 'sat_t3_9', title: '“São vocês quando as pessoas os insultam”' }
            ]
          },
          { id: 'sat_t4', time: '3:20', title: 'Cântico 81 e anúncios', icon: Info, noSpeaker: true },
          { id: 'sat_t5', time: '3:30', title: '“Por que estão ansiosos?”', icon: BookOpen },
          { id: 'sat_t6', time: '3:55', title: '“Entrem pelo portão estreito”', icon: BookOpen },
          { id: 'sat_t7', time: '4:30', title: 'Cântico 21 e oração final', icon: Music }
        ]
      }
    ]
  },
  {
    day: 'Domingo',
    title: 'DOMINGO',
    color: '#b91c1c', // Red
    subtitle: 'Programa do congresso de 2026 — Felicidade Eterna',
    theme: '“Felizes são os olhos de vocês porque veem e os seus ouvidos porque ouvem” — Mateus 13:16',
    headerImage: 'https://cms-imgp.jw-cdn.org/img/p/1102026196/univ/art/1102026196_univ_cnt_1_lg.jpg',
    sessions: [
      {
        period: 'Manhã',
        items: [
          { id: 'sun_m0', title: 'PRESIDENTE DOMINGO MANHÃ', icon: User, isRole: true },
          { id: 'sun_m1', time: '9:20', title: 'Vídeo musical', icon: Music, noSpeaker: true },
          { id: 'sun_m2', time: '9:30', title: 'Cântico 68 e oração', icon: Music },
          { 
            id: 'sun_m3', 
            time: '9:40', 
            label: 'SÉRIE DE DISCURSOS:', 
            title: 'Lições das ilustrações de Jesus', 
            icon: BookOpen, 
            noSpeaker: true, 
            subitems: [
              { id: 'sun_m3_1', title: 'Quatro tipos de solo' },
              { id: 'sun_m3_2', title: 'Trigo e joio' },
              { id: 'sun_m3_3', title: 'Grão de mostarda' },
              { id: 'sun_m3_4', title: 'Fermento' },
              { id: 'sun_m3_5', title: 'Rede de arrasto' }
            ]
          },
          { id: 'sun_m4', time: '11:00', title: 'Cântico 64 e anúncios', icon: Info, noSpeaker: true },
          { id: 'sun_m5', time: '11:10', label: 'DISCURSO PARA O PÚBLICO:', title: 'Você encontrou o tesouro! — O que vai fazer agora?', icon: BookOpen },
          { id: 'sun_m6', time: '11:40', title: 'Resumo de A Sentinela', icon: BookOpen },
          { id: 'sun_m7', time: '12:10', title: 'Cântico 140 e intervalo', icon: Clock, noSpeaker: true }
        ]
      },
      {
        period: 'Tarde',
        items: [
          { id: 'sun_t0', title: 'PRESIDENTE DOMINGO TARDE', icon: User, isRole: true },
          { id: 'sun_t1', time: '1:35', title: 'Vídeo musical', icon: Music, noSpeaker: true },
          { id: 'sun_t2', time: '1:45', title: 'Cântico 108 e oração', icon: Music },
          { 
            id: 'sun_t3', 
            time: '1:50', 
            label: 'VÍDEO PRINCIPAL:', 
            title: 'A História e o Ministério de Jesus: Episódio 6', 
            subtitle: '“O Senhor É Aquele Que Vem?”', 
            icon: Calendar, 
            noSpeaker: true 
          },
          { id: 'sun_t4', time: '2:35', title: 'Cântico 120 e anúncios', icon: Info, noSpeaker: true },
          { id: 'sun_t5', time: '2:45', title: 'O que você aprendeu?', icon: BookOpen },
          { id: 'sun_t6', time: '2:55', title: '“Felizes são os olhos de vocês porque veem”', icon: BookOpen },
          { id: 'sun_t7', time: '3:45', title: 'Cântico 163 e oração final', icon: Music }
        ]
      }
    ]
  }
];

export default function RegionalConventionView({ userId, isGuest = false, onBack }: RegionalConventionViewProps) {
  const { showAlert } = useDialog();
  const [speakers, setSpeakers] = useState<Record<string, string>>({});
  const [initialSpeakers, setInitialSpeakers] = useState<Record<string, string>>({});
  const [confirmedSpeakers, setConfirmedSpeakers] = useState<Record<string, boolean>>({});
  const [initialConfirmedSpeakers, setInitialConfirmedSpeakers] = useState<Record<string, boolean>>({});
  const [personalData, setPersonalData] = useState<any>(null);
  const [templates, setTemplates] = useState<Record<string, { content: string, updatedAt: string }>>({});
  const [details, setDetails] = useState<ConventionDetails>({
    eventDate: '',
    eventLocation: '',
    conventionTheme: '',
    trainingDate: '',
    trainingLocation: '',
    congressAssistant: '',
    congressAssistants: [],
  });
  const [initialDetails, setInitialDetails] = useState<ConventionDetails>({
    eventDate: '',
    eventLocation: '',
    conventionTheme: '',
    trainingDate: '',
    trainingLocation: '',
    congressAssistant: '',
    congressAssistants: [],
  });
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [selectedYear, setSelectedYear] = useState<string>('2026');
  const availableYears = ['2026', '2027'];
  const [viewMode, setViewMode] = useState<'responsive' | 'a4'>('responsive');
  const [activeSessionTab, setActiveSessionTab] = useState<number>(-1);
  const [zoom, setZoom] = useState<number>(80);
  const containerRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  const handleFitToScreen = () => {
    if (!containerRef.current) return;
    const containerWidth = containerRef.current.clientWidth - 48;
    const a4WidthPx = 794;
    const newZoom = Math.max(35, Math.min(150, Math.floor((containerWidth / a4WidthPx) * 100)));
    setZoom(newZoom);
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let initialDistance = 0;
    let currentZoom = zoom;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        initialDistance = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        currentZoom = zoom;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && initialDistance > 0) {
        e.preventDefault();
        const newDistance = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const factor = newDistance / initialDistance;
        const targetZoom = Math.round(Math.min(200, Math.max(35, currentZoom * factor)));
        setZoom(targetZoom);
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        initialDistance = 0;
      }
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [zoom]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  const currentDay = regionalConventionProgram[selectedDayIndex];

  const stats = useMemo(() => {
    let totalWithSpeaker = 0;
    let assignedCount = 0;
    let confirmedCount = 0;

    currentDay.sessions.forEach(session => {
      session.items.forEach(item => {
        if (item.subitems && item.subitems.length > 0) {
          item.subitems.forEach(sub => {
            totalWithSpeaker++;
            if (speakers[sub.id]?.trim()) {
              assignedCount++;
              if (confirmedSpeakers[sub.id]) confirmedCount++;
            }
          });
        } else if (!item.noSpeaker) {
          totalWithSpeaker++;
          if (speakers[item.id]?.trim()) {
            assignedCount++;
            if (confirmedSpeakers[item.id]) confirmedCount++;
          }
        }
      });
    });

    const pendingConfirmation = assignedCount - confirmedCount;
    const percentageAssigned = totalWithSpeaker > 0 ? Math.round((assignedCount / totalWithSpeaker) * 100) : 0;
    const percentageConfirmed = totalWithSpeaker > 0 ? Math.round((confirmedCount / totalWithSpeaker) * 100) : 0;

    return {
      totalWithSpeaker,
      assignedCount,
      confirmedCount,
      pendingConfirmation,
      percentageAssigned,
      percentageConfirmed
    };
  }, [currentDay, speakers, confirmedSpeakers]);
  const hasChanges = JSON.stringify(speakers) !== JSON.stringify(initialSpeakers) || 
                     JSON.stringify(confirmedSpeakers) !== JSON.stringify(initialConfirmedSpeakers) ||
                     JSON.stringify(details) !== JSON.stringify(initialDetails);

  // Alerta ao sair com alterações não salvas
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasChanges]);

  // Load data from Firestore and localStorage
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        // Fetch personal data
        const personalDocRef = doc(db, 'personal_data', userId);
        const personalSnap = await getDoc(personalDocRef);
        if (personalSnap.exists()) {
          setPersonalData(personalSnap.data());
        } else {
          const q = query(collection(db, 'personal_data'), where('userId', '==', userId), limit(1));
          const querySnapshot = await getDocs(q);
          if (!querySnapshot.empty) {
            setPersonalData(querySnapshot.docs[0].data());
          }
        }

        // Fetch templates
        const templatesSnapshot = await getDocs(collection(db, 'document_templates'));
        const fetchedTemplates: Record<string, any> = {};
        templatesSnapshot.forEach((doc) => {
          fetchedTemplates[doc.id] = doc.data();
        });
        setTemplates(fetchedTemplates);

        // 1. Try Firestore for speakers/details
        const docRef = doc(db, 'regional_convention_speakers', userId);
        const docSnap = await getDoc(docRef);
        
        let loadedSpeakers = {};
        let loadedConfirmations = {};
        let loadedDetails: ConventionDetails = {
          eventDate: '',
          eventLocation: '',
          conventionTheme: '',
          trainingDate: '',
          trainingLocation: '',
          congressAssistant: '',
          congressAssistants: [],
        };

        if (docSnap.exists()) {
          const data = docSnap.data();
          loadedSpeakers = data.speakers || {};
          loadedConfirmations = data.confirmations || {};
          loadedDetails = {
            eventDate: data.details?.eventDate || '',
            eventLocation: data.details?.eventLocation || '',
            conventionTheme: data.details?.conventionTheme || '',
            trainingDate: data.details?.trainingDate || '',
            trainingLocation: data.details?.trainingLocation || '',
            congressAssistant: data.details?.congressAssistant || '',
            congressAssistants: data.details?.congressAssistants || (data.details?.congressAssistant ? [data.details.congressAssistant] : []),
          };
        } else {
          // 2. Fallback to localStorage
          const localData = localStorage.getItem(`speakers_${userId}`);
          if (localData) {
            loadedSpeakers = JSON.parse(localData);
          }
          const localConfirmations = localStorage.getItem(`confirmations_${userId}`);
          if (localConfirmations) {
            loadedConfirmations = JSON.parse(localConfirmations);
          }
          const localDetails = localStorage.getItem(`convention_details_${userId}`);
          if (localDetails) {
            const parsed = JSON.parse(localDetails);
            loadedDetails = {
              ...parsed,
              congressAssistants: parsed.congressAssistants || (parsed.congressAssistant ? [parsed.congressAssistant] : []),
            };
          }
        }
        
        setSpeakers(loadedSpeakers);
        setInitialSpeakers(loadedSpeakers);
        setConfirmedSpeakers(loadedConfirmations);
        setInitialConfirmedSpeakers(loadedConfirmations);
        setDetails(loadedDetails);
        setInitialDetails(loadedDetails);
      } catch (error) {
        console.error('Error loading data:', error);
        // Fallback to localStorage on error
        const localData = localStorage.getItem(`speakers_${userId}`);
        if (localData) {
          const parsed = JSON.parse(localData);
          setSpeakers(parsed);
          setInitialSpeakers(parsed);
        }
        const localDetails = localStorage.getItem(`convention_details_${userId}`);
        if (localDetails) {
          const parsed = JSON.parse(localDetails);
          setDetails({
            ...parsed,
            congressAssistants: parsed.congressAssistants || (parsed.congressAssistant ? [parsed.congressAssistant] : []),
          });
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [userId]);

  // Auto-save to localStorage
  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem(`speakers_${userId}`, JSON.stringify(speakers));
      localStorage.setItem(`confirmations_${userId}`, JSON.stringify(confirmedSpeakers));
      localStorage.setItem(`convention_details_${userId}`, JSON.stringify(details));
    }
  }, [speakers, confirmedSpeakers, details, userId, isLoading]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const docRef = doc(db, 'regional_convention_speakers', userId);
      await setDoc(docRef, { 
        speakers,
        confirmations: confirmedSpeakers,
        details,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      setInitialSpeakers(speakers);
      setInitialConfirmedSpeakers(confirmedSpeakers);
      setInitialDetails(details);
      return true;
    } catch (error) {
      console.error('Error saving speakers:', error);
      handleFirestoreError(error, OperationType.WRITE, `regional_convention_speakers/${userId}`);
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleBackClick = () => {
    if (hasChanges) {
      setPendingAction(() => onBack);
      setShowConfirmModal(true);
    } else {
      onBack();
    }
  };

  const handleDayChange = (idx: number) => {
    if (hasChanges) {
      setPendingAction(() => () => setSelectedDayIndex(idx));
      setShowConfirmModal(true);
    } else {
      setSelectedDayIndex(idx);
    }
  };

  const confirmSave = async () => {
    const success = await handleSave();
    if (success) {
      setShowConfirmModal(false);
      if (pendingAction) pendingAction();
    }
  };

  const confirmDiscard = () => {
    setSpeakers(initialSpeakers);
    setConfirmedSpeakers(initialConfirmedSpeakers);
    setDetails(initialDetails);
    setShowConfirmModal(false);
    if (pendingAction) pendingAction();
  };

  const handleSpeakerChange = (id: string, value: string) => {
    setSpeakers(prev => ({ ...prev, [id]: value }));
  };

  const handleConfirmationToggle = (id: string) => {
    setConfirmedSpeakers(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const generateDocument = async (item: any, type: 'docx' | 'pdf') => {
    const speakerName = speakers[item.id];
    if (!speakerName) {
      await showAlert('Por favor, informe o nome do orador primeiro.', 'Campo Obrigatório');
      return;
    }

    // Determine which template to use
    let templateId = '';
    let designation = '';

    if (item.title.toLowerCase().includes('oração')) {
      templateId = 'cong_convite_oracao';
      if (item.title.toLowerCase().includes('final')) {
        designation = 'Oração Final';
      } else {
        designation = 'Oração Inicial';
      }
    } else if (item.isRole && item.title.includes('PRESIDENTE')) {
      templateId = 'cong_presidente_sessao';
      const session = currentDay.sessions.find(s => s.items.includes(item));
      designation = `PRESIDENTE DE SESSÃO da ${session?.period || ''}`;
    } else {
      // Fallback or general template
      templateId = 'cong_aviso_treinamentos';
      designation = item.title;
    }

    const template = templates[templateId];
    if (!template) {
      await showAlert(`Template "${templateId}" não encontrado. Por favor, carregue-o no Gerenciador de Uploads primeiro.`, 'Aviso');
      return;
    }

    setIsSaving(true); // Reusing as loading state for generation
    try {
      const binaryString = window.atob(template.content);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      const signatureImage = personalData?.signatureImage || '';
      const hasImage = Boolean(signatureImage && typeof signatureImage === 'string' && signatureImage.startsWith('data:image'));
      
      const zip = new PizZip(bytes.buffer);
      
      // Pre-process all XML files in the zip to handle Word-specific tag splitting and @TAG replacement
      const xmlFiles = zip.file(/word\/(document|header\d+|footer\d+)\.xml/);
      xmlFiles.forEach(file => {
        let xmlContent = file.asText();

        if (hasImage && !xmlContent.includes('xmlns:wp=')) {
          xmlContent = xmlContent.replace(/(<w:(?:document|hdr|ftr)[^>]*)/, (match) => {
            if (match.includes('xmlns:wp=')) return match;
            return `${match} xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape" xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas" xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"`;
          });
        }

        // Remove spell check tags that often split @TAGS
        xmlContent = xmlContent.replace(/<w:proofErr w:type="(?:spell|gram)(?:Start|End)"\/>/g, "");
        xmlContent = xmlContent.replace(/<w:noProof\/>/g, "");
        
        // Join split tags
        for (let i = 0; i < 6; i++) {
          xmlContent = xmlContent.replace(/(@|\[[#\/^>?]?)([A-Za-z0-9À-ÿ\u00C0-\u00FF\_]*)(<\/w:t>(?:<(?!w:p|w:tr|w:tbl|w:br|w:tc|w:tr)[^>]+>)*?<w:t[^>]*>)([A-Za-z0-9À-ÿ\u00C0-\u00FF\_]+|\])/g, "$1$2$4$3");
        }
        
        // Final cleaning of common split patterns
        xmlContent = xmlContent.replace(/(@[A-Za-z0-9À-ÿ\_]*)(<\/w:t><\/w:r><w:r><w:t>)/g, "$1");

        xmlContent = xmlContent.replace(/(<w:t[^>]*>)(.*?)(<\/w:t>)/g, (match: string, opening: string, text: string, closing: string) => {
          let newText = text;
          // Handle [ASSINATURA] and @Assinatura specially as an image tag
          newText = newText.replace(/\[ASSINATURA([\s\_]GLOBAL)?\]/gi, '[%ASSINATURA]');
          newText = newText.replace(/@Assinatura([\s\_]GLOBAL)?/gi, '[%ASSINATURA]');
          // Generic @TAG replacement
          newText = newText.replace(/(^|[^A-Za-z0-9À-ÿ\u00C0-\u00FF])@([A-Za-z0-9À-ÿ\_]+)/g, (m: string, p1: string, p2: string) => {
            return `${p1}[${p2.toUpperCase()}]`;
          });
          return `${opening}${newText}${closing}`;
        });
        zip.file(file.name, xmlContent);
      });

      const signatureName = personalData?.nome || '________________';
      const circuito = personalData?.circuito || '________________';
      const telefoneCircuito = personalData?.telefoneCircuito || personalData?.telefone || '________________';

      const replacements = {
        'ANO': '2026',
        'TEMA': details.conventionTheme || '________________',
        'DATA': details.eventDate || '________________',
        'LOCAL': details.eventLocation || '________________',
        'DESIGNAÇÃO': designation,
        'DESIGNACAO': designation,
        'DIA': currentDay.day.split('-')[0],
        'ORADOR': speakerName,
        'ASSINATURA': `${signatureName} (${circuito})`,
        'ASSINATURA_GLOBAL': `${signatureName} (${circuito})`,
        'ASSINATURA GLOBAL': `${signatureName} (${circuito})`,
        '%ASSINATURA': signatureImage,
        'VIAJANTE': signatureName,
        'CIRCUITO': circuito,
        'FONE': telefoneCircuito,
        'TELEFONE': telefoneCircuito,
        'DATAHORA': details.trainingDate || '________________',
        'LOCALTREINO': details.trainingLocation || '________________',
        'ASSISTENTE': details.congressAssistant || '________________',
      };

      // Set up Image Module
      const ImageModule = (await import('docxtemplater-image-module-free')).default;
      let sigWidth = 150;
      let sigHeight = 60;
      
      const isBase64Image = signatureImage && signatureImage.startsWith('data:image');
      
      if (isBase64Image) {
        const img = new window.Image();
        const promise = new Promise((resolve) => {
          img.onload = resolve;
          img.src = signatureImage;
        });
        await promise;
        const aspectRatio = img.width / img.height;
        sigHeight = 60;
        sigWidth = sigHeight * aspectRatio;
        if (sigWidth > 220) {
          sigWidth = 220;
          sigHeight = sigWidth / aspectRatio;
        }
      }

      const opts: any = {
        centered: false,
        getImage: (tagValue: string) => {
          if (!tagValue || typeof tagValue !== 'string' || !tagValue.startsWith('data:image')) return null;
          try {
            const base64Data = tagValue.split(',')[1];
            const binaryStringArray = window.atob(base64Data);
            const bytesArray = new Uint8Array(binaryStringArray.length);
            for (let i = 0; i < binaryStringArray.length; i++) {
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

      const docObj = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
        delimiters: { start: '[', end: ']' },
        modules: [new ImageModule(opts)]
      });

      docObj.render(replacements);

      const out = docObj.getZip().generate({
        type: 'blob',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });

      if (type === 'docx') {
        const url = URL.createObjectURL(out);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Carta_${speakerName.replace(/\s+/g, '_')}.docx`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        await showAlert('Dica: Para obter o PDF com máxima fidelidade e qualidade visual, utilize a aba "Cartas Congresso". Lá você poderá visualizar o documento com perfeição antes de baixar o PDF usando as ferramentas integradas do novo visualizador!', 'Dica de Qualidade');
      }
    } catch (err) {
      console.error('Error generating document:', err);
      await showAlert('Erro ao gerar documento. Verifique se os modelos estão carregados.', 'Erro');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <Loader2 size={40} className="text-primary-200 animate-spin" />
        <p className="text-typography-500 font-medium">Carregando programação...</p>
      </div>
    );
  }

  return (
    <div id="regional-convention-print-content" className="space-y-8 pb-12 print:p-0 print:space-y-4">
      {/* Print Styles */}
      {/* Print & Document Styles */}
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
          
          #regional-convention-print-content,
          #regional-convention-print-content * { 
            visibility: visible !important; 
          }
          
          #regional-convention-print-content {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 210mm !important;
            max-width: 210mm !important;
            margin: 0 !important;
            padding: 0 !important;
            display: block !important;
          }
          
          .convention-viewport,
          .convention-session-wrapper,
          .convention-scale-wrapper {
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

          .convention-a4-page { 
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
            padding: 7mm 9mm !important;
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

          .convention-session-wrapper:last-child .convention-a4-page,
          .convention-a4-page:last-child,
          .convention-a4-page:last-of-type {
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

          .convention-a4-page .session-items-container > * + * {
            margin-top: 3px !important;
          }

          .convention-a4-page input {
            border: none !important;
            background: transparent !important;
            padding: 0 !important;
            margin: 0 !important;
            color: #111827 !important;
            max-width: 100% !important;
            line-height: 1.25 !important;
            height: auto !important;
          }
        }
      `}</style>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-3xl bg-surface-100 border border-surface-300 shadow-xs no-print">
        <div className="flex items-center gap-4 flex-wrap sm:flex-nowrap">
          <button 
            onClick={handleBackClick}
            className="p-2 sm:p-2.5 hover:bg-surface-200 rounded-full transition-all text-primary-200 bg-surface-200/50 shadow-xs border border-surface-300 cursor-pointer active:scale-95 shrink-0"
            title="Voltar ao Painel"
          >
            <ChevronLeft size={20} strokeWidth={2.5} />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-lg sm:text-xl font-black text-typography-900 leading-tight">
                Congresso Regional
              </h2>
              <CustomSelect
                value={selectedYear}
                onChange={(val) => setSelectedYear(val)}
                options={availableYears}
                size="sm"
                className="w-28"
              />
              {isGuest && (
                <span className="text-primary-200 text-[10px] font-black bg-primary-200/10 border border-primary-200/20 px-2 py-0.5 rounded-full uppercase">
                  Assistente
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-2 overflow-x-auto scrollbar-hide pb-0.5">
              {regionalConventionProgram.map((day, idx) => (
                <button
                  key={idx}
                  onClick={() => handleDayChange(idx)}
                  className={`text-xs font-bold transition-all px-3 py-1 rounded-xl whitespace-nowrap shrink-0 cursor-pointer ${
                    selectedDayIndex === idx 
                      ? 'bg-primary-200 text-white shadow-xs' 
                      : 'text-typography-600 hover:text-typography-900 hover:bg-surface-200'
                  }`}
                >
                  {day.day}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 self-start sm:self-center shrink-0 flex-wrap">
          {/* Alternador de Modo de Exibição: Tabela vs Lista */}
          <div className="flex items-center bg-surface-200 p-1 rounded-2xl border border-surface-300/80 shadow-2xs">
            <button
              onClick={() => setViewMode('a4')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'a4'
                  ? 'bg-primary-200 text-white shadow-xs'
                  : 'text-typography-500 hover:text-typography-900'
              }`}
              title="Modo Tabela"
            >
              <TableIcon size={14} />
              <span>Tabela</span>
            </button>
            <button
              onClick={() => setViewMode('responsive')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'responsive'
                  ? 'bg-primary-200 text-white shadow-xs'
                  : 'text-typography-500 hover:text-typography-900'
              }`}
              title="Modo Lista"
            >
              <LayoutList size={14} />
              <span>Lista</span>
            </button>
          </div>

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-surface-200 hover:bg-surface-300 text-typography-700 rounded-xl shadow-xs border border-surface-300 transition-all cursor-pointer"
            title="Imprimir Folha A4 Oficial"
          >
            <Printer size={15} className="text-typography-500" />
            <span className="font-bold text-xs uppercase tracking-wider">Imprimir</span>
          </button>
        </div>
      </div>

      {/* Barra de Zoom da Folha A4 (Disponível quando no Modo Folha A4) */}
      {viewMode === 'a4' && (
        <div className="no-print flex items-center justify-end gap-2 p-2 bg-slate-900 text-white rounded-2xl shadow-md flex-wrap">
          <div className="flex items-center gap-1.5 shrink-0 ml-auto flex-wrap">
            <button
              onClick={() => setZoom(prev => Math.max(35, prev - 10))}
              className="p-1.5 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg transition-colors cursor-pointer"
              title="Reduzir zoom (-10%)"
              aria-label="Reduzir zoom"
            >
              <ZoomOut size={16} />
            </button>

            <div className="flex items-center bg-slate-800 rounded-lg p-0.5">
              {[60, 80, 100, 125].map(preset => (
                <button
                  key={preset}
                  onClick={() => setZoom(preset)}
                  className={`px-2 py-1 text-[11px] font-bold rounded-md transition-all cursor-pointer ${
                    zoom === preset ? 'bg-primary-200 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {preset}%
                </button>
              ))}
            </div>

            <button
              onClick={() => setZoom(prev => Math.min(200, prev + 10))}
              className="p-1.5 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg transition-colors cursor-pointer"
              title="Aumentar zoom (+10%)"
              aria-label="Aumentar zoom"
            >
              <ZoomIn size={16} />
            </button>

            <button
              onClick={handleFitToScreen}
              className="px-2.5 py-1 text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
              title="Ajustar documento à largura da tela"
            >
              <Maximize2 size={13} />
              <span className="hidden sm:inline">Ajustar</span>
            </button>
          </div>
        </div>
      )}

      {/* MODO PAINEL RESPONSIVO (PARA CELULAR, TABLET E COMPUTADORES MODERNOS) */}
      {viewMode === 'responsive' && (
        <div className="no-print space-y-6">
          {/* Hero Card com Tema e Metadados do Dia */}
          <div className="relative rounded-3xl overflow-hidden bg-surface-100 border border-surface-300 shadow-xs p-5 sm:p-7 space-y-5">
            {/* Background Artwork */}
            {currentDay.headerImage && (
              <div className="absolute inset-0 z-0 pointer-events-none opacity-20 dark:opacity-25 overflow-hidden">
                <img
                  src={currentDay.headerImage}
                  alt={currentDay.title}
                  className="w-full h-full object-cover"
                  style={{ objectPosition: 'center 33%' }}
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-surface-100 via-surface-100/80 to-transparent" />
              </div>
            )}

            <div className="relative z-10 space-y-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <span 
                  className="text-[11px] font-black uppercase tracking-widest px-3 py-1 rounded-full border shadow-2xs"
                  style={{ 
                    color: currentDay.color, 
                    backgroundColor: `${currentDay.color}15`,
                    borderColor: `${currentDay.color}30`
                  }}
                >
                  {currentDay.title} • {details.conventionTheme || currentDay.subtitle}
                </span>

                <button
                  onClick={() => setShowDetails(!showDetails)}
                  className="text-xs font-bold text-typography-700 hover:text-typography-900 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-200 hover:bg-surface-300 transition-colors cursor-pointer border border-surface-300"
                >
                  {showDetails ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  <span>{showDetails ? 'Ocultar Detalhes' : 'Editar Dados do Evento'}</span>
                </button>
              </div>

              {/* Tema Principal do Dia */}
              <div className="space-y-1">
                <h2 className="text-lg sm:text-2xl font-black text-typography-900 tracking-tight leading-tight">
                  {currentDay.theme}
                </h2>
                <p className="text-xs sm:text-sm text-typography-500 font-medium">
                  {currentDay.subtitle}
                </p>
              </div>

              {/* Metadados: Data, Local, Assistentes, Treinamento */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-2 border-t border-surface-300/70">
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-surface-200/50 border border-surface-300/60 text-xs">
                  <Calendar size={15} className="text-primary-200 shrink-0" />
                  <div className="min-w-0">
                    <span className="block text-[10px] uppercase font-bold text-typography-400">Data</span>
                    <span className="font-bold text-typography-900 truncate block">
                      {details.eventDate || 'A definir'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-surface-200/50 border border-surface-300/60 text-xs">
                  <MapPin size={15} className="text-primary-200 shrink-0" />
                  <div className="min-w-0">
                    <span className="block text-[10px] uppercase font-bold text-typography-400">Local</span>
                    <span className="font-bold text-typography-900 truncate block">
                      {details.eventLocation || 'A definir'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-surface-200/50 border border-surface-300/60 text-xs">
                  <User size={15} className="text-primary-200 shrink-0" />
                  <div className="min-w-0">
                    <span className="block text-[10px] uppercase font-bold text-typography-400">Assistente(s)</span>
                    <span className="font-bold text-typography-900 truncate block">
                      {details.congressAssistant || 'A definir'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-surface-200/50 border border-surface-300/60 text-xs">
                  <Clock size={15} className="text-primary-200 shrink-0" />
                  <div className="min-w-0">
                    <span className="block text-[10px] uppercase font-bold text-typography-400">Treinamento</span>
                    <span className="font-bold text-typography-900 truncate block">
                      {details.trainingDate || 'A definir'}
                    </span>
                  </div>
                </div>
              </div>

              {/* KPIs de Progresso */}
              <div className="grid grid-cols-3 gap-2 pt-2">
                <div className="p-3 rounded-2xl bg-surface-200/70 border border-surface-300/70 text-center">
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

                <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center">
                  <span className="text-[10px] uppercase font-black tracking-wider text-emerald-600 dark:text-emerald-400 block mb-0.5">
                    Confirmados
                  </span>
                  <div className="text-base sm:text-xl font-black text-emerald-700 dark:text-emerald-400">
                    {stats.confirmedCount}
                  </div>
                  <div className="w-full bg-emerald-500/20 h-1.5 rounded-full mt-1.5 overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${stats.percentageConfirmed}%` }}
                    />
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-center">
                  <span className="text-[10px] uppercase font-black tracking-wider text-amber-600 dark:text-amber-400 block mb-0.5">
                    Pendentes
                  </span>
                  <div className="text-base sm:text-xl font-black text-amber-700 dark:text-amber-400">
                    {stats.pendingConfirmation}
                  </div>
                  <div className="w-full bg-amber-500/20 h-1.5 rounded-full mt-1.5 overflow-hidden">
                    <div
                      className="bg-amber-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${stats.totalWithSpeaker > 0 ? (stats.pendingConfirmation / stats.totalWithSpeaker) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Abas de Navegação entre Sessões (Manhã / Tarde) */}
          <div className="flex items-center gap-2 p-1.5 bg-surface-100 rounded-2xl border border-surface-300 overflow-x-auto">
            {currentDay.sessions.map((session, sIdx) => {
              const isActive = activeSessionTab === sIdx;
              return (
                <button
                  key={session.period || sIdx}
                  onClick={() => setActiveSessionTab(sIdx)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'bg-primary-200 text-white shadow-xs'
                      : 'text-typography-600 hover:text-typography-900 hover:bg-surface-200'
                  }`}
                >
                  <span>Sessão da {session.period}</span>
                  <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${
                    isActive ? 'bg-white/20 text-white' : 'bg-surface-200 text-typography-500'
                  }`}>
                    {session.items.length} itens
                  </span>
                </button>
              );
            })}

            <button
              onClick={() => setActiveSessionTab(-1)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ml-auto ${
                activeSessionTab === -1
                  ? 'bg-primary-200 text-white shadow-xs'
                  : 'text-typography-600 hover:text-typography-900 hover:bg-surface-200'
              }`}
            >
              <span>Ver Dia Completo</span>
            </button>
          </div>

          {/* Lista de Partes por Sessão em Cards Responsivos */}
          <div className="space-y-6">
            {currentDay.sessions
              .filter((_, idx) => activeSessionTab === -1 || activeSessionTab === idx)
              .map((session, sIdx) => (
                <div key={`resp-session-${session.period || sIdx}`} className="space-y-3">
                  <div className="flex items-center gap-2 px-1">
                    <span 
                      className="w-2.5 h-2.5 rounded-full shrink-0" 
                      style={{ backgroundColor: currentDay.color }}
                    />
                    <h3 className="text-sm font-black text-typography-900 uppercase tracking-wider">
                      Sessão da {session.period}
                    </h3>
                  </div>

                  <div className="space-y-3">
                    {session.items.map((item, itemIdx) => {
                      const isSymposium = item.subitems && item.subitems.length > 0;
                      const hasSpeaker = !item.noSpeaker;
                      const speakerName = speakers[item.id] || '';
                      const isConfirmed = !!confirmedSpeakers[item.id];

                      {/* Simpósio / Série de Discursos */}
                      if (isSymposium) {
                        return (
                          <div
                            key={`resp-item-${item.id || itemIdx}`}
                            className="p-4 sm:p-5 rounded-3xl bg-surface-100 border-2 shadow-2xs space-y-4"
                            style={{ borderColor: `${currentDay.color}35` }}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span 
                                    className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border shadow-2xs"
                                    style={{ 
                                      color: currentDay.color, 
                                      backgroundColor: `${currentDay.color}15`,
                                      borderColor: `${currentDay.color}30` 
                                    }}
                                  >
                                    {item.label || 'SÉRIE DE DISCURSOS'}
                                  </span>
                                  {item.time && (
                                    <span className="text-xs font-mono font-bold text-typography-500">
                                      {item.time}
                                    </span>
                                  )}
                                </div>
                                <h4 className="text-sm sm:text-base font-black text-typography-900 leading-snug">
                                  {item.title}
                                </h4>
                              </div>
                            </div>

                            {/* Subpartes do Simpósio */}
                            <div className="space-y-3 pt-1">
                              {item.subitems?.map((sub, subIdx) => {
                                const subSpeaker = speakers[sub.id] || '';
                                const subConfirmed = !!confirmedSpeakers[sub.id];

                                return (
                                  <div
                                    key={`resp-sub-${sub.id || subIdx}`}
                                    className="p-3.5 rounded-2xl bg-surface-200/50 border border-surface-300 space-y-3 transition-colors hover:border-surface-400"
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="flex items-center gap-2">
                                        <span 
                                          className="w-5 h-5 rounded-full font-bold text-[10px] flex items-center justify-center shrink-0"
                                          style={{ 
                                            backgroundColor: `${currentDay.color}20`,
                                            color: currentDay.color 
                                          }}
                                        >
                                          {subIdx + 1}
                                        </span>
                                        <span className="text-xs font-bold text-typography-900">
                                          {sub.title}
                                        </span>
                                      </div>
                                    </div>

                                    {/* Campo do Orador */}
                                    <div>
                                      <label className="block text-[10px] uppercase font-bold text-typography-500 mb-1">
                                        Orador
                                      </label>
                                      <input
                                        type="text"
                                        value={subSpeaker}
                                        disabled={isGuest}
                                        onChange={(e) => handleSpeakerChange(sub.id, e.target.value)}
                                        placeholder="Nome do orador..."
                                        className="w-full h-9 px-3 rounded-xl bg-surface-100 border border-surface-300 text-xs font-bold text-typography-900 focus:outline-none focus:ring-2 focus:ring-primary-200/40 disabled:opacity-60"
                                      />
                                    </div>

                                    {/* Ações: Confirmação e Carta */}
                                    <div className="flex items-center justify-between pt-1 border-t border-surface-300/50">
                                      <button
                                        onClick={() => !isGuest && handleConfirmationToggle(sub.id)}
                                        disabled={isGuest}
                                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                          subConfirmed
                                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                            : 'bg-surface-200 text-typography-500 hover:text-typography-700 border border-surface-300'
                                        } disabled:opacity-60 disabled:cursor-not-allowed`}
                                      >
                                        {subConfirmed ? <CheckCircle2 size={13} /> : <Circle size={13} />}
                                        <span>{subConfirmed ? 'Confirmado' : 'Marcar Confirmado'}</span>
                                      </button>

                                      <button
                                        onClick={() => generateDocument(sub, 'docx')}
                                        disabled={!subSpeaker.trim()}
                                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold text-primary-200 bg-primary-200/10 hover:bg-primary-200/20 border border-primary-200/20 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                        title="Baixar carta em .docx"
                                      >
                                        <FileDown size={13} />
                                        <span>Gerar Carta</span>
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      }

                      {/* Discurso com Orador */}
                      if (hasSpeaker) {
                        return (
                          <div
                            key={`resp-item-${item.id || itemIdx}`}
                            className={`p-4 rounded-3xl bg-surface-100 border border-surface-300 shadow-2xs space-y-3.5 transition-all ${
                              isConfirmed ? 'ring-1 ring-emerald-500/30' : ''
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-2 flex-wrap">
                                  {item.time && (
                                    <span className="text-xs font-mono font-bold text-typography-500">
                                      {item.time}
                                    </span>
                                  )}
                                  {item.label && (
                                    <span 
                                      className="px-2 py-0.5 rounded text-[10px] font-bold border"
                                      style={{ 
                                        color: currentDay.color, 
                                        backgroundColor: `${currentDay.color}15`,
                                        borderColor: `${currentDay.color}25`
                                      }}
                                    >
                                      {item.label}
                                    </span>
                                  )}
                                  {item.isRole && (
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-violet-500/10 text-violet-700 dark:text-violet-300 border border-violet-500/20">
                                      PRESIDENTE DE SESSÃO
                                    </span>
                                  )}
                                </div>
                                <h4 className="text-sm font-black text-typography-900 leading-snug">
                                  {item.title}
                                </h4>
                                {item.subtitle && (
                                  <p className="text-xs text-typography-500 italic font-medium">
                                    {item.subtitle}
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* Campo do Orador */}
                            <div>
                              <label className="block text-[10px] uppercase font-bold text-typography-500 mb-1">
                                Orador
                              </label>
                              <input
                                type="text"
                                value={speakerName}
                                disabled={isGuest}
                                onChange={(e) => handleSpeakerChange(item.id, e.target.value)}
                                placeholder="Nome do orador..."
                                className="w-full h-9 px-3 rounded-xl bg-surface-200/50 border border-surface-300 text-xs font-bold text-typography-900 focus:outline-none focus:ring-2 focus:ring-primary-200/40 disabled:opacity-60"
                              />
                            </div>

                            {/* Ações */}
                            <div className="flex items-center justify-between pt-1 border-t border-surface-300/50">
                              <button
                                onClick={() => !isGuest && handleConfirmationToggle(item.id)}
                                disabled={isGuest}
                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                  isConfirmed
                                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                    : 'bg-surface-200 text-typography-500 hover:text-typography-700 border border-surface-300'
                                } disabled:opacity-60 disabled:cursor-not-allowed`}
                              >
                                {isConfirmed ? <CheckCircle2 size={13} /> : <Circle size={13} />}
                                <span>{isConfirmed ? 'Confirmado' : 'Marcar Confirmado'}</span>
                              </button>

                              <button
                                onClick={() => generateDocument(item, 'docx')}
                                disabled={!speakerName.trim()}
                                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold text-primary-200 bg-primary-200/10 hover:bg-primary-200/20 border border-primary-200/20 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                title="Baixar carta em .docx"
                              >
                                <FileDown size={13} />
                                <span>Gerar Carta</span>
                              </button>
                            </div>
                          </div>
                        );
                      }

                      {/* Item Sem Orador (Vídeo, Cântico, Intervalo) */}
                      return (
                        <div
                          key={`resp-item-${item.id || itemIdx}`}
                          className="p-3 sm:p-3.5 rounded-2xl bg-surface-200/50 border border-surface-300 flex items-center justify-between gap-3 text-xs text-typography-600 font-medium"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {item.icon && <item.icon size={15} className="text-typography-400 shrink-0" />}
                            <div className="min-w-0">
                              <span className="font-bold text-typography-800 block truncate">
                                {item.title}
                              </span>
                              {item.subtitle && (
                                <span className="text-[11px] text-typography-500 italic block truncate">
                                  {item.subtitle}
                                </span>
                              )}
                            </div>
                          </div>
                          {item.time && (
                            <span className="px-2 py-0.5 rounded-md bg-surface-300 text-typography-700 text-[11px] font-mono font-bold shrink-0">
                              {item.time}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}



      {/* Convention General Info Inputs (disponível quando showDetails estiver ativo em ambos os modos) */}
      <AnimatePresence>
        {showDetails && (
          <motion.div 
            initial={{ opacity: 0, height: 0, marginTop: 0 }}
            animate={{ opacity: 1, height: 'auto', marginTop: 0 }}
            exit={{ opacity: 0, height: 0, marginTop: 0 }}
            className="overflow-hidden no-print"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4">
              <div className="bg-surface-100 p-6 rounded-3xl border border-surface-300 shadow-sm space-y-4">
                <h3 className="text-sm font-black text-primary-200 uppercase tracking-widest flex items-center gap-2">
                  <Landmark size={18} />
                  Dados do Congresso
                </h3>
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-typography-400 uppercase tracking-widest ml-1">Tema do Congresso</label>
                    <input 
                      type="text" 
                      placeholder="Ex: 'Felicidade Eterna'"
                      value={details.conventionTheme}
                      disabled={isGuest}
                      onChange={(e) => setDetails(prev => ({ ...prev, conventionTheme: e.target.value }))}
                      className="w-full px-4 py-3 bg-surface-200 border border-surface-300 rounded-2xl text-sm font-bold text-typography-900 focus:bg-surface-100 outline-none transition-all placeholder:text-typography-400 disabled:opacity-60"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-typography-400 uppercase tracking-widest ml-1">Data do Evento</label>
                    <input 
                      type="text" 
                      placeholder="Ex: 12-14 de Junho, 2026"
                      value={details.eventDate}
                      disabled={isGuest}
                      onChange={(e) => setDetails(prev => ({ ...prev, eventDate: e.target.value }))}
                      className="w-full px-4 py-3 bg-surface-200 border border-surface-300 rounded-2xl text-sm font-bold text-typography-900 focus:bg-surface-100 outline-none transition-all placeholder:text-typography-400 disabled:opacity-60"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-typography-400 uppercase tracking-widest ml-1">Local (Endereço)</label>
                    <input 
                      type="text" 
                      placeholder="Ex: Ginásio do Ibirapuera, São Paulo"
                      value={details.eventLocation}
                      disabled={isGuest}
                      onChange={(e) => setDetails(prev => ({ ...prev, eventLocation: e.target.value }))}
                      className="w-full px-4 py-3 bg-surface-200 border border-surface-300 rounded-2xl text-sm font-bold text-typography-900 focus:bg-surface-100 outline-none transition-all placeholder:text-typography-400 disabled:opacity-60"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-typography-400 uppercase tracking-widest ml-1">Assistente(s) do Presidente do congresso</label>
                    <div className="space-y-2">
                      {((details.congressAssistants && details.congressAssistants.length > 0) ? details.congressAssistants : [details.congressAssistant || '']).map((asst, index) => (
                        <div key={index} className="flex gap-2 items-center">
                          <input 
                            type="text" 
                            placeholder={`Nome do Assistente ${index + 1}`}
                            value={asst}
                            disabled={isGuest}
                            onChange={(e) => {
                              const currentList = [...((details.congressAssistants && details.congressAssistants.length > 0) ? details.congressAssistants : [details.congressAssistant || ''])];
                              currentList[index] = e.target.value;
                              
                              const filteredList = currentList.filter(n => n.trim() !== '');
                              let formattedString = '';
                              if (filteredList.length === 1) formattedString = filteredList[0];
                              else if (filteredList.length > 1) {
                                const allButLast = filteredList.slice(0, -1).join(', ');
                                formattedString = `${allButLast} e ${filteredList[filteredList.length - 1]}`;
                              }

                              setDetails(prev => ({
                                ...prev,
                                congressAssistants: currentList,
                                congressAssistant: formattedString
                              }));
                            }}
                            className="flex-1 px-4 py-3 bg-surface-200 border border-surface-300 rounded-2xl text-sm font-bold text-typography-900 focus:bg-surface-100 outline-none transition-all placeholder:text-typography-400 disabled:opacity-60"
                          />
                          {!isGuest && (
                            <button
                              type="button"
                              onClick={() => {
                                const currentList = [...((details.congressAssistants && details.congressAssistants.length > 0) ? details.congressAssistants : [details.congressAssistant || ''])];
                                if (currentList.length <= 1) {
                                  setDetails(prev => ({
                                    ...prev,
                                    congressAssistants: [''],
                                    congressAssistant: ''
                                  }));
                                } else {
                                  const newList = currentList.filter((_, i) => i !== index);
                                  const filteredList = newList.filter(n => n.trim() !== '');
                                  let formattedString = '';
                                  if (filteredList.length === 1) formattedString = filteredList[0];
                                  else if (filteredList.length > 1) {
                                    const allButLast = filteredList.slice(0, -1).join(', ');
                                    formattedString = `${allButLast} e ${filteredList[filteredList.length - 1]}`;
                                  }
                                  setDetails(prev => ({
                                    ...prev,
                                    congressAssistants: newList,
                                    congressAssistant: formattedString
                                  }));
                                }
                              }}
                              className="p-3 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-2xl transition-all cursor-pointer"
                              title="Remover"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      ))}
                      {!isGuest && (
                        <button
                          type="button"
                          onClick={() => {
                            const currentList = [...((details.congressAssistants && details.congressAssistants.length > 0) ? details.congressAssistants : [details.congressAssistant || ''])];
                            setDetails(prev => ({
                              ...prev,
                              congressAssistants: [...currentList, '']
                            }));
                          }}
                          className="w-full py-2.5 bg-primary-200/10 text-primary-200 hover:bg-primary-200/20 text-xs font-black uppercase tracking-wider rounded-2xl transition-all flex items-center justify-center gap-2 border border-dashed border-primary-200/30 cursor-pointer"
                        >
                          <Plus size={14} />
                          Adicionar Novo Assistente
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-surface-100 p-6 rounded-3xl border border-surface-300 shadow-sm space-y-4">
                <h3 className="text-sm font-black text-violet-600 dark:text-violet-400 uppercase tracking-widest flex items-center gap-2">
                  <BookOpen size={18} />
                  Treinamento
                </h3>
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-typography-400 uppercase tracking-widest ml-1">Data do Treinamento</label>
                    <input 
                      type="text" 
                      placeholder="Ex: 15 de Maio, 2026"
                      value={details.trainingDate}
                      disabled={isGuest}
                      onChange={(e) => setDetails(prev => ({ ...prev, trainingDate: e.target.value }))}
                      className="w-full px-4 py-3 bg-surface-200 border border-surface-300 rounded-2xl text-sm font-bold text-typography-900 focus:bg-surface-100 outline-none transition-all placeholder:text-typography-400 disabled:opacity-60"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-typography-400 uppercase tracking-widest ml-1">Local do Treinamento</label>
                    <input 
                      type="text" 
                      placeholder="Ex: Salão do Reino Central"
                      value={details.trainingLocation}
                      disabled={isGuest}
                      onChange={(e) => setDetails(prev => ({ ...prev, trainingLocation: e.target.value }))}
                      className="w-full px-4 py-3 bg-surface-200 border border-surface-300 rounded-2xl text-sm font-bold text-typography-900 focus:bg-surface-100 outline-none transition-all placeholder:text-typography-400 disabled:opacity-60"
                    />
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Visualizador de Folha A4 Digital (No modo A4 na tela, e SEMPRE visível no print) */}
      <div 
        ref={containerRef}
        className={`convention-viewport w-full overflow-x-auto overflow-y-auto bg-slate-200/80 dark:bg-slate-900/80 rounded-3xl p-3 sm:p-6 lg:p-8 flex-col items-center gap-8 shadow-inner custom-scrollbar relative border border-slate-300/80 dark:border-slate-800 ${
          viewMode === 'a4' ? 'flex' : 'hidden print:flex'
        }`}
        style={{
          minHeight: viewMode === 'a4' ? '400px' : '0',
          touchAction: 'pan-x pan-y',
        }}
      >
        {/* Renderiza 2 Páginas Físicas A4 por Dia: Página 1 = Manhã, Página 2 = Tarde */}
        {currentDay.sessions.map((session, pageIdx) => {
          const pageNum = pageIdx + 1;
          const totalPages = currentDay.sessions.length;

          return (
            <div key={`session-${session.period}-${pageIdx}`} className="convention-session-wrapper flex flex-col items-center w-full">
              {/* Screen-only Page Divider Pill */}
              <div className="no-print mb-2.5 px-3 py-1 bg-slate-800 text-slate-200 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-sm border border-slate-700">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: currentDay.color }}></span>
                <span>Página {pageNum} de {totalPages} • Sessão da {session.period} ({currentDay.day})</span>
              </div>

              {/* Scaled Document Wrapper — Rigid Proportional A4 Model */}
              <div 
                className="convention-scale-wrapper mx-auto shrink-0 relative transition-all duration-150"
                style={{
                  width: `${(210 * zoom) / 100}mm`,
                  minWidth: `${(210 * zoom) / 100}mm`,
                  height: `${(297 * zoom) / 100}mm`,
                  minHeight: `${(297 * zoom) / 100}mm`,
                }}
              >
                {/* Physical A4 Sheet Container (210mm x 297mm) */}
                <div 
                  id={`regional-convention-a4-page-${pageNum}`}
                  ref={pageIdx === 0 ? sheetRef : undefined}
                  className="convention-a4-page bg-white text-slate-900 shadow-2xl rounded-sm ring-1 ring-black/10 print:ring-0 print:shadow-none print:border-none print:m-0 flex flex-col justify-between box-border select-text"
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
                    padding: '7mm 9mm',
                    boxSizing: 'border-box',
                    overflow: 'hidden',
                    transform: `scale(${zoom / 100})`,
                    transformOrigin: 'top left',
                    transition: 'transform 0.15s ease-out',
                  }}
                >
                  {/* Top Content Block: Header + Session Items */}
                  <div className="flex flex-col flex-1 min-h-0">
                    {/* Header Banner com Artwork oficial e Metadados do Congresso */}
                    <div className="relative w-full rounded-2xl overflow-hidden mb-2.5 shadow-md border border-slate-300/80 bg-slate-950 text-white shrink-0">
                      {currentDay.headerImage ? (
                        <div className="absolute inset-0 z-0">
                          <img 
                            src={currentDay.headerImage} 
                            alt={currentDay.title}
                            className="w-full h-full object-cover"
                            style={{ objectPosition: 'center 33%' }}
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/80 to-slate-950/45" />
                        </div>
                      ) : (
                        <div className="absolute inset-0 z-0 bg-gradient-to-br from-slate-950 via-slate-900 to-amber-950" />
                      )}

                      <div className="relative z-10 p-3 flex flex-col justify-between min-h-[35mm]">
                        {/* Top Bar: Identificação e Dia */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-[7.5pt] font-black uppercase tracking-widest text-white/90 drop-shadow-sm flex items-center gap-1.5 min-w-0">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: currentDay.color }}></span>
                            <span className="truncate">CONGRESSO REGIONAL {selectedYear}</span>
                          </div>
                          <span 
                            className="text-[7.5pt] font-black uppercase tracking-wider text-white px-3 py-0.5 rounded-full shadow-sm shrink-0 border border-white/20"
                            style={{ backgroundColor: currentDay.color }}
                          >
                            {currentDay.title}
                          </span>
                        </div>

                        {/* Theme Typography */}
                        <div className="my-1 space-y-0.5">
                          <div className="text-[12pt] font-black uppercase tracking-tight text-white drop-shadow-md leading-tight">
                            {details.conventionTheme || 'Declare as Boas Novas!'}
                          </div>
                          <div className="text-[7.5pt] italic text-white/85 line-clamp-1 drop-shadow-sm">
                            {currentDay.theme}
                          </div>
                        </div>

                        {/* Bottom Metadata Strip */}
                        <div className="flex items-center justify-between gap-2 pt-1 flex-wrap border-t border-white/15">
                          <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1">
                            <div className="flex items-center gap-1.5 text-[7.5pt] font-bold uppercase tracking-wider text-white drop-shadow-sm">
                              <CalendarDays size={12} className="text-white/80 shrink-0" />
                              <span>{details.eventDate || 'Data a definir'}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-[7.5pt] font-bold uppercase tracking-wider text-white drop-shadow-sm">
                              <MapPin size={12} className="text-white/80 shrink-0" />
                              <span>{details.eventLocation || 'Local a definir'}</span>
                            </div>
                            {details.congressAssistant && (
                              <div className="flex items-center gap-1.5 text-[7.5pt] font-bold uppercase tracking-wider text-amber-200 drop-shadow-sm">
                                <UserCheck size={12} className="text-amber-400 shrink-0" />
                                <span>Assistente: {details.congressAssistant}</span>
                              </div>
                            )}
                          </div>

                          <button
                            onClick={() => setShowDetails(prev => !prev)}
                            className="no-print text-[7pt] font-bold text-white hover:text-amber-200 flex items-center gap-1 cursor-pointer bg-white/15 hover:bg-white/25 px-2 py-0.5 rounded-lg transition-all ml-auto drop-shadow-sm border border-white/15 active:scale-95"
                            title="Editar informações do evento"
                          >
                            <Edit3 size={11} />
                            <span>{showDetails ? 'Ocultar' : 'Editar Dados'}</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Session Content for this Page */}
                    <div className="flex flex-col flex-1 min-h-0">
                      {/* Session Header Bar */}
                      <div 
                        className="flex items-center justify-between px-3 py-1 bg-gradient-to-r rounded-r-lg mb-1.5"
                        style={{
                          borderLeft: `4px solid ${currentDay.color}`,
                          background: `linear-gradient(to right, ${currentDay.color}18, ${currentDay.color}05, transparent)`
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: currentDay.color }}></span>
                          <h3 className="text-[9.5pt] font-black tracking-wider uppercase" style={{ color: currentDay.color }}>
                            SESSÃO DA {session.period.toUpperCase()}
                          </h3>
                        </div>
                        <span className="text-[6.5pt] font-bold tracking-wider uppercase text-slate-500">
                          HORÁRIO • PROGRAMA • ORADOR
                        </span>
                      </div>

                      {/* Session Items List */}
                      <div className="space-y-1 flex-1 session-items-container">
                        {session.items.map((item, itemIdx) => {
                          const isSymposium = item.subitems && item.subitems.length > 0;
                          const hasSpeaker = !item.noSpeaker || item.isRole;

                          if (isSymposium) {
                            return (
                              <div 
                                key={`item-${item.id || itemIdx}-${itemIdx}`} 
                                className="rounded-xl p-2 border my-1 session-item-row shadow-2xs"
                                style={{
                                  backgroundColor: `${currentDay.color}08`,
                                  borderColor: `${currentDay.color}30`
                                }}
                              >
                                {/* Symposium Header Row */}
                                <div className="flex items-start gap-2 mb-1">
                                  <span className="text-[8pt] font-black w-10 shrink-0 mt-0.5" style={{ color: currentDay.color }}>
                                    {item.time || ''}
                                  </span>
                                  <div className="flex-1 min-w-0">
                                    <span 
                                      className="text-[6.5pt] font-black uppercase tracking-wider mr-1.5 inline-block leading-tight px-1.5 py-0.2 rounded"
                                      style={{ backgroundColor: `${currentDay.color}20`, color: currentDay.color }}
                                    >
                                      {item.label || 'SÉRIE DE DISCURSOS:'}
                                    </span>
                                    <span className="text-[8.5pt] font-black text-gray-950 leading-tight">
                                      {item.title}
                                    </span>
                                  </div>
                                </div>

                                {/* Symposium Subitems */}
                                <div 
                                  className="ml-10 border-l-2 pl-2 space-y-1 mt-1"
                                  style={{ borderColor: `${currentDay.color}50` }}
                                >
                                  {item.subitems.map((sub, idx) => {
                                    const subSpeaker = speakers[sub.id] || '';
                                    const isConfirmed = !!confirmedSpeakers[sub.id];

                                    return (
                                      <div key={`sub-${sub.id || idx}-${itemIdx}-${idx}`} className="border-b border-gray-100 pb-1 last:border-b-0">
                                        <div className="flex items-center justify-between gap-1.5">
                                          <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                            <span 
                                              className="w-4 h-4 rounded-full font-black text-[7pt] flex items-center justify-center shrink-0"
                                              style={{ backgroundColor: `${currentDay.color}25`, color: currentDay.color }}
                                            >
                                              {idx + 1}
                                            </span>
                                            <span className="text-[8pt] font-bold text-gray-900 leading-tight flex-1 truncate">
                                              {sub.title}
                                            </span>
                                          </div>

                                          {/* Speaker Input & Print Display */}
                                          <div className="w-56 shrink-0 relative flex items-center">
                                            <input 
                                              type="text"
                                              placeholder="Nome do orador..."
                                              value={subSpeaker}
                                              disabled={isGuest}
                                              onChange={(e) => handleSpeakerChange(sub.id, e.target.value)}
                                              className={`w-full text-[8pt] font-bold text-gray-900 bg-transparent border-b border-gray-200 focus:border-primary-200 px-1 rounded-t-sm outline-none placeholder:text-gray-300 transition-colors ${!subSpeaker ? 'print:hidden' : ''}`}
                                            />
                                            {!subSpeaker && (
                                              <div className="hidden print:flex items-baseline w-full text-[7.5pt] text-gray-500 font-normal">
                                                <span className="text-[6.5pt] font-semibold text-gray-400 mr-1 shrink-0">Orador:</span>
                                                <span className="flex-1 border-b border-dotted border-gray-400 pb-0.5">&nbsp;</span>
                                              </div>
                                            )}
                                          </div>

                                          {/* Action Buttons */}
                                          <div className="flex items-center gap-1 shrink-0 no-print">
                                            <button
                                              onClick={() => !isGuest && handleConfirmationToggle(sub.id)}
                                              disabled={isGuest}
                                              className={`p-1 rounded-md transition-all cursor-pointer shadow-2xs active:scale-90 ${
                                                isConfirmed ? 'bg-emerald-500 text-white shadow-emerald-200' : 'bg-gray-100 text-gray-400 hover:text-gray-700 hover:bg-gray-200'
                                              } disabled:opacity-50`}
                                              title={isConfirmed ? 'Confirmado' : 'Marcar confirmação'}
                                            >
                                              <CheckCircle2 size={12} />
                                            </button>
                                            <button
                                              onClick={() => generateDocument(sub, 'docx')}
                                              className="p-1 bg-primary-200 text-white hover:bg-primary-300 rounded-md shadow-2xs transition-all cursor-pointer active:scale-90"
                                              title="Gerar Carta de Designação (.docx)"
                                            >
                                              <FileText size={12} />
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

                          const speakerName = speakers[item.id] || '';
                          const isConfirmed = !!confirmedSpeakers[item.id];
                          const isMusicOrIntermission = !hasSpeaker;

                          return (
                            <div 
                              key={`item-${item.id || itemIdx}-${itemIdx}`} 
                              className={`p-1 rounded-lg transition-colors session-item-row ${
                                item.isRole ? 'bg-violet-50/60 border border-violet-200/80 shadow-2xs' : 'border-b border-gray-100/80'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  {item.time ? (
                                    <span className="text-[8pt] font-black w-10 shrink-0" style={{ color: currentDay.color }}>
                                      {item.time}
                                    </span>
                                  ) : (
                                    <span className="w-10 shrink-0"></span>
                                  )}

                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      {item.label && (
                                        <span 
                                          className="text-[6.5pt] font-black uppercase tracking-wider px-1.5 py-0.2 rounded"
                                          style={{ backgroundColor: `${currentDay.color}15`, color: currentDay.color }}
                                        >
                                          {item.label}
                                        </span>
                                      )}
                                      <span className={`text-[8.5pt] leading-tight ${
                                        item.isRole ? 'font-black text-violet-950 uppercase tracking-wide' : isMusicOrIntermission ? 'font-medium text-gray-500 italic' : 'font-bold text-gray-900'
                                      }`}>
                                        {item.title}
                                      </span>
                                      {item.subtitle && (
                                        <span className="text-[7.5pt] text-gray-600 italic">
                                          — {item.subtitle}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {hasSpeaker && (
                                  <>
                                    {/* Speaker Input & Print Display */}
                                    <div className="w-56 shrink-0 relative flex items-center">
                                      <input 
                                        type="text"
                                        placeholder={item.isRole ? "Nome do Presidente..." : "Nome do orador..."}
                                        value={speakerName}
                                        disabled={isGuest}
                                        onChange={(e) => handleSpeakerChange(item.id, e.target.value)}
                                        className={`w-full text-[8.5pt] font-bold text-gray-900 bg-transparent border-b border-gray-200 focus:border-primary-200 px-1 rounded-t-sm outline-none placeholder:text-gray-300 transition-colors ${!speakerName ? 'print:hidden' : ''}`}
                                      />
                                      {!speakerName && (
                                        <div className="hidden print:flex items-baseline w-full text-[7.5pt] text-gray-500 font-normal">
                                          <span className="text-[6.5pt] font-semibold text-gray-400 mr-1.5 shrink-0">
                                            {item.isRole ? 'Presidente:' : 'Orador:'}
                                          </span>
                                          <span className="flex-1 border-b border-dotted border-gray-400 pb-0.5">&nbsp;</span>
                                        </div>
                                      )}
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex items-center gap-1 shrink-0 no-print">
                                      <button
                                        onClick={() => !isGuest && handleConfirmationToggle(item.id)}
                                        disabled={isGuest}
                                        className={`p-1 rounded-md transition-all cursor-pointer shadow-2xs active:scale-90 ${
                                          isConfirmed ? 'bg-emerald-500 text-white shadow-emerald-200' : 'bg-gray-100 text-gray-400 hover:text-gray-700 hover:bg-gray-200'
                                        } disabled:opacity-50`}
                                        title={isConfirmed ? 'Confirmado' : 'Marcar confirmação'}
                                      >
                                        <CheckCircle2 size={12} />
                                      </button>
                                      <button
                                        onClick={() => generateDocument(item, 'docx')}
                                        className="p-1 bg-primary-200 text-white hover:bg-primary-300 rounded-md shadow-2xs transition-all cursor-pointer active:scale-90"
                                        title="Gerar Carta de Designação (.docx)"
                                      >
                                        <FileText size={12} />
                                      </button>
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Sheet Bottom Footer */}
                  <div className="border-t border-gray-200/80 pt-1.5 mt-auto flex items-center justify-between text-[6.5pt] font-bold text-gray-400 uppercase tracking-wider shrink-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: currentDay.color }}></span>
                      <span className="truncate">CO-r{selectedYear.slice(-2)}-T • CONGRESSO REGIONAL {selectedYear}</span>
                      <span className="text-gray-300 font-normal">•</span>
                      <span className="text-gray-600">{currentDay.day}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-gray-800 font-black">Página {pageNum} de {totalPages}</span>
                      <span className="text-gray-300">•</span>
                      <span className="font-bold" style={{ color: currentDay.color }}>Sessão da {session.period}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {showConfirmModal && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-surface-100 border border-surface-300 rounded-3xl p-5 sm:p-6 max-w-sm w-full shadow-2xl overflow-hidden"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0 border border-amber-500/20">
                  <AlertTriangle size={20} strokeWidth={2.5} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base sm:text-lg font-black text-typography-900 leading-tight">
                    Alterações não salvas
                  </h3>
                  <span className="text-xs text-typography-400 font-medium truncate block">
                    Congresso • {selectedYear}
                  </span>
                </div>
              </div>

              <p className="text-xs sm:text-sm text-typography-500 leading-relaxed mb-5">
                Você fez alterações na lista de oradores. O que deseja fazer antes de continuar?
              </p>

              <div className="flex flex-col gap-2">
                <button 
                  onClick={confirmSave}
                  className="w-full py-2.5 sm:py-3 px-4 bg-primary-200 hover:bg-primary-150 text-white rounded-xl font-bold text-xs sm:text-sm shadow-xs transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
                >
                  <Save size={15} />
                  <span>Salvar e Continuar</span>
                </button>
                <button 
                  onClick={confirmDiscard}
                  className="w-full py-2.5 sm:py-3 px-4 bg-surface-200/60 hover:bg-rose-500/10 text-typography-600 hover:text-rose-600 dark:hover:text-rose-400 border border-surface-300/80 rounded-xl font-semibold text-xs sm:text-sm transition-all active:scale-[0.98] cursor-pointer"
                >
                  Descartar Alterações
                </button>
                <button 
                  onClick={() => setShowConfirmModal(false)}
                  className="w-full py-2 text-typography-400 hover:text-typography-700 font-semibold text-xs transition-colors cursor-pointer"
                >
                  Continuar Editando
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Floating Save Bar (quando houver alterações não salvas) */}
      <AnimatePresence>
        {hasChanges && !isGuest && (
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            className="fixed bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-[1002] bg-surface-100/95 dark:bg-surface-200/95 text-typography-900 backdrop-blur-md px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-2xl shadow-xl flex items-center justify-between gap-2.5 sm:gap-4 border border-surface-300 w-[calc(100vw-1.5rem)] max-w-md no-print"
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
                <span className="text-[10px] text-typography-400 font-mono hidden sm:inline truncate">
                  {selectedYear} • Programa do Congresso
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => {
                  setSpeakers({ ...initialSpeakers });
                  setConfirmedSpeakers({ ...initialConfirmedSpeakers });
                  setDetails({ ...initialDetails });
                }}
                disabled={isSaving}
                className="px-2.5 py-1.5 text-xs font-semibold text-typography-500 hover:text-typography-800 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
              >
                Descartar
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-3 sm:px-3.5 py-1.5 bg-primary-200 hover:bg-primary-150 active:scale-95 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 whitespace-nowrap"
              >
                {isSaving ? (
                  <>
                    <Loader2 size={13} className="animate-spin shrink-0" />
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
