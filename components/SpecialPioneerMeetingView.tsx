'use client';

import Image from 'next/image';
import { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Users, ChevronLeft, Calendar, Clock, BookOpen, Music, Info, User, 
  Save, AlertTriangle, Loader2, Printer, MapPin, CalendarDays, ChevronDown, 
  ChevronUp, CheckCircle2, Circle, Coffee, FileText, RefreshCw, Plus, 
  ZoomIn, ZoomOut, Maximize2, Minimize2, RotateCcw, Edit3, X, Check, FileDown, Layers, LayoutGrid, LayoutList, Table as TableIcon
} from 'lucide-react';
import CustomSelect from '@/components/CustomSelect';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, collection, getDocs, query, where, onSnapshot } from 'firebase/firestore';
import { useDialog } from '@/hooks/useDialog';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { cleanPSSMetadata, formatDocxError } from '@/lib/docxUtils';

interface SpecialPioneerMeetingViewProps {
  userId: string;
  isGuest?: boolean;
  onBack: () => void;
}

interface AssemblyDetails {
  eventDate: string;
  eventLocation: string;
  rehearsalDate: string;
  rehearsalLocation: string;
  assemblyTheme: string;
  startTime: string;
  material?: string;
  customHeaderImage?: string;
}

interface PartData {
  speakers: Record<string, string>;
  congregations?: Record<string, string>;
  notes?: Record<string, string>;
  confirmations: Record<string, boolean>;
  userTimes?: Record<string, string>;
  details: AssemblyDetails;
}

interface PioneerItem {
  id: string;
  duration?: number;
  time?: string;
  title: string;
  label?: string;
  noSpeaker?: boolean;
  isHeader?: boolean;
  isInterval?: boolean;
  isSeries?: boolean;
  subitems?: {
    id: string;
    duration?: number;
    time?: string;
    title: string;
  }[];
}

interface PioneerProgram {
  title: string;
  year: string;
  theme: string;
  color?: string;
  headerImage: string;
  sessions: {
    period: string;
    items: PioneerItem[];
  }[];
}

const STATIC_PROGRAMS: Record<string, PioneerProgram> = {
  '2026-2027': {
    title: 'Programa para a Reunião Especial com os Pioneiros e Missionários de 2027',
    year: '2026-2027',
    theme: '“Estabeleça alvos para enriquecer seu ministério!” — Prov. 4:25',
    color: '#8B5CF6',
    headerImage: '',
    sessions: [
      {
        period: 'Programa',
        items: [
          { id: 'm1', duration: 5, title: 'Cântico 84 e oração', noSpeaker: true },
          { id: 'm2', duration: 15, title: '“Fixe o olhar diretamente na sua frente”', noSpeaker: false },
          { 
            id: 'm3', 
            duration: 60,
            label: 'SÉRIE DE DISCURSOS:', 
            title: 'Estabeleça alvos', 
            noSpeaker: true,
            isHeader: true,
            isSeries: true,
            subitems: [
              { id: 'm3_1', duration: 20, title: 'Quando é difícil encontrar as pessoas' },
              { id: 'm3_2', duration: 20, title: 'Quando as pessoas mostram pouco interesse' },
              { id: 'm3_3', duration: 20, title: 'Quando há muitas pessoas interessadas' }
            ]
          },
          { id: 'm4', duration: 15, title: 'Consideração das necessidades dos pioneiros', noSpeaker: false },
          { id: 'm5', duration: 20, title: 'Intervalo', noSpeaker: true, isInterval: true },
          { 
            id: 'm6', 
            duration: 60,
            label: 'SÉRIE DE DISCURSOS:', 
            title: 'Alvos que enriquecem seu ministério', 
            noSpeaker: true,
            isHeader: true,
            isSeries: true,
            subitems: [
              { id: 'm6_1', duration: 15, title: 'Iniciar e dirigir estudos bíblicos progressivos' },
              { id: 'm6_2', duration: 15, title: 'Servir onde há mais necessidade' },
              { id: 'm6_3', duration: 15, title: 'Servir como pioneiro especial ou missionário' },
              { id: 'm6_4', duration: 15, title: 'Treinar e orientar outros' }
            ]
          },
          { id: 'm7', duration: 15, title: 'Alegre-se com o seu progresso!', noSpeaker: false },
          { id: 'm8', duration: 5, title: 'Cântico 58 e oração', noSpeaker: true }
        ]
      }
    ]
  }
};

/**
 * Parser inteligente de texto colado da Reunião Especial de Pioneiros (S-312)
 */
function parsePioneerText(rawText: string, year: string, defaultTitle?: string, defaultTheme?: string): PioneerProgram {
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
  
  let detectedTitle = defaultTitle || `Programa para a Reunião Especial com os Pioneiros e Missionários de ${year.split('-')[1] || year}`;
  let detectedTheme = defaultTheme || '';
  const headerImage = '';
  
  const items: PioneerItem[] = [];
  let currentSeries: PioneerItem | null = null;
  let itemCounter = 1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lower = line.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    // Detectar título se ainda não definido
    if (!defaultTitle && (lower.includes('programa para a reuniao especial') || lower.includes('reuniao especial com os pioneiros'))) {
      detectedTitle = line;
      continue;
    }

    // Detectar tema se ainda não definido (contém aspas ou texto bíblico)
    if (!detectedTheme && (line.includes('“') || line.includes('"') || lower.includes('tema:') || line.includes('—') || line.includes('- Prov') || line.includes('- 1 ') || line.includes('- 2 '))) {
      detectedTheme = line.replace(/^tema:\s*/i, '').trim();
      continue;
    }

    // Pular cabeçalhos de período simples
    if (lower === 'programa' || lower === 'sessao da manha' || lower === 'sessao da tarde') {
      continue;
    }

    // Extrair duração se indicada em parênteses ou no final: (15 min), (20 min), etc.
    let duration = 15;
    const durMatch = line.match(/\((\d+)\s*min(?:utos)?\)/i) || line.match(/(\d+)\s*min(?:utos)?$/i);
    if (durMatch) {
      duration = parseInt(durMatch[1], 10);
    }

    // Limpar o título removendo o tempo/duração e marcadores
    let cleanTitle = line
      .replace(/^\d{1,2}:\d{2}\s*/, '') // Remove horário inicial se colado
      .replace(/\(\d+\s*min(?:utos)?\)/gi, '') // Remove (XX min)
      .replace(/•|\*|-|—|\d+\.\s*/g, '') // Remove marcadores
      .trim();

    const cleanLower = cleanTitle.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    // 1. Cântico e oração
    if ((cleanLower.includes('cantico') || cleanLower.includes('song')) && cleanLower.includes('oracao')) {
      if (currentSeries) {
        items.push(currentSeries);
        currentSeries = null;
      }
      items.push({
        id: `p_${itemCounter++}`,
        duration: durMatch ? duration : 5,
        title: cleanTitle,
        noSpeaker: true
      });
      continue;
    }

    // 2. Intervalo
    if (cleanLower.includes('intervalo') || cleanLower.includes('recreio') || cleanLower.includes('intermission')) {
      if (currentSeries) {
        items.push(currentSeries);
        currentSeries = null;
      }
      items.push({
        id: `p_${itemCounter++}`,
        duration: durMatch ? duration : 20,
        title: cleanTitle || 'Intervalo',
        noSpeaker: true,
        isInterval: true
      });
      continue;
    }

    // 3. Série de Discursos / Simpósio Header
    if (cleanLower.includes('serie de discursos') || cleanLower.includes('simposio') || cleanLower.startsWith('serie:')) {
      if (currentSeries) {
        items.push(currentSeries);
        currentSeries = null;
      }
      const seriesTitle = cleanTitle.replace(/^(?:SÉRIE DE DISCURSOS|SIMPÓSIO|SÉRIE):\s*/i, '').trim();
      currentSeries = {
        id: `p_${itemCounter++}`,
        duration: duration || 60,
        label: 'SÉRIE DE DISCURSOS:',
        title: seriesTitle || 'Série de Discursos',
        noSpeaker: true,
        isHeader: true,
        isSeries: true,
        subitems: []
      };
      continue;
    }

    // 4. Subitem da Série de Discursos
    // Se estivermos dentro de uma série e a linha for um dos discursos da série
    const isExplicitSubitem = line.startsWith('•') || line.startsWith('-') || line.startsWith('*') || /^\d+\./.test(line) || /^[a-d]\)/i.test(line);
    if (currentSeries && (isExplicitSubitem || (currentSeries.subitems && currentSeries.subitems.length < 5 && !cleanLower.includes('alegre-se') && !cleanLower.includes('necessidades') && !cleanLower.includes('fixe o olhar')))) {
      currentSeries.subitems = currentSeries.subitems || [];
      currentSeries.subitems.push({
        id: `${currentSeries.id}_${currentSeries.subitems.length + 1}`,
        duration: duration || 15,
        title: cleanTitle
      });
      continue;
    }

    // Se saiu da série
    if (currentSeries) {
      items.push(currentSeries);
      currentSeries = null;
    }

    // 5. Discurso Regular
    items.push({
      id: `p_${itemCounter++}`,
      duration: duration || 15,
      title: cleanTitle,
      noSpeaker: false
    });
  }

  if (currentSeries) {
    items.push(currentSeries);
  }

  // Fallback se nenhum item for encontrado
  if (items.length === 0) {
    return STATIC_PROGRAMS['2026-2027'];
  }

  return {
    title: detectedTitle,
    year,
    theme: detectedTheme || '“Estabeleça alvos para enriquecer seu ministério!”',
    color: '#8B5CF6',
    headerImage,
    sessions: [
      {
        period: 'Programa',
        items
      }
    ]
  };
}

export default function SpecialPioneerMeetingView({ userId, isGuest = false, onBack }: SpecialPioneerMeetingViewProps) {
  const [selectedYear, setSelectedYear] = useState<string>('2026-2027');
  const [availableYears, setAvailableYears] = useState<string[]>(['2026-2027']);
  const [selectedPart, setSelectedPart] = useState<number>(0);
  const [dynamicProgram, setDynamicProgram] = useState<PioneerProgram | null>(null);
  const [viewMode, setViewMode] = useState<'responsive' | 'a4'>('responsive');

  // Zoom & Viewport controller state
  const [zoom, setZoom] = useState<number>(80);
  const containerRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  const staticProgram = STATIC_PROGRAMS[selectedYear] || STATIC_PROGRAMS['2026-2027'];
  
  const pioneerProgram = useMemo(() => {
    const base = dynamicProgram 
      ? { ...staticProgram, ...dynamicProgram } 
      : staticProgram;
    return base;
  }, [staticProgram, dynamicProgram]);

  const { showAlert } = useDialog();

  // State for all 4 parts
  const [partsData, setPartsData] = useState<Record<number, PartData>>({
    0: { speakers: {}, congregations: {}, notes: {}, confirmations: {}, userTimes: {}, details: { eventDate: '', eventLocation: '', rehearsalDate: '', rehearsalLocation: '', assemblyTheme: pioneerProgram.theme, startTime: '09:00', material: '' } },
    1: { speakers: {}, congregations: {}, notes: {}, confirmations: {}, userTimes: {}, details: { eventDate: '', eventLocation: '', rehearsalDate: '', rehearsalLocation: '', assemblyTheme: pioneerProgram.theme, startTime: '09:00', material: '' } },
    2: { speakers: {}, congregations: {}, notes: {}, confirmations: {}, userTimes: {}, details: { eventDate: '', eventLocation: '', rehearsalDate: '', rehearsalLocation: '', assemblyTheme: pioneerProgram.theme, startTime: '09:00', material: '' } },
    3: { speakers: {}, congregations: {}, notes: {}, confirmations: {}, userTimes: {}, details: { eventDate: '', eventLocation: '', rehearsalDate: '', rehearsalLocation: '', assemblyTheme: pioneerProgram.theme, startTime: '09:00', material: '' } },
  });

  const [initialPartsData, setInitialPartsData] = useState<string>('');
  const [personalData, setPersonalData] = useState<any>(null);
  const [templates, setTemplates] = useState<Record<string, { content: string, updatedAt: string }>>({});
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showEditDetailsModal, setShowEditDetailsModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  // Modals for Paste Update and Add Next Season
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [updatePastedText, setUpdatePastedText] = useState('');
  const [updateTitle, setUpdateTitle] = useState('');
  const [updateTheme, setUpdateTheme] = useState('');
  const [updateHeaderImage, setUpdateHeaderImage] = useState('');

  const [showAddNextModal, setShowAddNextModal] = useState(false);
  const [newSeasonYear, setNewSeasonYear] = useState('');
  const [addNextPastedText, setAddNextPastedText] = useState('');
  const [addNextTitle, setAddNextTitle] = useState('');
  const [addNextTheme, setAddNextTheme] = useState('');
  const [addNextHeaderImage, setAddNextHeaderImage] = useState('');

  // Active part data
  const currentPart = partsData[selectedPart] || {
    speakers: {},
    congregations: {},
    notes: {},
    confirmations: {},
    userTimes: {},
    details: { eventDate: '', eventLocation: '', rehearsalDate: '', rehearsalLocation: '', assemblyTheme: pioneerProgram.theme, startTime: '09:00' }
  };
  const speakers = currentPart.speakers || {};
  const congregations = currentPart.congregations || {};
  const notes = currentPart.notes || {};
  const confirmedSpeakers = currentPart.confirmations || {};
  const details = currentPart.details || {
    eventDate: '',
    eventLocation: '',
    rehearsalDate: '',
    rehearsalLocation: '',
    assemblyTheme: pioneerProgram.theme,
    startTime: '09:00'
  };

  const stats = useMemo(() => {
    let totalWithSpeaker = 0;
    let assignedCount = 0;
    let confirmedCount = 0;

    pioneerProgram.sessions.forEach(session => {
      session.items.forEach(item => {
        const isSymposium = item.subitems && item.subitems.length > 0;
        if (isSymposium) {
          item.subitems?.forEach(sub => {
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
  }, [pioneerProgram, speakers, confirmedSpeakers]);

  const collectionName = 'special_pioneer_meeting_speakers';
  const hasChanges = initialPartsData !== JSON.stringify(partsData);

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

  // Helper to add minutes to HH:mm time string
  const calculateTime = (startTime: string, minutesToAdd: number) => {
    if (!startTime) return '';
    const [hours, mins] = startTime.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, mins, 0, 0);
    date.setMinutes(date.getMinutes() + minutesToAdd);
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  // Pinch-to-zoom and wheel zoom handling
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
    container.addEventListener('touchend', handleTouchEnd, { passive: true });
    container.addEventListener('touchcancel', handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
      container.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [zoom]);

  const handleFitToScreen = () => {
    if (containerRef.current) {
      const containerWidth = containerRef.current.clientWidth - 48;
      const a4WidthPx = 793.7;
      const targetZoom = Math.round((containerWidth / a4WidthPx) * 100);
      setZoom(Math.min(125, Math.max(40, targetZoom)));
    }
  };

  // Load Firestore data
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        // 1. Carregar lista de temporadas disponíveis da coleção de pioneiros
        const programsSnapshot = await getDocs(collection(db, 'special_pioneer_programs'));
        const years = new Set(['2026-2027']);
        programsSnapshot.forEach(docSnap => {
          years.add(docSnap.id);
        });
        setAvailableYears(Array.from(years).sort((a, b) => b.localeCompare(a)));

        // 2. Carregar programa dinâmico da temporada selecionada se existir
        const progDocRef = doc(db, 'special_pioneer_programs', selectedYear);
        const progSnap = await getDoc(progDocRef);
        if (progSnap.exists()) {
          setDynamicProgram(progSnap.data() as PioneerProgram);
        } else {
          setDynamicProgram(null);
        }

        // 3. Carregar dados pessoais do usuário para cartas
        const personalDataRef = collection(db, 'personal_data');
        const q = query(personalDataRef, where('userId', '==', userId));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          setPersonalData(querySnapshot.docs[0].data());
        } else {
          const personalDocRef = doc(db, 'personal_data', userId);
          const personalSnap = await getDoc(personalDocRef);
          if (personalSnap.exists()) {
            setPersonalData(personalSnap.data());
          }
        }

        // 4. Carregar dados das designações (partsData)
        const docId = selectedYear === '2026-2027' ? userId : `${userId}_${selectedYear}`;
        const docRef = doc(db, collectionName, docId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          const currentTheme = progSnap.exists() ? progSnap.data().theme : STATIC_PROGRAMS['2026-2027'].theme;
          const freshData: Record<number, PartData> = {
            0: { speakers: {}, congregations: {}, notes: {}, confirmations: {}, details: { eventDate: '', eventLocation: '', rehearsalDate: '', rehearsalLocation: '', assemblyTheme: currentTheme, startTime: '09:00', material: '' } },
            1: { speakers: {}, congregations: {}, notes: {}, confirmations: {}, details: { eventDate: '', eventLocation: '', rehearsalDate: '', rehearsalLocation: '', assemblyTheme: currentTheme, startTime: '09:00', material: '' } },
            2: { speakers: {}, congregations: {}, notes: {}, confirmations: {}, details: { eventDate: '', eventLocation: '', rehearsalDate: '', rehearsalLocation: '', assemblyTheme: currentTheme, startTime: '09:00', material: '' } },
            3: { speakers: {}, congregations: {}, notes: {}, confirmations: {}, details: { eventDate: '', eventLocation: '', rehearsalDate: '', rehearsalLocation: '', assemblyTheme: currentTheme, startTime: '09:00', material: '' } },
          };

          if (data.parts) {
            const loadedParts = data.parts;
            const mergedParts = { ...freshData };
            Object.keys(loadedParts).forEach(k => {
              const idx = parseInt(k, 10);
              if (!isNaN(idx)) {
                mergedParts[idx] = {
                  ...mergedParts[idx],
                  ...loadedParts[idx],
                  speakers: loadedParts[idx].speakers || {},
                  congregations: loadedParts[idx].congregations || {},
                  notes: loadedParts[idx].notes || {},
                  confirmations: loadedParts[idx].confirmations || {},
                  details: {
                    ...mergedParts[idx].details,
                    ...(loadedParts[idx].details || {})
                  }
                };
              }
            });
            setPartsData(mergedParts);
            setInitialPartsData(JSON.stringify(mergedParts));
          } else {
            const defaultTheme = progSnap.exists() ? progSnap.data().theme : STATIC_PROGRAMS['2026-2027'].theme;
            const migratedData: Record<number, PartData> = {
              0: { 
                speakers: data.speakers || {}, 
                congregations: data.congregations || {},
                notes: data.notes || {},
                confirmations: data.confirmations || {}, 
                details: {
                  eventDate: data.details?.eventDate || '',
                  eventLocation: data.details?.eventLocation || '',
                  rehearsalDate: data.details?.rehearsalDate || '',
                  rehearsalLocation: data.details?.rehearsalLocation || '',
                  assemblyTheme: data.details?.assemblyTheme || defaultTheme,
                  startTime: data.details?.startTime || '09:00',
                  material: data.details?.material || ''
                }
              },
              1: { speakers: {}, congregations: {}, notes: {}, confirmations: {}, details: { eventDate: '', eventLocation: '', rehearsalDate: '', rehearsalLocation: '', assemblyTheme: defaultTheme, startTime: '09:00', material: '' } },
              2: { speakers: {}, congregations: {}, notes: {}, confirmations: {}, details: { eventDate: '', eventLocation: '', rehearsalDate: '', rehearsalLocation: '', assemblyTheme: defaultTheme, startTime: '09:00', material: '' } },
              3: { speakers: {}, congregations: {}, notes: {}, confirmations: {}, details: { eventDate: '', eventLocation: '', rehearsalDate: '', rehearsalLocation: '', assemblyTheme: defaultTheme, startTime: '09:00', material: '' } },
            };
            setPartsData(migratedData);
            setInitialPartsData(JSON.stringify(migratedData));
          }
        } else {
          const currentTheme = progSnap.exists() ? progSnap.data().theme : STATIC_PROGRAMS['2026-2027'].theme;
          const freshData: Record<number, PartData> = {
            0: { speakers: {}, congregations: {}, notes: {}, confirmations: {}, details: { eventDate: '', eventLocation: '', rehearsalDate: '', rehearsalLocation: '', assemblyTheme: currentTheme, startTime: '09:00', material: '' } },
            1: { speakers: {}, congregations: {}, notes: {}, confirmations: {}, details: { eventDate: '', eventLocation: '', rehearsalDate: '', rehearsalLocation: '', assemblyTheme: currentTheme, startTime: '09:00', material: '' } },
            2: { speakers: {}, congregations: {}, notes: {}, confirmations: {}, details: { eventDate: '', eventLocation: '', rehearsalDate: '', rehearsalLocation: '', assemblyTheme: currentTheme, startTime: '09:00', material: '' } },
            3: { speakers: {}, congregations: {}, notes: {}, confirmations: {}, details: { eventDate: '', eventLocation: '', rehearsalDate: '', rehearsalLocation: '', assemblyTheme: currentTheme, startTime: '09:00', material: '' } },
          };
          setPartsData(freshData);
          setInitialPartsData(JSON.stringify(freshData));
        }
      } catch (error) {
        console.error('Error loading pioneer meeting data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    // Real-time templates listener
    const templatesQuery = query(collection(db, 'document_templates'), where('category', '==', 'assembleias'));
    const unsubscribeTemplates = onSnapshot(templatesQuery, (snapshot) => {
      const fetchedTemplates: Record<string, any> = {};
      snapshot.forEach((d) => {
        fetchedTemplates[d.id] = d.data();
      });
      setTemplates(fetchedTemplates);
    });

    loadData();
    return () => unsubscribeTemplates();
  }, [userId, selectedYear]);

  const handleSave = async (showNotification = true) => {
    setIsSaving(true);
    try {
      const docId = selectedYear === '2026-2027' ? userId : `${userId}_${selectedYear}`;
      const docRef = doc(db, collectionName, docId);
      await setDoc(docRef, { 
        parts: partsData,
        updatedAt: new Date().toISOString(),
        year: selectedYear
      }, { merge: true });
      
      setInitialPartsData(JSON.stringify(partsData));
      if (showNotification) {
        await showAlert('Designações e dados salvos com sucesso!', 'Sucesso');
      }
      return true;
    } catch (error) {
      console.error('Error saving data:', error);
      if (showNotification) {
        await showAlert('Não foi possível salvar as alterações. Tente novamente.', 'Erro');
      }
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleSpeakerChange = (id: string, value: string) => {
    setPartsData(prev => ({
      ...prev,
      [selectedPart]: {
        ...prev[selectedPart],
        speakers: { ...(prev[selectedPart].speakers || {}), [id]: value }
      }
    }));
  };

  const handleCongregationChange = (id: string, value: string) => {
    setPartsData(prev => ({
      ...prev,
      [selectedPart]: {
        ...prev[selectedPart],
        congregations: { ...(prev[selectedPart].congregations || {}), [id]: value }
      }
    }));
  };

  const handleNotesChange = (id: string, value: string) => {
    setPartsData(prev => ({
      ...prev,
      [selectedPart]: {
        ...prev[selectedPart],
        notes: { ...(prev[selectedPart].notes || {}), [id]: value }
      }
    }));
  };

  const handleConfirmationToggle = (id: string) => {
    if (!partsData[selectedPart].speakers[id]) {
      showAlert('É necessário designar um orador antes de confirmar.', 'Aviso');
      return;
    }
    setPartsData(prev => ({
      ...prev,
      [selectedPart]: {
        ...prev[selectedPart],
        confirmations: { ...prev[selectedPart].confirmations, [id]: !prev[selectedPart].confirmations[id] }
      }
    }));
  };

  const updateDetails = (updater: (prev: AssemblyDetails) => AssemblyDetails) => {
    setPartsData(prev => ({
      ...prev,
      [selectedPart]: {
        ...prev[selectedPart],
        details: updater(prev[selectedPart].details)
      }
    }));
  };

  const handleBackClick = () => {
    if (hasChanges) {
      setPendingAction(() => onBack);
      setShowConfirmModal(true);
    } else {
      onBack();
    }
  };

  const handleYearChange = (year: string) => {
    if (hasChanges) {
      setPendingAction(() => () => setSelectedYear(year));
      setShowConfirmModal(true);
    } else {
      setSelectedYear(year);
    }
  };

  // Modal: Abrir modal de Atualizar com dados pré-preenchidos
  const handleOpenUpdateModal = () => {
    setUpdateTitle(pioneerProgram.title || '');
    setUpdateTheme(pioneerProgram.theme || '');
    setUpdateHeaderImage(pioneerProgram.headerImage || '');
    setUpdatePastedText('');
    setShowUpdateModal(true);
  };

  // Salvar atualização de programação colada
  const handleSaveUpdateProgram = async () => {
    if (!updatePastedText.trim() && !updateTheme.trim()) {
      await showAlert('Cole o texto da programação ou informe o tema.', 'Aviso');
      return;
    }

    try {
      let parsed = updatePastedText.trim() 
        ? parsePioneerText(updatePastedText, selectedYear, updateTitle, updateTheme)
        : {
            ...pioneerProgram,
            title: updateTitle || pioneerProgram.title,
            theme: updateTheme || pioneerProgram.theme,
            headerImage: updateHeaderImage || pioneerProgram.headerImage
          };

      if (updateTitle) parsed.title = updateTitle;
      if (updateTheme) parsed.theme = updateTheme;
      if (updateHeaderImage) parsed.headerImage = updateHeaderImage;

      // Salvar na coleção special_pioneer_programs
      await setDoc(doc(db, 'special_pioneer_programs', selectedYear), parsed);
      setDynamicProgram(parsed);

      // Atualizar tema nos detalhes das 4 partes se desejado
      setPartsData(prev => {
        const next = { ...prev };
        [0, 1, 2, 3].forEach(p => {
          if (next[p]) {
            next[p] = {
              ...next[p],
              details: {
                ...next[p].details,
                assemblyTheme: parsed.theme || next[p].details.assemblyTheme
              }
            };
          }
        });
        return next;
      });

      setShowUpdateModal(false);
      await showAlert(`Programação da temporada ${selectedYear} atualizada com sucesso!`, 'Sucesso');
    } catch (e: any) {
      console.error('Error updating program:', e);
      await showAlert(`Erro ao salvar programação: ${e.message}`, 'Erro');
    }
  };

  // Modal: Abrir modal de Adicionar Próxima
  const handleOpenAddNextModal = () => {
    const maxYear = availableYears.reduce((max, y) => y > max ? y : max, '2026-2027');
    const [startYear, endYear] = maxYear.split('-').map(Number);
    const nextYearStr = !isNaN(startYear) && !isNaN(endYear) ? `${startYear + 1}-${endYear + 1}` : '2027-2028';
    
    setNewSeasonYear(nextYearStr);
    setAddNextTitle(`Programa para a Reunião Especial com os Pioneiros e Missionários de ${nextYearStr.split('-')[1] || nextYearStr}`);
    setAddNextTheme('');
    setAddNextHeaderImage('');
    setAddNextPastedText('');
    setShowAddNextModal(true);
  };

  // Salvar nova temporada colada
  const handleSaveAddNextProgram = async () => {
    const trimmedYear = newSeasonYear.trim();
    if (!trimmedYear) {
      await showAlert('Informe o ano da nova temporada (ex: 2027-2028).', 'Aviso');
      return;
    }

    if (!addNextPastedText.trim() && !addNextTheme.trim()) {
      await showAlert('Cole o texto da programação da nova temporada.', 'Aviso');
      return;
    }

    try {
      const parsed = parsePioneerText(
        addNextPastedText, 
        trimmedYear, 
        addNextTitle || `Programa para a Reunião Especial com os Pioneiros e Missionários de ${trimmedYear.split('-')[1] || trimmedYear}`,
        addNextTheme
      );

      if (addNextTitle) parsed.title = addNextTitle;
      if (addNextTheme) parsed.theme = addNextTheme;
      if (addNextHeaderImage) parsed.headerImage = addNextHeaderImage;

      // Salvar na coleção special_pioneer_programs
      await setDoc(doc(db, 'special_pioneer_programs', trimmedYear), parsed);

      // Adicionar aos anos disponíveis e selecionar
      setAvailableYears(prev => Array.from(new Set([...prev, trimmedYear])).sort((a, b) => b.localeCompare(a)));
      setSelectedYear(trimmedYear);
      setDynamicProgram(parsed);

      setShowAddNextModal(false);
      await showAlert(`Temporada ${trimmedYear} adicionada com sucesso!`, 'Sucesso');
    } catch (e: any) {
      console.error('Error creating next season:', e);
      await showAlert(`Erro ao criar temporada: ${e.message}`, 'Erro');
    }
  };

  // Gerador da Carta Convite aos Pioneiros (S-312 / S-302)
  const generateS302 = async () => {
    const pioneerId = 'ass_carta_pioneiros';
    let template = templates[`${userId}_${pioneerId}`] || templates[pioneerId];
    
    if (!template) {
      const legacyIds = ['2026 CA_AOS_PIONEIROS', 'Carta aos pioneiros', 'ass_convite_pioneiros'];
      for (const id of legacyIds) {
        template = templates[`${userId}_${id}`] || templates[id];
        if (template) break;
      }
    }
    
    if (!template) {
      await showAlert(`Template "Carta aos pioneiros" não encontrado. Verifique se carregou o arquivo em Cartas > Gerenciar > Cartas Assembleias.`, 'Aviso');
      return;
    }

    setIsSaving(true);
    try {
      const binaryString = window.atob(template.content);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      const signatureImage = personalData?.signatureImage || personalData?.signature || '';
      const hasImage = Boolean(signatureImage && typeof signatureImage === 'string' && signatureImage.startsWith('data:image'));

      const cleanedBuffer = cleanPSSMetadata(bytes.buffer);
      const zip = new PizZip(cleanedBuffer);
      const ImageModule = (await import('docxtemplater-image-module-free')).default;
      
      const xmlFiles = zip.file(/word\/(document|header\d+|footer\d+)\.xml/);
      xmlFiles.forEach(xmlResource => {
        let xmlContent = xmlResource.asText();

        if (hasImage && !xmlContent.includes('xmlns:wp=')) {
          xmlContent = xmlContent.replace(/(<w:(?:document|hdr|ftr)[^>]*)/, (match) => {
            if (match.includes('xmlns:wp=')) return match;
            return `${match} xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape" xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas" xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"`;
          });
        }

        xmlContent = xmlContent.replace(/<w:proofErr w:type="(?:spell|gram)(?:Start|End)"\/>/g, "");
        xmlContent = xmlContent.replace(/<w:noProof\/>/g, "");
        for (let i = 0; i < 6; i++) {
          xmlContent = xmlContent.replace(/(@|\[[#\/^>?]?)([A-Za-z0-9À-ÿ\u00C0-\u00FF\_]*)(<\/w:t>(?:<(?!w:p|w:tr|w:tbl|w:br|w:tc|w:tr)[^>]+>)*?<w:t[^>]*>)([A-Za-z0-9À-ÿ\u00C0-\u00FF\_]+|\])/g, "$1$2$4$3");
        }
        xmlContent = xmlContent.replace(/(@[A-Za-z0-9À-ÿ\_]*)(<\/w:t><\/w:r><w:r><w:t>)/g, "$1");

        xmlContent = xmlContent.replace(/(<w:t[^>]*>)(.*?)(<\/w:t>)/g, (match: string, opening: string, text: string, closing: string) => {
          let newText = text;
          if (hasImage) {
            newText = newText.replace(/\[ASSINATURA([\s\_]GLOBAL)?\]/gi, '[%ASSINATURA]');
            newText = newText.replace(/@Assinatura([\s\_]GLOBAL)?/gi, '[%ASSINATURA]');
          } else {
            newText = newText.replace(/@Assinatura([\s\_]GLOBAL)?/gi, '[ASSINATURA]');
            newText = newText.replace(/\[%ASSINATURA\]/gi, '[ASSINATURA]');
          }
          newText = newText.replace(/(^|[\s\W])@([A-Za-z0-9À-ÿ\_]+)/g, (m: string, p1: string, p2: string) => {
            const tag = p2.toUpperCase();
            if (tag.includes('ASSINATURA') || tag.includes('SIGNATURE')) {
               return hasImage ? `${p1}[%ASSINATURA]` : `${p1}[ASSINATURA]`;
            }
            return `${p1}[${tag}]`;
          });
          return `${opening}${newText}${closing}`;
        });
        zip.file(xmlResource.name, xmlContent);
      });

      let sigWidth = 150;
      let sigHeight = 60;
      
      if (hasImage) {
        try {
          const img = new window.Image();
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = signatureImage;
          });
          const aspectRatio = img.width / img.height;
          sigHeight = 60;
          sigWidth = sigHeight * aspectRatio;
          if (sigWidth > 220) {
            sigWidth = 220;
            sigHeight = sigWidth / aspectRatio;
          }
        } catch (e) {
          console.warn('Could not determine signature dimensions:', e);
        }
      }

      const opts: any = {
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

      const now = new Date();
      const hoje = new Intl.DateTimeFormat('pt-BR', { 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric' 
      }).format(now);

      const replacements = {
        'EVENTO': pioneerProgram.title,
        'TEMA': details.assemblyTheme || pioneerProgram.theme,
        'DATA': details.eventDate || '________________',
        'HOJE': hoje,
        'data': hoje,
        'LOCAL': details.eventLocation || '________________',
        'DATA_EVENTO': details.eventDate || '________________',
        'LOCAL_EVENTO': details.eventLocation || '________________',
        'CIRCUITO': personalData?.circuito || '________________',
        'VIAJANTE': personalData?.nome || '________________',
        'NOME': personalData?.nome || '________________',
        'FONE': personalData?.telefoneCircuito || personalData?.telefone || '________________',
        'TELEFONE': personalData?.telefoneCircuito || personalData?.telefone || '________________',
        'ENSAIOS': details.eventDate || '________________',
        'ENDEREÇO': details.eventLocation || '________________',
        'MATERIAL': details.material || '________________',
        'ASSINATURA': `${personalData?.nome || '________________'} (${personalData?.circuito || '________________'})`,
        'ASSINATURA_GLOBAL': `${personalData?.nome || '________________'} (${personalData?.circuito || '________________'})`,
        'ASSINATURA GLOBAL': `${personalData?.nome || '________________'} (${personalData?.circuito || '________________'})`,
        '%ASSINATURA': signatureImage,
      };

      const doc = new Docxtemplater(zip, {
        modules: hasImage && ImageModule ? [new ImageModule(opts)] : [],
        paragraphLoop: true,
        linebreaks: true,
        delimiters: { start: '[', end: ']' },
        nullGetter: () => ''
      });

      doc.render(replacements);
      const out = doc.getZip().generate({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
      
      try {
        const fileSaver = await import('file-saver');
        const saveAs = fileSaver.saveAs || (fileSaver as any).default;
        if (typeof saveAs === 'function') {
          saveAs(out, `S-312_Carta convite aos pioneiros_${details.eventDate || 'Evento'}.docx`);
        } else {
          throw new Error('saveAs is not a function');
        }
      } catch (e) {
        const url = window.URL.createObjectURL(out);
        const link = document.createElement('a');
        link.href = url;
        link.download = `S-312_Carta convite aos pioneiros_${details.eventDate || 'Evento'}.docx`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Error generating S-312:', formatDocxError(error), error);
      await showAlert('Erro ao gerar o documento: ' + formatDocxError(error), 'Erro');
    } finally {
      setIsSaving(false);
    }
  };

  // Gerador de Carta Individual do Orador (ass_carta_oradores)
  const generateDocument = async (item: any) => {
    const speakerName = speakers[item.id];
    if (!speakerName) {
      await showAlert('Por favor, informe o nome do orador primeiro.', 'Aviso');
      return;
    }

    const titleNorm = (item.title || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const isPrayer = titleNorm.includes('oracao') || titleNorm.includes('prayer');

    let templateId = 'ass_carta_oradores';
    let designation = item.title;

    if (isPrayer) {
      templateId = 'ass_convite_oracao';
      // Identify which prayer it is
      const allItems: any[] = [];
      pioneerProgram.sessions.forEach((s: any) => {
        s.items.forEach((i: any) => {
          allItems.push(i);
          if (i.subitems) i.subitems.forEach((si: any) => allItems.push(si));
        });
      });
      const prayerItems = allItems.filter((i: any) => {
        const t = (i.title || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return t.includes('oracao') || t.includes('prayer');
      });
      const prayerIndex = prayerItems.findIndex((i: any) => i.id === item.id);
      
      if (prayerIndex === 0) designation = 'ORAÇÃO INICIAL';
      else if (prayerIndex === 1) designation = 'ORAÇÃO DA TARDE';
      else if (prayerIndex === 2) designation = 'ORAÇÃO FINAL';
      else designation = 'ORAÇÃO';
    }

    const template = templates[templateId] || templates[`${userId}_${templateId}`] || templates['ass_carta_oradores'] || templates[`${userId}_ass_carta_oradores`];
    if (!template) {
      await showAlert(`Template "${templateId}" não encontrado. Por favor, carregue-o em Cartas > Gerenciar.`, 'Aviso');
      return;
    }

    setIsSaving(true);
    try {
      const binaryString = window.atob(template.content);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      const cleanedBuffer = cleanPSSMetadata(bytes.buffer);
      const zip = new PizZip(cleanedBuffer);
      const ImageModule = (await import('docxtemplater-image-module-free')).default;
      const signatureImage = personalData?.signatureImage || personalData?.signature || '';
      const hasImage = Boolean(signatureImage && typeof signatureImage === 'string' && signatureImage.startsWith('data:image'));

      const xmlFiles = zip.file(/word\/(document|header\d+|footer\d+)\.xml/);
      xmlFiles.forEach(xmlResource => {
        let xmlContent = xmlResource.asText();

        if (hasImage && !xmlContent.includes('xmlns:wp=')) {
          xmlContent = xmlContent.replace(/(<w:(?:document|hdr|ftr)[^>]*)/, (match) => {
            if (match.includes('xmlns:wp=')) return match;
            return `${match} xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape" xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas" xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"`;
          });
        }

        xmlContent = xmlContent.replace(/<w:proofErr w:type="(?:spell|gram)(?:Start|End)"\/>/g, "");
        xmlContent = xmlContent.replace(/<w:noProof\/>/g, "");
        
        for (let i = 0; i < 6; i++) {
          xmlContent = xmlContent.replace(/(@|\[[#\/^>?]?)([A-Za-z0-9À-ÿ\u00C0-\u00FF\_]*)(<\/w:t>(?:<(?!w:p|w:tr|w:tbl|w:br|w:tc|w:tr)[^>]+>)*?<w:t[^>]*>)([A-Za-z0-9À-ÿ\u00C0-\u00FF\_]+|\])/g, "$1$2$4$3");
        }
        
        xmlContent = xmlContent.replace(/(@[A-Za-z0-9À-ÿ\_]*)(<\/w:t><\/w:r><w:r><w:t>)/g, "$1");

        xmlContent = xmlContent.replace(/(<w:t[^>]*>)(.*?)(<\/w:t>)/g, (match: string, opening: string, text: string, closing: string) => {
          let newText = text;
          if (hasImage) {
            newText = newText.replace(/\[ASSINATURA([\s\_]GLOBAL)?\]/gi, '[%ASSINATURA]');
            newText = newText.replace(/@Assinatura([\s\_]GLOBAL)?/gi, '[%ASSINATURA]');
          } else {
            newText = newText.replace(/@Assinatura([\s\_]GLOBAL)?/gi, '[ASSINATURA]');
            newText = newText.replace(/\[%ASSINATURA\]/gi, '[ASSINATURA]');
          }
          newText = newText.replace(/(^|[\s\W])@([A-Za-z0-9À-ÿ\_]+)/g, (m: string, p1: string, p2: string) => {
            const tag = p2.toUpperCase();
            if (tag.includes('ASSINATURA') || tag.includes('SIGNATURE')) {
              return hasImage ? `${p1}[%ASSINATURA]` : `${p1}[ASSINATURA]`;
            }
            return `${p1}[${tag}]`;
          });
          return `${opening}${newText}${closing}`;
        });
        zip.file(xmlResource.name, xmlContent);
      });

      let sigWidth = 150;
      let sigHeight = 60;
      
      if (hasImage) {
        try {
          const img = new window.Image();
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = signatureImage;
          });
          const aspectRatio = img.width / img.height;
          sigHeight = 60;
          sigWidth = sigHeight * aspectRatio;
          if (sigWidth > 220) {
            sigWidth = 220;
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
      
      const isSpeech = (it: any) => {
        if (it.noSpeaker || it.isRole) return false;
        const t = (it.title || '').toLowerCase();
        if (t.includes('música') || t.includes('anúncios') || t.includes('intervalo') || t.includes('cântico')) return false;
        return true;
      };

      // Calcular número sequencial e horário do item
      let currentOffset = 0;
      let sequentialNumber = 0;
      let itemStartTime = "";
      let found = false;
      let parentItem: any = null;

      for (const session of pioneerProgram.sessions) {
        for (const sItem of session.items) {
          const sItemDuration = (sItem as any).duration || 0;
          
          if ((sItem as any).subitems) {
            let subOffset = currentOffset;
            const subTarget = (sItem as any).subitems.find((si: any) => si.id === item.id);
            if (subTarget) parentItem = sItem;

            for (const sub of (sItem as any).subitems) {
              if (isSpeech(sub)) sequentialNumber++;
              if (sub.id === item.id) {
                itemStartTime = calculateTime(details.startTime, subOffset);
                found = true;
                break;
              }
              subOffset += (sub as any).duration || 0;
            }
          } else {
            if (isSpeech(sItem)) sequentialNumber++;
            if (sItem.id === item.id) {
              itemStartTime = calculateTime(details.startTime, currentOffset);
              found = true;
              break;
            }
          }
          
          if (found) break;
          currentOffset += sItemDuration;
        }
        if (found) break;
      }

      const itemLabel = (item as any).label || '';
      const parentLabel = (parentItem as any)?.label || '';
      const parentTitle = (parentItem as any)?.title || '';
      const isSerie = parentLabel.toUpperCase().includes('SÉRIE DE DISCURSOS') || itemLabel.toUpperCase().includes('SÉRIE DE DISCURSOS');

      let tituloValue = item.title;
      if (isSerie) {
        const seriesTheme = (parentTitle || item.title).replace(/^SÉRIE DE DISCURSOS:\s*/i, '').trim();
        let partTitle = item.title.replace(/^SÉRIE DE DISCURSOS:\s*/i, '').trim();
        
        if (parentItem && partTitle !== seriesTheme) {
          if (partTitle.startsWith(seriesTheme)) {
            partTitle = partTitle.substring(seriesTheme.length).replace(/^[—\-\s:]+/, '').trim();
          }
          tituloValue = `SÉRIE DE DISCURSOS:\n${seriesTheme}${partTitle ? `\n${partTitle}` : ''}`;
        } else {
          tituloValue = `SÉRIE DE DISCURSOS:\n${seriesTheme}`;
        }
      }

      const replacements = {
        'EVENTO': pioneerProgram.title,
        'TEMA': details.assemblyTheme || pioneerProgram.theme,
        'DATA': details.eventDate || '________________',
        'LOCAL': details.eventLocation || '________________',
        'DATA_EVENTO': details.eventDate || '________________',
        'LOCAL_EVENTO': details.eventLocation || '________________',
        'MATERIAL': details.material || '________________',
        'ORADOR': speakerName,
        'TITULO': isPrayer ? designation : tituloValue,
        'DESIGNAÇÃO': designation,
        'DESIGNACAO': designation,
        'HORA': itemStartTime,
        'N': sequentialNumber.toString(),
        'ENSAIOS': details.rehearsalDate || '________________',
        'ENDEREÇO': details.rehearsalLocation || '________________',
        'D_ENSAIO': details.rehearsalDate || '________________',
        'L_ENSAIO': details.rehearsalLocation || '________________',
        'DATA_ENSAIO': details.rehearsalDate || '________________',
        'LOCAL_ENSAIO': details.rehearsalLocation || '________________',
        'DATAHORA': details.rehearsalDate || '________________',
        'LOCALTREINO': details.rehearsalLocation || '________________',
        'CIRCUITO': personalData?.circuito || '________________',
        'VIAJANTE': personalData?.nome || '________________',
        'NOME': personalData?.nome || '________________',
        'FONE': personalData?.telefoneCircuito || personalData?.telefone || '________________',
        'TELEFONE': personalData?.telefoneCircuito || personalData?.telefone || '________________',
        'ASSINATURA': `${personalData?.nome || '________________'} (${personalData?.circuito || '________________'})`,
        'ASSINATURA_GLOBAL': `${personalData?.nome || '________________'} (${personalData?.circuito || '________________'})`,
        'ASSINATURA GLOBAL': `${personalData?.nome || '________________'} (${personalData?.circuito || '________________'})`,
        '%ASSINATURA': signatureImage,
      };

      const docObj = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
        delimiters: { start: '[', end: ']' },
        modules: hasImage && ImageModule ? [new ImageModule(imgOpts)] : [],
        nullGetter: () => ''
      });

      docObj.render(replacements);

      const out = docObj.getZip().generate({
        type: 'blob',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });

      const url = URL.createObjectURL(out);
      const link = document.createElement('a');
      link.href = url;
      // Calculate sequential index
      let allItems: any[] = [];
      pioneerProgram.sessions.forEach((s: any) => {
        s.items.forEach((i: any) => {
          if (i.subitems) {
            i.subitems.forEach((si: any) => allItems.push(si));
          } else {
            allItems.push(i);
          }
        });
      });
      const itemIndex = allItems.findIndex(i => i.id === item.id) + 1;
      const indexStr = itemIndex.toString().padStart(2, '0');

      const eventYear = pioneerProgram.year || new Date().getFullYear().toString();
      const safeSpeaker = speakerName.trim().replace(/\s+/g, '_');
      link.download = `${indexStr}_Pio_(${eventYear})_${safeSpeaker}.docx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Error generating document:', formatDocxError(err), err);
      await showAlert('Erro ao gerar documento: ' + formatDocxError(err), 'Erro');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <Loader2 size={40} className="text-violet-600 animate-spin" />
        <p className="text-gray-500 font-medium">Carregando programação especial de pioneiros...</p>
      </div>
    );
  }

  return (
    <div id="pioneer-meeting-print-content" className="space-y-6 pb-16 print:p-0 print:m-0 print:space-y-0">
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
          
          #pioneer-meeting-print-content,
          #pioneer-meeting-print-content * { 
            visibility: visible !important; 
          }
          
          #pioneer-meeting-print-content {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 210mm !important;
            max-width: 210mm !important;
            margin: 0 !important;
            padding: 0 !important;
            display: block !important;
          }
          
          .pioneer-viewport,
          .pioneer-session-wrapper,
          .pioneer-scale-wrapper {
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

          .pioneer-a4-page { 
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

          .pioneer-session-wrapper:last-child .pioneer-a4-page,
          .pioneer-a4-page:last-child,
          .pioneer-a4-page:last-of-type {
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

          /* Ensure line spacing, grid alignment and input heights match screen in print */
          .pioneer-a4-page .session-items-container > * + * {
            margin-top: 5px !important;
          }

          .pioneer-a4-page .speaker-grid {
            display: grid !important;
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 6px !important;
            margin-top: 4px !important;
          }

          .pioneer-a4-page input {
            border: none !important;
            background: transparent !important;
            padding: 0 !important;
            margin: 0 !important;
            color: #111827 !important;
            max-width: 100% !important;
            line-height: 1.25 !important;
            height: auto !important;
          }
          .pioneer-a4-page input::placeholder {
            color: transparent !important;
          }
        }
      `}</style>

      {/* Screen Header & Top Controls (no-print) */}
      <div className="space-y-3 no-print">
        {/* Top bar: Back, Title, Mode Switch & Action Bar */}
        <div className="flex items-center justify-between gap-3 bg-surface-100 p-3 sm:p-4 rounded-3xl border border-surface-300 shadow-xs flex-wrap">
          <div className="flex items-center gap-3">
            <button 
              onClick={handleBackClick} 
              className="p-2 sm:p-2.5 hover:bg-surface-200 rounded-full transition-all text-primary-200 bg-surface-200/50 shadow-xs border border-surface-300 cursor-pointer active:scale-95 shrink-0"
              title="Voltar ao Painel"
            >
              <ChevronLeft size={20} strokeWidth={2.5} />
            </button>
            <div className="flex flex-col min-w-0">
              <h2 className="text-base sm:text-lg font-black text-typography-900 leading-tight truncate">
                Reunião Especial (S-312)
              </h2>
              <p className="text-[11px] sm:text-xs font-medium text-typography-500 truncate hidden sm:block">
                Pioneiros Regulares, Especiais e Missionários em Campo
              </p>
            </div>
          </div>

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

          {/* Action Bar */}
          <div className="flex items-center gap-1.5 sm:gap-2 ml-auto flex-wrap">
            {/* Dados do Evento */}
            <button 
              onClick={() => setShowEditDetailsModal(true)}
              className="h-9 sm:h-10 px-2.5 sm:px-3 rounded-xl text-xs font-bold text-amber-700 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 shadow-xs flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] cursor-pointer"
              title="Editar dados da reunião (data, local, ensaio, material)"
            >
              <CalendarDays size={15} className="shrink-0 text-amber-600 dark:text-amber-400" />
              <span className="hidden md:inline">Dados do Evento</span>
            </button>

            {/* Atualizar (Colar Programação) */}
            <button 
              onClick={handleOpenUpdateModal} 
              className="h-9 sm:h-10 px-2.5 sm:px-3 rounded-xl text-xs font-bold text-primary-200 bg-primary-200/10 hover:bg-primary-200/20 border border-primary-200/20 shadow-xs flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] cursor-pointer"
              title="Atualizar colando a programação oficial"
            >
              <RefreshCw size={15} className="shrink-0 text-primary-200" />
              <span className="hidden md:inline">Atualizar</span>
            </button>
            
            {/* Adicionar próxima (Colar Nova Temporada) */}
            <button 
              onClick={handleOpenAddNextModal} 
              className="h-9 sm:h-10 px-2.5 sm:px-3 rounded-xl text-xs font-bold text-blue-700 dark:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 shadow-xs flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] cursor-pointer"
              title="Adicionar uma nova temporada colando o programa"
            >
              <Plus size={15} className="shrink-0 text-blue-600 dark:text-blue-400" />
              <span className="hidden lg:inline">Adicionar próxima</span>
              <span className="hidden md:inline lg:hidden">+ Nova</span>
            </button>

            {/* Convite S-312 aos Pioneiros */}
            <button 
              onClick={generateS302} 
              className="h-9 sm:h-10 px-2.5 sm:px-3.5 rounded-xl text-xs font-bold text-violet-700 dark:text-violet-300 bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/20 shadow-xs flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] cursor-pointer"
              title="Gerar Carta Convite aos Pioneiros (S-312)"
            >
              <FileText size={15} className="shrink-0 text-violet-600 dark:text-violet-400" />
              <span className="hidden sm:inline">Convite S-312</span>
            </button>

            {/* Imprimir A4 */}
            <button 
              onClick={() => window.print()} 
              className="h-9 sm:h-10 px-2.5 sm:px-3 rounded-xl text-xs font-bold text-typography-700 bg-surface-100 hover:bg-surface-200 border border-surface-300 shadow-xs flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] cursor-pointer"
              title="Imprimir folha A4 em modo Retrato"
            >
              <Printer size={15} className="shrink-0 text-typography-500" />
              <span className="hidden md:inline">Imprimir A4</span>
            </button>
          </div>
        </div>

        {/* Compact Navigation Bar: Season Dropdown & Parts Selector */}
        <div className="flex items-center justify-between gap-2 p-1.5 bg-surface-100 rounded-2xl border border-surface-300 flex-wrap">
          {/* Seletor de Temporada Personalizado */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[11px] font-bold text-typography-500 uppercase tracking-wider pl-1 hidden xs:inline">
              Temporada:
            </span>
            <CustomSelect
              value={selectedYear}
              onChange={handleYearChange}
              options={availableYears}
              size="sm"
              className="w-36"
            />
          </div>

          {/* Seletor de Partes (A, B, C, D) */}
          <div className="flex items-center gap-1 bg-surface-200 p-0.5 rounded-xl border border-surface-300 shadow-2xs shrink-0 ml-auto">
            {[0, 1, 2, 3].map((part) => {
              const isActive = selectedPart === part;
              const letter = ['A', 'B', 'C', 'D'][part];
              return (
                <button
                  key={part}
                  onClick={() => setSelectedPart(part)}
                  className={`h-8 sm:h-9 px-2.5 sm:px-3.5 rounded-lg text-xs transition-all whitespace-nowrap active:scale-[0.98] flex items-center justify-center cursor-pointer ${
                    isActive 
                      ? 'bg-primary-200 text-white shadow-xs font-bold' 
                      : 'text-typography-600 hover:text-typography-900 hover:bg-surface-100 font-medium'
                  }`}
                  title={`Parte ${letter}`}
                >
                  <span className="hidden sm:inline">Parte </span>
                  <span>{letter}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Zoom Toolbar (apenas visível em Modo A4) */}
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
                      zoom === preset ? 'bg-primary-200 text-white shadow-xs' : 'text-slate-400 hover:text-white'
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

      {/* MODO DE VISUALIZAÇÃO RESPONSIVO (CARDS MODERNOS SEM SCROLL LATERAL) */}
      {viewMode === 'responsive' && (
        <div className="no-print space-y-6">
          {/* Hero Card com Tema e Metadados do Evento */}
          <div className="relative rounded-3xl overflow-hidden bg-surface-100 border border-surface-300 shadow-xs p-5 sm:p-7 space-y-5">
            {/* Background Artwork */}
            {(details.customHeaderImage || pioneerProgram.headerImage) && (
              <div className="absolute inset-0 z-0 pointer-events-none opacity-20 dark:opacity-25 overflow-hidden">
                <Image
                  src={details.customHeaderImage || pioneerProgram.headerImage}
                  alt={details.assemblyTheme || pioneerProgram.theme}
                  fill
                  className="object-cover"
                  style={{ objectPosition: 'center 25%' }}
                  unoptimized
                />
                <div className="absolute inset-0 bg-gradient-to-t from-surface-100 via-surface-100/80 to-transparent" />
              </div>
            )}

            <div className="relative z-10 space-y-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <span className="text-[11px] font-black uppercase tracking-widest text-primary-200 px-3 py-1 rounded-full bg-primary-200/10 border border-primary-200/20">
                  PARTE {['A', 'B', 'C', 'D'][selectedPart] || 'A'} • REUNIÃO ESPECIAL
                </span>
                <button
                  onClick={() => setShowEditDetailsModal(true)}
                  className="text-xs font-bold text-primary-200 hover:text-primary-300 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-200 hover:bg-surface-300 transition-colors cursor-pointer"
                >
                  <Edit3 size={13} />
                  <span>Editar Dados</span>
                </button>
              </div>

              {/* Tema Principal */}
              <div className="space-y-1">
                <h2 className="text-lg sm:text-2xl font-black text-typography-900 tracking-tight leading-tight">
                  {details.assemblyTheme || pioneerProgram.theme}
                </h2>
                <p className="text-xs sm:text-sm text-typography-500 font-medium">
                  {pioneerProgram.title}
                </p>
              </div>

              {/* Metadados: Data, Local, Início, Ensaio, Material */}
              <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 pt-2 border-t border-surface-300/70">
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
                  <Clock size={15} className="text-primary-200 shrink-0" />
                  <div className="min-w-0">
                    <span className="block text-[10px] uppercase font-bold text-typography-400">Início</span>
                    <span className="font-bold text-typography-900 truncate block">
                      {details.startTime || '09:00'}
                    </span>
                  </div>
                </div>

                {details.rehearsalDate && (
                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-surface-200/50 border border-surface-300/60 text-xs">
                    <Clock size={15} className="text-primary-200 shrink-0" />
                    <div className="min-w-0">
                      <span className="block text-[10px] uppercase font-bold text-typography-400">Ensaio</span>
                      <span className="font-bold text-typography-900 truncate block">
                        {details.rehearsalDate}
                      </span>
                    </div>
                  </div>
                )}
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

          {/* Lista de Partes em Cards */}
          <div className="space-y-4">
            {(() => {
              let runningOffset = 0;

              return pioneerProgram.sessions[0]?.items.map((item: PioneerItem, itemIdx: number) => {
                const isSymposium = item.subitems && item.subitems.length > 0;
                const isIntermission = item.isInterval;
                const isMusicOrPrayer = item.noSpeaker && !isSymposium && !isIntermission;
                const itemStartTime = calculateTime(details.startTime, runningOffset);
                const itemDuration = item.duration || (isMusicOrPrayer ? 5 : isIntermission ? 20 : isSymposium ? 60 : 15);

                if (isIntermission) {
                  runningOffset += itemDuration;
                  return (
                    <div
                      key={`resp-item-${item.id || itemIdx}`}
                      className="p-3.5 rounded-2xl bg-surface-200/50 border border-surface-300 flex items-center justify-between gap-3 text-xs text-typography-600 font-bold"
                    >
                      <div className="flex items-center gap-2">
                        <Coffee size={16} className="text-amber-500 shrink-0" />
                        <span>{item.title}</span>
                      </div>
                      <span className="px-2 py-0.5 rounded-md bg-surface-300 text-typography-700 text-[11px]">
                        {itemStartTime} • {itemDuration} min
                      </span>
                    </div>
                  );
                }

                if (isSymposium) {
                  let subOffset = runningOffset;
                  runningOffset += itemDuration;

                  return (
                    <div
                      key={`resp-item-${item.id || itemIdx}`}
                      className="p-4 sm:p-5 rounded-3xl bg-surface-100 border-2 border-violet-500/20 shadow-2xs space-y-4"
                    >
                      {/* Cabeçalho do Simpósio */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-violet-500/10 text-violet-700 dark:text-violet-300 border border-violet-500/20">
                              {item.label || 'SÉRIE DE DISCURSOS'}
                            </span>
                            <span className="text-xs font-mono font-bold text-typography-500">
                              {itemStartTime}
                            </span>
                          </div>
                          <h4 className="text-sm sm:text-base font-black text-typography-900 leading-snug">
                            {item.title}
                          </h4>
                        </div>
                      </div>

                      {/* Subpartes do Simpósio */}
                      <div className="space-y-3 pt-2">
                        {item.subitems?.map((sub, sIdx) => {
                          const subStartTime = calculateTime(details.startTime, subOffset);
                          subOffset += sub.duration || 15;
                          const subSpeaker = speakers[sub.id] || '';
                          const subCong = congregations[sub.id] || '';
                          const subNote = notes[sub.id] || '';
                          const isConfirmed = !!confirmedSpeakers[sub.id];

                          return (
                            <div
                              key={`resp-sub-${sub.id || sIdx}`}
                              className="p-3.5 rounded-2xl bg-surface-200/50 border border-surface-300 space-y-3 transition-colors hover:border-surface-400"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-2">
                                    <span className="w-5 h-5 rounded-full bg-violet-600/10 text-violet-700 dark:text-violet-300 font-bold text-[10px] flex items-center justify-center shrink-0">
                                      {sIdx + 1}
                                    </span>
                                    <span className="text-xs font-bold text-typography-900">
                                      {sub.title}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <span className="text-[11px] font-mono font-semibold text-typography-500">
                                    {subStartTime}
                                  </span>
                                  {sub.duration && (
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-surface-300 text-typography-600">
                                      {sub.duration}m
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Formulário de Designação */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                <div>
                                  <label className="block text-[10px] uppercase font-bold text-typography-500 mb-1">
                                    Orador
                                  </label>
                                  <input
                                    type="text"
                                    value={subSpeaker}
                                    onChange={(e) => handleSpeakerChange(sub.id, e.target.value)}
                                    placeholder="Nome do orador..."
                                    className="w-full h-9 px-3 rounded-xl bg-surface-100 border border-surface-300 text-xs font-bold text-typography-900 focus:outline-none focus:ring-2 focus:ring-primary-200/40"
                                  />
                                </div>

                                <div>
                                  <label className="block text-[10px] uppercase font-bold text-typography-500 mb-1">
                                    Congregação
                                  </label>
                                  <input
                                    type="text"
                                    value={subCong}
                                    onChange={(e) => handleCongregationChange(sub.id, e.target.value)}
                                    placeholder="Congregação..."
                                    className="w-full h-9 px-3 rounded-xl bg-surface-100 border border-surface-300 text-xs text-typography-700 focus:outline-none focus:ring-2 focus:ring-primary-200/40"
                                  />
                                </div>

                                <div className="sm:col-span-2 lg:col-span-1">
                                  <label className="block text-[10px] uppercase font-bold text-typography-500 mb-1">
                                    Observações
                                  </label>
                                  <input
                                    type="text"
                                    value={subNote}
                                    onChange={(e) => handleNotesChange(sub.id, e.target.value)}
                                    placeholder="Notas adicionais..."
                                    className="w-full h-9 px-3 rounded-xl bg-surface-100 border border-surface-300 text-xs text-typography-700 focus:outline-none focus:ring-2 focus:ring-primary-200/40"
                                  />
                                </div>
                              </div>

                              {/* Barra de Ações: Confirmação e Carta */}
                              <div className="flex items-center justify-between pt-1 border-t border-surface-300/50">
                                <button
                                  onClick={() => handleConfirmationToggle(sub.id)}
                                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                    isConfirmed
                                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                      : 'bg-surface-200 text-typography-500 hover:text-typography-700 border border-surface-300'
                                  }`}
                                >
                                  {isConfirmed ? <CheckCircle2 size={13} /> : <Circle size={13} />}
                                  <span>{isConfirmed ? 'Confirmado' : 'Marcar Confirmado'}</span>
                                </button>

                                <button
                                  onClick={() => generateDocument(sub)}
                                  disabled={!subSpeaker.trim()}
                                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold text-primary-200 bg-primary-200/10 hover:bg-primary-200/20 border border-primary-200/20 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                  title="Gerar carta convite em .docx"
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

                // Discurso Regular ou Oração/Cântico
                runningOffset += itemDuration;
                const speakerName = speakers[item.id] || '';
                const speakerCong = congregations[item.id] || '';
                const speakerNote = notes[item.id] || '';
                const isConfirmed = !!confirmedSpeakers[item.id];
                const hasSpeaker = !item.noSpeaker;

                return (
                  <div
                    key={`resp-item-${item.id || itemIdx}`}
                    className={`p-4 rounded-3xl bg-surface-100 border border-surface-300 shadow-2xs space-y-3.5 transition-all ${
                      hasSpeaker && isConfirmed ? 'ring-1 ring-emerald-500/30' : ''
                    }`}
                  >
                    {/* Linha de Cabeçalho da Parte */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-mono font-bold text-typography-500">
                            {itemStartTime}
                          </span>
                          {item.duration && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-surface-200 text-typography-600">
                              {item.duration} min
                            </span>
                          )}
                          {isMusicOrPrayer && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-surface-200 text-typography-500">
                              Cântico/Oração
                            </span>
                          )}
                        </div>
                        <h4 className="text-sm font-black text-typography-900 leading-snug">
                          {item.title}
                        </h4>
                      </div>
                    </div>

                    {/* Campos de Entrada caso tenha orador */}
                    {hasSpeaker && (
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                          <div>
                            <label className="block text-[10px] uppercase font-bold text-typography-500 mb-1">
                              Orador
                            </label>
                            <input
                              type="text"
                              value={speakerName}
                              onChange={(e) => handleSpeakerChange(item.id, e.target.value)}
                              placeholder="Nome do orador..."
                              className="w-full h-9 px-3 rounded-xl bg-surface-200/50 border border-surface-300 text-xs font-bold text-typography-900 focus:outline-none focus:ring-2 focus:ring-primary-200/40"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] uppercase font-bold text-typography-500 mb-1">
                              Congregação
                            </label>
                            <input
                              type="text"
                              value={speakerCong}
                              onChange={(e) => handleCongregationChange(item.id, e.target.value)}
                              placeholder="Congregação..."
                              className="w-full h-9 px-3 rounded-xl bg-surface-200/50 border border-surface-300 text-xs text-typography-700 focus:outline-none focus:ring-2 focus:ring-primary-200/40"
                            />
                          </div>

                          <div className="sm:col-span-2 lg:col-span-1">
                            <label className="block text-[10px] uppercase font-bold text-typography-500 mb-1">
                              Observações
                            </label>
                            <input
                              type="text"
                              value={speakerNote}
                              onChange={(e) => handleNotesChange(item.id, e.target.value)}
                              placeholder="Notas..."
                              className="w-full h-9 px-3 rounded-xl bg-surface-200/50 border border-surface-300 text-xs text-typography-700 focus:outline-none focus:ring-2 focus:ring-primary-200/40"
                            />
                          </div>
                        </div>

                        {/* Botões de Confirmação e Carta */}
                        <div className="flex items-center justify-between pt-1 border-t border-surface-300/50">
                          <button
                            onClick={() => handleConfirmationToggle(item.id)}
                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                              isConfirmed
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                : 'bg-surface-200 text-typography-500 hover:text-typography-700 border border-surface-300'
                            }`}
                          >
                            {isConfirmed ? <CheckCircle2 size={13} /> : <Circle size={13} />}
                            <span>{isConfirmed ? 'Confirmado' : 'Marcar Confirmado'}</span>
                          </button>

                          <button
                            onClick={() => generateDocument(item)}
                            disabled={!speakerName.trim()}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold text-primary-200 bg-primary-200/10 hover:bg-primary-200/20 border border-primary-200/20 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                            title="Gerar carta convite em .docx"
                          >
                            <FileDown size={13} />
                            <span>Gerar Carta</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              });
            })()}
          </div>
        </div>
      )}

      {/* A4 Document Viewport Container */}
      <div 
        ref={containerRef}
        className={`pioneer-viewport w-full overflow-x-auto overflow-y-auto bg-slate-200/80 rounded-3xl p-3 sm:p-6 lg:p-8 flex-col items-center gap-8 shadow-inner custom-scrollbar relative border border-slate-300/80 ${
          viewMode === 'a4' ? 'flex' : 'hidden print:flex'
        }`}
        style={{
          minHeight: '400px',
          touchAction: 'pan-x pan-y',
        }}
      >
        {/* Render A4 Page */}
        {pioneerProgram.sessions.map((session, pageIdx) => {
          const pageNum = pageIdx + 1;
          const totalPages = pioneerProgram.sessions.length;

          return (
            <div key={session.period || pageIdx} className="pioneer-session-wrapper flex flex-col items-center w-full">
              {/* Scaled Document Wrapper — Strict Proportional Model (A4 Portrait) */}
              <div 
                className="pioneer-scale-wrapper mx-auto shrink-0 relative transition-all duration-150"
                style={{
                  width: `${(210 * zoom) / 100}mm`,
                  minWidth: `${(210 * zoom) / 100}mm`,
                  height: `${(297 * zoom) / 100}mm`,
                  minHeight: `${(297 * zoom) / 100}mm`,
                }}
              >
                {/* Physical A4 Digital Document Sheet — Rigid Fixed Dimensions (210 x 297 mm) */}
                <div 
                  id={`pioneer-meeting-a4-page-${pageNum}`}
                  ref={pageIdx === 0 ? sheetRef : undefined}
                  className="pioneer-a4-page bg-white text-slate-900 shadow-2xl rounded-xs border border-gray-300 print:shadow-none print:border-none print:m-0 flex flex-col justify-between box-border select-text"
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
                  {/* Top Content Block: Header + Session Items */}
                  <div className="flex flex-col flex-1 min-h-0">
                    {/* Header Banner with Theme Artwork & Integrated Event Metadata */}
                    <div className="relative w-full rounded-2xl overflow-hidden mb-3 shadow-md border border-slate-200 bg-slate-900 text-white shrink-0">
                      {/* Background Image Artwork / Gradient Fallback */}
                      {(details.customHeaderImage || pioneerProgram.headerImage) ? (
                        <div className="absolute inset-0 z-0">
                          <Image 
                            src={details.customHeaderImage || pioneerProgram.headerImage} 
                            alt={details.assemblyTheme || pioneerProgram.theme || 'Reunião Especial com Pioneiros'}
                            fill
                            className="object-cover"
                            style={{ objectPosition: 'center 25%' }}
                            priority
                            quality={100}
                            unoptimized
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/80" />
                        </div>
                      ) : (
                        <div className="absolute inset-0 z-0 bg-gradient-to-br from-slate-900 via-violet-950 to-slate-900" />
                      )}

                      {/* Overlaid Banner Content */}
                      <div className="relative z-10 p-3 flex flex-col justify-between min-h-[36mm]">
                        {/* Top Bar: Program Title & Part Pill */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-[7.5pt] font-black uppercase tracking-widest text-violet-200/90 drop-shadow-sm flex items-center gap-1.5 min-w-0">
                            <span className="w-2 h-2 rounded-full bg-violet-400 shrink-0"></span>
                            <span className="truncate">{pioneerProgram.title}</span>
                          </div>
                          <span className="text-[7.5pt] font-black uppercase tracking-wider text-violet-950 bg-violet-300 px-2.5 py-0.5 rounded-full shadow-sm shrink-0">
                            PARTE {['A', 'B', 'C', 'D'][selectedPart] || 'A'}
                          </span>
                        </div>

                        {/* Main Theme Verse Typography */}
                        <div className="my-1 space-y-0.5">
                          <div className="text-[12.5pt] font-black uppercase tracking-tight text-violet-200 drop-shadow-md leading-tight">
                            {details.assemblyTheme || pioneerProgram.theme}
                          </div>
                        </div>

                        {/* Bottom Event Metadata Strip with Icons */}
                        <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
                          <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1">
                            <div className="flex items-center gap-1.5 text-[7.5pt] font-bold uppercase tracking-wider text-white/95 drop-shadow-sm">
                              <CalendarDays size={12} className="text-violet-300 shrink-0" />
                              <span>{details.eventDate || 'Data a definir'}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-[7.5pt] font-bold uppercase tracking-wider text-white/95 drop-shadow-sm">
                              <MapPin size={12} className="text-violet-300 shrink-0" />
                              <span>{details.eventLocation || 'Local a definir'}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-[7.5pt] font-bold uppercase tracking-wider text-white/95 drop-shadow-sm">
                              <Clock size={12} className="text-violet-300 shrink-0" />
                              <span>Início: {details.startTime || '09:00'}</span>
                            </div>
                            {details.rehearsalDate && (
                              <div className="flex items-center gap-1.5 text-[7pt] font-bold uppercase tracking-wider text-white/80 drop-shadow-sm">
                                <Clock size={11} className="text-violet-300/80 shrink-0" />
                                <span>Ensaio: {details.rehearsalDate}{details.rehearsalLocation ? ` — ${details.rehearsalLocation}` : ''}</span>
                              </div>
                            )}
                          </div>

                          <button
                            onClick={() => setShowEditDetailsModal(true)}
                            className="no-print text-[7pt] font-bold text-violet-200 hover:text-white flex items-center gap-1 cursor-pointer bg-white/15 hover:bg-white/25 px-2 py-0.5 rounded-md transition-all ml-auto drop-shadow-sm"
                            title="Editar informações e imagem do evento"
                          >
                            <Edit3 size={10} />
                            <span>Editar</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Session Content */}
                    <div className="flex flex-col flex-1 min-h-0">
                      {/* Session Header Bar */}
                      <div className="flex items-baseline justify-between border-b-2 border-violet-500 pb-1 mb-2">
                        <h3 className="text-[11pt] font-black tracking-wider uppercase text-violet-900">
                          PROGRAMA DA REUNIÃO ESPECIAL COM OS PIONEIROS
                        </h3>
                        <span className="text-[7.5pt] font-bold tracking-wider uppercase text-gray-400">
                          HORÁRIO • PROGRAMA • ORADOR
                        </span>
                      </div>

                      {/* Items List */}
                      <div className="space-y-1.5 flex-1 session-items-container">
                        {(() => {
                          let runningOffset = 0;

                          return session.items.map((item: PioneerItem) => {
                            const isSymposium = item.subitems && item.subitems.length > 0;
                            const isIntermission = item.isInterval;
                            const isMusicOrPrayer = item.noSpeaker && !isSymposium && !isIntermission;
                            
                            const itemStartTime = calculateTime(details.startTime, runningOffset);
                            const itemDuration = item.duration || (isMusicOrPrayer ? 5 : isIntermission ? 20 : isSymposium ? 60 : 15);

                            if (isSymposium) {
                              let subOffset = runningOffset;
                              runningOffset += itemDuration;

                              return (
                                <div key={item.id} className="bg-violet-50/30 rounded p-1.5 border border-violet-100/60 my-1 session-item-row symposium-box">
                                  {/* Symposium Title Row */}
                                  <div className="flex items-start gap-2 mb-1">
                                    <span className="text-[8.5pt] font-black text-violet-700 w-11 shrink-0 mt-0.5">
                                      {itemStartTime}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                      <span className="text-[7.5pt] font-extrabold uppercase text-violet-700 tracking-wider mr-1.5 block leading-tight">
                                        {item.label || 'SÉRIE DE DISCURSOS:'}
                                      </span>
                                      <span className="text-[9.5pt] font-bold text-gray-950 leading-tight">
                                        {item.title}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Symposium Subitems */}
                                  <div className="ml-11 border-l-2 border-violet-300/80 pl-2.5 space-y-1.5 mt-1">
                                    {item.subitems?.map((sub, idx) => {
                                      const subStartTime = calculateTime(details.startTime, subOffset);
                                      subOffset += sub.duration || 15;

                                      const subSpeaker = speakers[sub.id] || '';
                                      const subCong = congregations[sub.id] || '';
                                      const subNote = notes[sub.id] || '';
                                      const isConfirmed = !!confirmedSpeakers[sub.id];

                                      return (
                                        <div key={sub.id} className="border-b border-violet-100/50 pb-1 last:border-b-0 symposium-subitem">
                                          <div className="flex items-start justify-between gap-1.5">
                                            <div className="flex items-start gap-1 flex-1 min-w-0">
                                              <span className="text-violet-700 font-black text-[8.5pt] shrink-0 mt-0.5">
                                                {idx + 1}.
                                              </span>
                                              <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                  <span className="text-[9pt] font-semibold text-gray-900 leading-tight">
                                                    {sub.title}
                                                  </span>
                                                  <span className="text-[7.5pt] font-bold text-violet-700 bg-violet-100/60 px-1 py-0.2 rounded">
                                                    {subStartTime}
                                                  </span>
                                                </div>

                                                <div className="grid grid-cols-2 gap-1 mt-0.5 speaker-grid">
                                                  <div className="relative">
                                                    <input
                                                      type="text"
                                                      placeholder="Nome do orador..."
                                                      value={subSpeaker}
                                                      onChange={e => handleSpeakerChange(sub.id, e.target.value)}
                                                      className={`w-full text-[8.5pt] font-medium text-gray-900 bg-transparent border-b border-gray-200/80 focus:border-violet-500 outline-none placeholder:text-gray-300 ${!subSpeaker ? 'print:hidden' : ''}`}
                                                    />
                                                    {!subSpeaker && (
                                                      <div className="hidden print:flex items-baseline w-full text-[8pt] text-gray-600 font-normal">
                                                        <span className="text-[7pt] font-semibold text-gray-400 mr-1 shrink-0">Orador:</span>
                                                        <span className="flex-1 border-b border-dotted border-gray-400 pb-0.5">&nbsp;</span>
                                                      </div>
                                                    )}
                                                  </div>
                                                  <div className="relative">
                                                    <input
                                                      type="text"
                                                      placeholder="Congregação..."
                                                      value={subCong}
                                                      onChange={e => handleCongregationChange(sub.id, e.target.value)}
                                                      className={`w-full text-[8pt] text-gray-600 bg-transparent border-b border-gray-200/80 focus:border-violet-500 outline-none placeholder:text-gray-300 ${!subCong ? 'print:hidden' : ''}`}
                                                    />
                                                    {!subCong && (
                                                      <div className="hidden print:flex items-baseline w-full text-[8pt] text-gray-500 font-normal">
                                                        <span className="text-[7pt] font-semibold text-gray-400 mr-1 shrink-0">Cong:</span>
                                                        <span className="flex-1 border-b border-dotted border-gray-300 pb-0.5">&nbsp;</span>
                                                      </div>
                                                    )}
                                                  </div>
                                                </div>
                                              </div>
                                            </div>

                                            {/* Action buttons (Screen only) */}
                                            <div className="no-print flex items-center gap-1 shrink-0 mt-0.5">
                                              <button
                                                onClick={() => handleConfirmationToggle(sub.id)}
                                                className={`p-1 rounded transition-colors cursor-pointer ${
                                                  isConfirmed ? 'text-emerald-600 hover:bg-emerald-50' : 'text-gray-300 hover:text-gray-500'
                                                }`}
                                                title={isConfirmed ? "Orador Confirmado" : "Clique para marcar como Confirmado"}
                                              >
                                                {isConfirmed ? <CheckCircle2 size={13} /> : <Circle size={13} />}
                                              </button>
                                              <button
                                                onClick={() => generateDocument(sub)}
                                                className="p-1 text-gray-400 hover:text-violet-700 hover:bg-violet-50 rounded transition-colors cursor-pointer"
                                                title="Gerar carta convite em .docx"
                                              >
                                                <FileDown size={13} />
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

                            // Intermissão / Intervalo
                            if (isIntermission) {
                              runningOffset += itemDuration;
                              return (
                                <div key={item.id} className="p-1.5 rounded bg-gray-50/70 border border-gray-100 my-1">
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                      <span className="text-[8.5pt] font-black text-gray-500 w-11 shrink-0">
                                        {itemStartTime}
                                      </span>
                                      <span className="text-[9pt] font-bold text-gray-600 italic flex items-center gap-1.5">
                                        <Coffee size={13} className="text-gray-400" />
                                        {item.title} ({itemDuration} min)
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              );
                            }

                            // Cântico e Oração
                            if (isMusicOrPrayer) {
                              runningOffset += itemDuration;
                              const speakerName = speakers[item.id] || '';

                              return (
                                <div key={item.id} className="p-1.5 rounded border-b border-gray-100 hover:bg-gray-50/50">
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                      <span className="text-[8.5pt] font-black text-violet-700 w-11 shrink-0">
                                        {itemStartTime}
                                      </span>
                                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 flex-1 min-w-0">
                                        <span className="text-[9pt] font-semibold text-gray-600 italic flex items-center gap-1.5 shrink-0">
                                          <Music size={13} className="text-violet-500" />
                                          {item.title}
                                        </span>
                                        
                                        <div className="flex-1 min-w-[120px] max-w-[250px] relative">
                                          <input
                                            type="text"
                                            placeholder="Nome do orador..."
                                            value={speakerName}
                                            onChange={e => handleSpeakerChange(item.id, e.target.value)}
                                            className={`w-full text-[8.5pt] font-bold text-gray-900 bg-transparent border-b border-gray-200/80 focus:border-violet-500 outline-none placeholder:text-gray-300 ${!speakerName ? 'print:hidden' : ''}`}
                                          />
                                          {!speakerName && (
                                            <div className="hidden print:flex items-baseline w-full text-[8pt] text-gray-400 font-normal">
                                              <span className="flex-1 border-b border-dotted border-gray-300 pb-0.5">&nbsp;</span>
                                            </div>
                                          )}
                                        </div>

                                        <div className="no-print flex items-center gap-1 shrink-0 ml-auto">
                                          <button
                                            onClick={() => handleConfirmationToggle(item.id)}
                                            className={`p-1 rounded transition-colors cursor-pointer ${
                                              confirmedSpeakers[item.id] ? 'text-emerald-600 hover:bg-emerald-50' : 'text-gray-300 hover:text-gray-500'
                                            }`}
                                            title={confirmedSpeakers[item.id] ? "Orador Confirmado" : "Clique para marcar como Confirmado"}
                                          >
                                            {confirmedSpeakers[item.id] ? <CheckCircle2 size={13} /> : <Circle size={13} />}
                                          </button>
                                          <button
                                            onClick={() => generateDocument(item)}
                                            className="p-1 text-gray-400 hover:text-violet-700 hover:bg-violet-50 rounded transition-colors cursor-pointer"
                                            title="Gerar carta convite em .docx"
                                          >
                                            <FileDown size={13} />
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            }

                            // Discurso Regular
                            runningOffset += itemDuration;
                            const speakerName = speakers[item.id] || '';
                            const speakerCong = congregations[item.id] || '';
                            const speakerNote = notes[item.id] || '';
                            const isConfirmed = !!confirmedSpeakers[item.id];

                            return (
                              <div key={item.id} className="p-1.5 rounded border-b border-gray-100 hover:bg-gray-50/50 session-item-row">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex items-start gap-2 flex-1 min-w-0">
                                    <span className="text-[8.5pt] font-black text-violet-700 w-11 shrink-0 mt-0.5">
                                      {itemStartTime}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="text-[9pt] font-bold text-gray-900 leading-tight">
                                          {item.title}
                                        </span>
                                      </div>

                                      <div className="grid grid-cols-2 gap-1.5 mt-1 speaker-grid">
                                        <div className="relative">
                                          <input
                                            type="text"
                                            placeholder="Nome do orador..."
                                            value={speakerName}
                                            onChange={e => handleSpeakerChange(item.id, e.target.value)}
                                            className={`w-full text-[9pt] font-bold text-gray-900 bg-transparent border-b border-gray-200/80 focus:border-violet-500 outline-none placeholder:text-gray-300 ${!speakerName ? 'print:hidden' : ''}`}
                                          />
                                          {!speakerName && (
                                            <div className="hidden print:flex items-baseline w-full text-[8.5pt] text-gray-600 font-normal">
                                              <span className="text-[7.5pt] font-semibold text-gray-400 mr-1.5 shrink-0">
                                                Orador:
                                              </span>
                                              <span className="flex-1 border-b border-dotted border-gray-400 pb-0.5">&nbsp;</span>
                                            </div>
                                          )}
                                        </div>

                                        <div className="relative">
                                          <input
                                            type="text"
                                            placeholder="Congregação..."
                                            value={speakerCong}
                                            onChange={e => handleCongregationChange(item.id, e.target.value)}
                                            className={`w-full text-[8.5pt] text-gray-600 bg-transparent border-b border-gray-200/80 focus:border-violet-500 outline-none placeholder:text-gray-300 ${!speakerCong ? 'print:hidden' : ''}`}
                                          />
                                          {!speakerCong && (
                                            <div className="hidden print:flex items-baseline w-full text-[8.5pt] text-gray-500 font-normal">
                                              <span className="text-[7.5pt] font-semibold text-gray-400 mr-1.5 shrink-0">Cong:</span>
                                              <span className="flex-1 border-b border-dotted border-gray-400 pb-0.5">&nbsp;</span>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Action buttons (Screen only) */}
                                  <div className="no-print flex items-center gap-1 shrink-0 mt-0.5">
                                    <button
                                      onClick={() => handleConfirmationToggle(item.id)}
                                      className={`p-1 rounded transition-colors cursor-pointer ${
                                        isConfirmed ? 'text-emerald-600 hover:bg-emerald-50' : 'text-gray-300 hover:text-gray-500'
                                      }`}
                                      title={isConfirmed ? "Orador Confirmado" : "Clique para marcar como Confirmado"}
                                    >
                                      {isConfirmed ? <CheckCircle2 size={15} /> : <Circle size={15} />}
                                    </button>
                                    <button
                                      onClick={() => generateDocument(item)}
                                      className="p-1 text-gray-400 hover:text-violet-700 hover:bg-violet-50 rounded transition-colors cursor-pointer"
                                      title="Gerar carta convite em .docx"
                                    >
                                      <FileDown size={15} />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* Rigid Document Footer */}
                  <div className="border-t border-gray-200 pt-1.5 mt-2 flex items-center justify-between text-[7pt] text-gray-400 font-medium shrink-0">
                    <span className="truncate">
                      {pioneerProgram.title} • {details.assemblyTheme || pioneerProgram.theme}
                    </span>
                    <span className="shrink-0 ml-2 font-bold text-gray-500">
                      Página {pageNum} de {totalPages} • S-312
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL: EDITAR DADOS DO EVENTO */}
      <AnimatePresence>
        {showEditDetailsModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[6000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm no-print">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-white rounded-3xl p-6 max-w-xl w-full shadow-2xl border border-gray-100 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-gray-100">
                <div className="flex items-center gap-2 text-violet-900">
                  <CalendarDays size={20} className="text-violet-600" />
                  <h3 className="text-base font-black uppercase tracking-tight">Dados do Evento • Parte {['A', 'B', 'C', 'D'][selectedPart]}</h3>
                </div>
                <button onClick={() => setShowEditDetailsModal(false)} className="p-1 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors cursor-pointer">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 ml-1">Tema da Reunião Especial</label>
                  <input
                    type="text"
                    value={details.assemblyTheme || ''}
                    onChange={e => updateDetails(d => ({ ...d, assemblyTheme: e.target.value }))}
                    placeholder="Ex: “Estabeleça alvos para enriquecer seu ministério!” — Prov. 4:25"
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-900 focus:bg-white focus:border-violet-500 outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 ml-1">Horário de Início</label>
                    <input
                      type="time"
                      value={details.startTime || '09:00'}
                      onChange={e => updateDetails(d => ({ ...d, startTime: e.target.value }))}
                      className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-900 focus:bg-white focus:border-violet-500 outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 ml-1">Data do Evento</label>
                    <input
                      type="text"
                      value={details.eventDate || ''}
                      onChange={e => updateDetails(d => ({ ...d, eventDate: e.target.value }))}
                      placeholder="Ex: 15 de Outubro de 2026"
                      className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-900 focus:bg-white focus:border-violet-500 outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 ml-1">Local do Evento</label>
                  <input
                    type="text"
                    value={details.eventLocation || ''}
                    onChange={e => updateDetails(d => ({ ...d, eventLocation: e.target.value }))}
                    placeholder="Ex: Salão de Assembleias de Vargem Grande Paulista"
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-900 focus:bg-white focus:border-violet-500 outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-gray-100">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 ml-1">Data do Ensaio</label>
                    <input
                      type="text"
                      value={details.rehearsalDate || ''}
                      onChange={e => updateDetails(d => ({ ...d, rehearsalDate: e.target.value }))}
                      placeholder="Ex: 10 de Outubro às 19:30"
                      className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-900 focus:bg-white focus:border-violet-500 outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 ml-1">Local do Ensaio</label>
                    <input
                      type="text"
                      value={details.rehearsalLocation || ''}
                      onChange={e => updateDetails(d => ({ ...d, rehearsalLocation: e.target.value }))}
                      placeholder="Ex: Salão do Reino / Zoom"
                      className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-900 focus:bg-white focus:border-violet-500 outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1 pt-2 border-t border-gray-100">
                  <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 ml-1">URL da Imagem do Cabeçalho (Opcional)</label>
                  <input
                    type="text"
                    value={details.customHeaderImage || ''}
                    onChange={e => updateDetails(d => ({ ...d, customHeaderImage: e.target.value }))}
                    placeholder="Ex: https://... (opcional, deixe em branco para gradiente)"
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-900 focus:bg-white focus:border-violet-500 outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 ml-1">Material Necessário para a Reunião</label>
                  <textarea
                    rows={2}
                    value={details.material || ''}
                    onChange={e => updateDetails(d => ({ ...d, material: e.target.value }))}
                    placeholder="Ex: Formulários S-312, folhas de metas, canetas..."
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-900 focus:bg-white focus:border-violet-500 outline-none resize-none"
                  />
                </div>
              </div>

              <div className="mt-6 flex flex-col sm:flex-row justify-end gap-3 border-t border-gray-100 pt-5">
                {!isGuest && (
                  <button
                    onClick={async () => {
                      const ok = await handleSave();
                      if (ok) setShowEditDetailsModal(false);
                    }}
                    disabled={isSaving}
                    className="flex-[2] flex items-center justify-center gap-2 px-6 py-3 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer transition-all shadow-lg shadow-violet-100 active:scale-[0.98] disabled:opacity-50"
                  >
                    {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    <span>Salvar Parte {['A', 'B', 'C', 'D'][selectedPart]}</span>
                  </button>
                )}
                <button
                  onClick={() => setShowEditDetailsModal(false)}
                  className="flex-1 px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer transition-colors"
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL: ATUALIZAR PROGRAMAÇÃO (COLAR) */}
      <AnimatePresence>
        {showUpdateModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[6000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm no-print">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-white rounded-3xl p-6 max-w-xl w-full shadow-2xl border border-gray-100 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-gray-100">
                <div className="flex items-center gap-2 text-violet-900">
                  <RefreshCw size={20} className="text-violet-600" />
                  <h3 className="text-base font-black uppercase tracking-tight">Atualizar Programação ({selectedYear})</h3>
                </div>
                <button onClick={() => setShowUpdateModal(false)} className="p-1 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors cursor-pointer">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4">
                <p className="text-xs text-gray-600">
                  Cole abaixo o texto copiado do programa oficial da Reunião Especial com os Pioneiros (S-312). O sistema extrairá automaticamente títulos, temas, séries de discursos e tempos.
                </p>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 ml-1">Título do Evento</label>
                  <input
                    type="text"
                    value={updateTitle}
                    onChange={e => setUpdateTitle(e.target.value)}
                    placeholder="Programa para a Reunião Especial com os Pioneiros e Missionários de 2027"
                    className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-900 outline-none focus:bg-white focus:border-violet-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 ml-1">Tema da Reunião</label>
                  <input
                    type="text"
                    value={updateTheme}
                    onChange={e => setUpdateTheme(e.target.value)}
                    placeholder="“Estabeleça alvos para enriquecer seu ministério!” — Prov. 4:25"
                    className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-900 outline-none focus:bg-white focus:border-violet-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 ml-1">Colar Texto do Programa</label>
                  <textarea
                    rows={8}
                    value={updatePastedText}
                    onChange={e => setUpdatePastedText(e.target.value)}
                    placeholder="Cole aqui o texto da programação..."
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono text-gray-900 outline-none focus:bg-white focus:border-violet-500 resize-y"
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-2">
                <button
                  onClick={() => setShowUpdateModal(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveUpdateProgram}
                  className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer transition-colors shadow-md shadow-violet-200"
                >
                  Salvar Programação
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL: ADICIONAR PRÓXIMA TEMPORADA (COLAR) */}
      <AnimatePresence>
        {showAddNextModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[6000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm no-print">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-white rounded-3xl p-6 max-w-xl w-full shadow-2xl border border-gray-100 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-gray-100">
                <div className="flex items-center gap-2 text-blue-900">
                  <Plus size={20} className="text-blue-600" />
                  <h3 className="text-base font-black uppercase tracking-tight">Adicionar Próxima Temporada</h3>
                </div>
                <button onClick={() => setShowAddNextModal(false)} className="p-1 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors cursor-pointer">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4">
                <p className="text-xs text-gray-600">
                  Informe o ano de serviço da nova temporada e cole o texto do programa correspondente para disponibilizá-lo para preenchimento.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1 sm:col-span-1">
                    <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 ml-1">Ano / Temporada</label>
                    <input
                      type="text"
                      value={newSeasonYear}
                      onChange={e => setNewSeasonYear(e.target.value)}
                      placeholder="Ex: 2027-2028"
                      className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-900 outline-none focus:bg-white focus:border-blue-500"
                    />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 ml-1">Título do Evento</label>
                    <input
                      type="text"
                      value={addNextTitle}
                      onChange={e => setAddNextTitle(e.target.value)}
                      placeholder="Programa para a Reunião Especial com os Pioneiros e Missionários de 2028"
                      className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-900 outline-none focus:bg-white focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 ml-1">Tema da Reunião</label>
                  <input
                    type="text"
                    value={addNextTheme}
                    onChange={e => setAddNextTheme(e.target.value)}
                    placeholder="Informe o tema oficial da nova temporada..."
                    className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-900 outline-none focus:bg-white focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 ml-1">Colar Texto da Programação</label>
                  <textarea
                    rows={8}
                    value={addNextPastedText}
                    onChange={e => setAddNextPastedText(e.target.value)}
                    placeholder="Cole aqui o texto da nova programação..."
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono text-gray-900 outline-none focus:bg-white focus:border-blue-500 resize-y"
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-2">
                <button
                  onClick={() => setShowAddNextModal(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveAddNextProgram}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer transition-colors shadow-md shadow-blue-200"
                >
                  Criar e Ativar Temporada
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* CONFIRM MODAL (Sair sem salvar) */}
      <AnimatePresence>
        {hasChanges && !isGuest && !showEditDetailsModal && (
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
                  {pioneerProgram.year} • Reunião Especial
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => setPartsData(JSON.parse(initialPartsData))}
                disabled={isSaving}
                className="px-2.5 py-1.5 text-xs font-semibold text-typography-500 hover:text-typography-800 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
              >
                Descartar
              </button>
              <button
                onClick={() => handleSave(true)}
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

        {showConfirmModal && (
          <div className="fixed inset-0 z-[6000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm no-print">
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
                    {pioneerProgram.year} • Reunião Especial
                  </span>
                </div>
              </div>

              <p className="text-xs sm:text-sm text-typography-500 leading-relaxed mb-5">
                Você fez alterações nas designações que ainda não foram salvas. Deseja salvar antes de continuar?
              </p>

              <div className="flex flex-col gap-2">
                <button 
                  onClick={async () => { const success = await handleSave(false); if (success) { setShowConfirmModal(false); if (pendingAction) pendingAction(); } }} 
                  className="w-full py-2.5 sm:py-3 px-4 bg-primary-200 hover:bg-primary-150 text-white rounded-xl font-bold text-xs sm:text-sm shadow-xs transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
                >
                  <Save size={15} />
                  <span>Salvar e Continuar</span>
                </button>
                <button 
                  onClick={() => { setShowConfirmModal(false); if (pendingAction) pendingAction(); }} 
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
    </div>
  );
}
