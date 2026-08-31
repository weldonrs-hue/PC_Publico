'use client';

import Image from 'next/image';
import { useState, useEffect, useRef } from 'react';
import { Store, ChevronLeft, Calendar, Clock, BookOpen, Music, Info, User, Save, AlertTriangle, Loader2, Printer, MapPin, CalendarDays, ChevronDown, ChevronUp, FileDown, FileText, Download, CheckCircle2, Circle, RefreshCw, Search, Check, ZoomIn, ZoomOut, Maximize2, Minimize2, RotateCcw, Edit3, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, collection, getDocs, query, where, limit } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '@/utils/firestore';
import { useDialog } from '@/hooks/useDialog';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { cleanPSSMetadata } from '@/lib/docxUtils';

interface CircuitAssemblyViewProps {
  userId: string;
  isGuest?: boolean;
  onBack: () => void;
  type: 'supt' | 'branch';
}

interface AssemblyDetails {
  eventDate: string;
  eventLocation: string;
  rehearsalDate: string;
  rehearsalLocation: string;
  assemblyTheme: string;
}

interface PartData {
  speakers: Record<string, string>;
  congregations?: Record<string, string>;
  notes?: Record<string, string>;
  confirmations: Record<string, boolean>;
  userTimes?: Record<string, string>;
  details: AssemblyDetails;
  orphanedParts?: Record<string, { 
    speaker: string; 
    congregation: string;
    notes: string;
    confirmation: boolean; 
    originalTitle: string; 
    originalTime: string; 
    reason: string;
  }>;
}

const programsByYear = {
  '2026-2027': {
    supt: {
      title: 'Programa da Assembleia de Circuito de 2026-2027 com o Superintendente de Circuito',
      year: '2026-2027',
      theme: '“Feliz É Aquele Que Confia em Jeová” — Provérbios 16:20',
      color: '#F59E0B', // Amber
      headerImage: 'https://cms-imgp.jw-cdn.org/img/p/1102027245/univ/art/1102027245_univ_lsr_xl.jpg',
      sessions: [
        {
          period: 'Manhã',
          items: [
            { id: 'm0', title: 'PRESIDENTE DE SESSÃO', icon: User, isRole: true },
            { id: 'm1', time: '9:40', title: 'Música', icon: Music, noSpeaker: true },
            { id: 'm2', time: '9:50', title: 'Cântico 31 e oração', icon: Music },
            { id: 'm3', time: '10:00', title: 'Por que ‘confiar em Jeová de todo o seu coração’?', icon: BookOpen },
            { 
              id: 'm4', 
              time: '10:15', 
              label: 'SÉRIE DE DISCURSOS:', 
              title: 'Imite aqueles que confiaram em Jeová!', 
              icon: BookOpen,
              noSpeaker: true,
              isSeries: true,
              subitems: [
                { id: 'm4_1', title: 'Baraque' },
                { id: 'm4_2', title: 'A mulher sunamita' },
                { id: 'm4_3', title: 'Daniel, Hananias, Misael e Azarias' }
              ]
            },
            { id: 'm5', time: '11:05', title: 'Cântico 57 e anúncios', icon: Info, noSpeaker: true },
            { id: 'm6', time: '11:15', title: 'Ajude as pessoas a confiar no “Deus vivente e verdadeiro”', icon: BookOpen },
            { id: 'm7', time: '11:35', title: '“Seu Pai, que observa em secreto, o recompensará”', icon: BookOpen },
            { id: 'm8', time: '12:05', title: 'Cântico 29 e intervalo', icon: Clock, noSpeaker: true }
          ]
        },
        {
          period: 'Tarde',
          items: [
            { id: 't0', title: 'PRESIDENTE DE SESSÃO', icon: User, isRole: true },
            { id: 't1', time: '1:20', title: 'Música', icon: Music, noSpeaker: true },
            { id: 't2', time: '1:30', title: 'Cântico 8 e oração', icon: Music },
            { id: 't3', time: '1:35', label: 'DISCURSO PARA O PÚBLICO:', title: 'Em quem você realmente pode confiar?', icon: BookOpen },
            { id: 't4', time: '2:05', title: 'Resumo de A Sentinela', icon: BookOpen },
            { id: 't5', time: '2:35', title: 'Cântico 135 e anúncios', icon: Info, noSpeaker: true },
            { 
              id: 't6', 
              time: '2:45', 
              label: 'SÉRIE DE DISCURSOS:', 
              title: 'Confie na sabedoria de Jeová', 
              icon: BookOpen,
              noSpeaker: true,
              isSeries: true,
              subitems: [
                { id: 't6_1', title: 'Ao orientar seus filhos' },
                { id: 't6_2', title: 'Ao fazer planos para o futuro' },
                { id: 't6_3', title: 'Ao enfrentar tentações' }
              ]
            },
            { id: 't7', time: '3:30', title: '“Feliz é aquele que confia em Jeová”', icon: BookOpen },
            { id: 't8', time: '4:00', title: 'Cântico 54 e oração final', icon: Music }
          ]
        }
      ]
    },
    branch: {
      title: 'Programa da Assembleia de Circuito de 2026-2027 com o Representante de Betel',
      year: '2026-2027',
      theme: '“Encontre a Mais Plena Alegria em Jeová” — Salmo 37:4',
      color: '#F43F5E', // Rose
      headerImage: 'https://cms-imgp.jw-cdn.org/img/p/1102027241/univ/art/1102027241_univ_lsr_xl.jpg',
      sessions: [
        {
          period: 'Manhã',
          items: [
            { id: 'm0', title: 'PRESIDENTE DE SESSÃO', icon: User, isRole: true },
            { id: 'm1', time: '9:40', title: 'Música', icon: Music, noSpeaker: true },
            { id: 'm2', time: '9:50', title: 'Cântico 7 e oração', icon: Music },
            { id: 'm3', time: '10:00', title: '“Encontre a mais plena alegria em Jeová” — Como?', icon: BookOpen },
            { id: 'm4', time: '10:15', title: '“Feliz aquele . . . cujo pecado é desculpado”', icon: BookOpen },
            { id: 'm5', time: '10:30', title: '“Felizes são os que moram na tua casa!”', icon: BookOpen },
            { id: 'm6', time: '10:55', title: 'Cântico 37 e anúncios', icon: Info, noSpeaker: true },
            { id: 'm7', time: '11:05', title: '‘Feliz o homem que se refugia em Jeová’', icon: BookOpen },
            { id: 'm8', time: '11:35', title: '“Seu Pai, que observa em secreto, o recompensará”', icon: BookOpen },
            { id: 'm9', time: '12:05', title: 'Cântico 38 e intervalo', icon: Clock, noSpeaker: true }
          ]
        },
        {
          period: 'Tarde',
          items: [
            { id: 't0', title: 'PRESIDENTE DE SESSÃO', icon: User, isRole: true },
            { id: 't1', time: '1:20', title: 'Música', icon: Music, noSpeaker: true },
            { id: 't2', time: '1:30', title: 'Cântico 111', icon: Music, noSpeaker: true },
            { id: 't3', time: '1:35', title: 'Experiências', icon: Info },
            { id: 't4', time: '1:45', title: 'Resumo de A Sentinela', icon: BookOpen },
            { 
              id: 't5', 
              time: '2:15', 
              label: 'SÉRIE DE DISCURSOS:', 
              title: 'Busque o que traz verdadeira felicidade', 
              icon: BookOpen,
              noSpeaker: true,
              isSeries: true,
              subitems: [
                { id: 't5_1', title: 'Um estilo de vida simples' },
                { id: 't5_2', title: 'Bons amigos' },
                { id: 't5_3', title: 'Uma família unida' }
              ]
            },
            { id: 't6', time: '3:00', title: 'Cântico 88 e anúncios', icon: Info, noSpeaker: true },
            { id: 't7', time: '3:10', title: '“Feliz o povo cujo Deus é Jeová!”', icon: BookOpen },
            { id: 't8', time: '3:55', title: 'Cântico 161 e oração final', icon: Music }
          ]
        }
      ]
    }
  },
  '2025-2026': {
    supt: {
      title: 'Programa da Assembleia de Circuito de 2026 — com o Superintendente de Circuito',
      year: '2025-2026',
      theme: '“Comportem-se de uma maneira digna das boas novas” — Filipenses 1:27',
      color: '#0891B2', // Cyan
      headerImage: 'https://cms-imgp.jw-cdn.org/img/p/1102026245/univ/art/1102026245_univ_lsr_xl.jpg',
      sessions: [
        {
          period: 'Manhã',
          items: [
            { id: 'm0', title: 'PRESIDENTE DE SESSÃO', icon: User, isRole: true },
            { id: 'm1', time: '9:40', title: 'Música', icon: Music, noSpeaker: true },
            { id: 'm2', time: '9:50', title: 'Cântico e oração', icon: Music },
            { id: 'm3', time: '10:00', title: 'Por que devemos nos comportar de uma maneira digna das boas novas?', icon: BookOpen },
            { 
              id: 'm4', 
              time: '10:15', 
              label: 'SÉRIE DE DISCURSOS:', 
              title: 'Comportem-se de uma maneira digna das boas novas...', 
              icon: BookOpen,
              noSpeaker: true,
              isSeries: true,
              subitems: [
                { id: 'm4_1', title: 'No casamento' },
                { id: 'm4_2', title: 'Na família' },
                { id: 'm4_3', title: 'No trabalho' }
              ]
            },
            { id: 'm5', time: '11:05', title: 'Cântico e anúncios', icon: Info, noSpeaker: true },
            { id: 'm6', time: '11:15', title: 'Como ser dignos de representar as boas novas', icon: BookOpen },
            { id: 'm7', time: '11:35', title: '“Seu Pai, que observa em secreto, o recompensará”', icon: BookOpen },
            { id: 'm8', time: '12:05', title: 'Cântico e intervalo', icon: Clock, noSpeaker: true }
          ]
        },
        {
          period: 'Tarde',
          items: [
            { id: 't0', title: 'PRESIDENTE DE SESSÃO', icon: User, isRole: true },
            { id: 't1', time: '1:20', title: 'Música', icon: Music, noSpeaker: true },
            { id: 't2', time: '1:30', title: 'Cântico e oração', icon: Music },
            { id: 't3', time: '1:35', label: 'DISCURSO PARA O PÚBLICO:', title: 'As boas novas: Por que acreditar nelas?', icon: BookOpen },
            { id: 't4', time: '2:05', title: 'Resumo de A Sentinela', icon: BookOpen },
            { id: 't5', time: '2:35', title: 'Cântico e anúncios', icon: Info, noSpeaker: true },
            { 
              id: 't6', 
              time: '2:45', 
              label: 'SÉRIE DE DISCURSOS:', 
              title: 'Fique atento às boas novas', 
              icon: BookOpen,
              noSpeaker: true,
              isSeries: true,
              subitems: [
                { id: 't6_1', title: 'No seu estudo pessoal' },
                { id: 't6_2', title: 'Nas reuniões congregacionais' },
                { id: 't6_3', title: 'No ministério de campo' }
              ]
            },
            { id: 't7', time: '3:30', title: 'Continue a se comportar de uma maneira digna das boas novas', icon: BookOpen },
            { id: 't8', time: '4:00', title: 'Cântico e oração final', icon: Music }
          ]
        }
      ]
    },
    branch: {
      title: 'Programa da Assembleia de Circuito de 2026 — com o Representante de Betel',
      year: '2025-2026',
      theme: '“Mantenha uma boa consciência” — 1 Pedro 3:16',
      color: '#7C3AED', // Violet
      headerImage: 'https://cms-imgp.jw-cdn.org/img/p/1102026241/univ/art/1102026241_univ_lsr_xl.jpg',
      sessions: [
        {
          period: 'Manhã',
          items: [
            { id: 'm0', title: 'PRESIDENTE DE SESSÃO', icon: User, isRole: true },
            { id: 'm1', time: '9:40', title: 'Música', icon: Music, noSpeaker: true },
            { id: 'm2', time: '9:50', title: 'Cântico e oração', icon: Music },
            { id: 'm3', time: '10:00', title: 'Por que é importante manter uma boa consciência?', icon: BookOpen },
            { id: 'm4', time: '10:15', title: 'Como treinar sua consciência', icon: BookOpen },
            { id: 'm5', time: '10:30', title: 'A consciência e as suas decisões', icon: BookOpen },
            { id: 'm6', time: '10:55', title: 'Cântico e anúncios', icon: Info, noSpeaker: true },
            { id: 'm7', time: '11:05', title: 'Não fira a consciência de outros', icon: BookOpen },
            { id: 'm8', time: '11:35', title: '“Seu Pai, que observa em secreto, o recompensará”', icon: BookOpen },
            { id: 'm9', time: '12:05', title: 'Cântico e intervalo', icon: Clock, noSpeaker: true }
          ]
        },
        {
          period: 'Tarde',
          items: [
            { id: 't0', title: 'PRESIDENTE DE SESSÃO', icon: User, isRole: true },
            { id: 't1', time: '1:20', title: 'Música', icon: Music, noSpeaker: true },
            { id: 't2', time: '1:30', title: 'Cântico', icon: Music, noSpeaker: true },
            { id: 't3', time: '1:35', title: 'Experiências', icon: Info },
            { id: 't4', time: '1:45', title: 'Resumo de A Sentinela', icon: BookOpen },
            { 
              id: 't5', 
              time: '2:15', 
              label: 'SÉRIE DE DISCURSOS:', 
              title: 'Mantenha uma consciência limpa diante de...', 
              icon: BookOpen,
              noSpeaker: true,
              subitems: [
                { id: 't5_1', title: 'Jeová' },
                { id: 't5_2', title: 'Sua família' },
                { id: 't5_3', title: 'O mundo' }
              ]
            },
            { id: 't6', time: '3:00', title: 'Cântico e anúncios', icon: Info, noSpeaker: true },
            { id: 't7', time: '3:10', title: 'Proteja o presente maravilhoso que Jeová lhe deu', icon: BookOpen },
            { id: 't8', time: '3:55', title: 'Cântico e oração final', icon: Music }
          ]
        }
      ]
    }
  }
};

export default function CircuitAssemblyView({ userId, isGuest = false, onBack, type }: CircuitAssemblyViewProps) {
  const [availableYears, setAvailableYears] = useState<string[]>(['2025-2026', '2026-2027']);
  const [selectedYear, setSelectedYear] = useState<string>('2026-2027');
  const [selectedPart, setSelectedPart] = useState<number>(0);
  const [dynamicProgram, setDynamicProgram] = useState<any>(null);
  
  const staticProgram = (programsByYear as any)[selectedYear]?.[type] || (programsByYear as any)['2026-2027'][type];
  const assemblyProgram = dynamicProgram 
    ? { ...staticProgram, ...dynamicProgram } 
    : staticProgram;

  const { showAlert } = useDialog();

  const [reassigningOrphan, setReassigningOrphan] = useState<{id: string, data: any} | null>(null);
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [isSavingReassignment, setIsSavingReassignment] = useState(false);
  const [replaceConfirm, setReplaceConfirm] = useState<{ targetId: string, orphanId: string } | null>(null);

  const [partsData, setPartsData] = useState<Record<number, PartData>>({
    0: { speakers: {}, confirmations: {}, details: { eventDate: '', eventLocation: '', rehearsalDate: '', rehearsalLocation: '', assemblyTheme: assemblyProgram.theme } },
    1: { speakers: {}, confirmations: {}, details: { eventDate: '', eventLocation: '', rehearsalDate: '', rehearsalLocation: '', assemblyTheme: assemblyProgram.theme } },
    2: { speakers: {}, confirmations: {}, details: { eventDate: '', eventLocation: '', rehearsalDate: '', rehearsalLocation: '', assemblyTheme: assemblyProgram.theme } },
    3: { speakers: {}, confirmations: {}, details: { eventDate: '', eventLocation: '', rehearsalDate: '', rehearsalLocation: '', assemblyTheme: assemblyProgram.theme } },
  });

  /**
   * Migra dados legados (por índice ou hash antigo) para os novos IDs estáveis
   */
  const migrateLegacyData = (data: any, currentProgram: any) => {
    if (!currentProgram || !currentProgram.sessions) return data;

    const newPartsData = { ...data };
    
    Object.keys(newPartsData).forEach((partIndex: any) => {
      const part = newPartsData[partIndex];
      // Se já possui orphanedParts e os IDs parecem modernos, evitamos re-migrar o que já foi migrado
      const hasModernIds = Object.keys(part.speakers || {}).some(id => id.startsWith('item_') || id.startsWith('legacy_'));
      const hasLegacyIndices = Object.keys(part.speakers || {}).some(id => !isNaN(Number(id)) || id.length <= 4);

      if (hasModernIds && !hasLegacyIndices) return;

      const migratedSpeakers: Record<string, string> = {};
      const migratedCongregations: Record<string, string> = {};
      const migratedNotes: Record<string, string> = {};
      const migratedConfirmations: Record<string, boolean> = {};
      const migratedUserTimes: Record<string, string> = { ...(part.userTimes || {}) };
      const orphanedParts: any = { ...part.orphanedParts };

      // Mapear todos os itens atuais por título e tempo para reconhecimento de migração
      const currentItemsMap: Record<string, string> = {};
      currentProgram.sessions.forEach((s: any) => {
        s.items.forEach((item: any) => {
          const key = `${item.title.toLowerCase()}_${item.time}`;
          currentItemsMap[key] = item.id;
          if (item.subitems) {
            item.subitems.forEach((si: any) => {
              const subKey = `${si.title.toLowerCase()}_${si.time || item.time || ''}`;
              currentItemsMap[subKey] = si.id;
            });
          }
        });
      });

      // Se existir o formato antigo de speakers por ID ou índice
      if (part.speakers) {
        Object.keys(part.speakers).forEach(oldId => {
          const speaker = part.speakers[oldId];
          const confirmation = part.confirmations?.[oldId] || false;
          const congregation = part.congregations?.[oldId] || '';
          const notes = part.notes?.[oldId] || '';
          const userTime = part.userTimes?.[oldId] || '';

          // 1. Tentar encontrar o ID diretamente na nova programação
          let foundId = '';
          currentProgram.sessions.forEach((s: any) => {
            s.items.forEach((item: any) => {
              if (item.id === oldId) foundId = oldId;
              const sub = item.subitems?.find((si: any) => si.id === oldId);
              if (sub) foundId = oldId;
            });
          });

          // 2. Se for índice numérico (legado), mapear para o ID estático correspondente
          if (!foundId && !isNaN(Number(oldId)) && Number(oldId) < 100) {
            // Mapeamento heurístico para o programa estático
            const allStaticItems: any[] = [];
            staticProgram.sessions.forEach((s: any) => {
              s.items.forEach((i: any) => {
                allStaticItems.push(i);
                if (i.subitems) i.subitems.forEach((si: any) => allStaticItems.push(si));
              });
            });
            const staticItem = allStaticItems.find(i => i.id === oldId || i.id === `m${oldId}` || i.id === `t${oldId}`);
            if (staticItem) {
              const key = `${staticItem.title.toLowerCase()}_${staticItem.time || ''}`;
              foundId = currentItemsMap[key] || '';
            }
          }

          if (foundId) {
            migratedSpeakers[foundId] = speaker;
            migratedConfirmations[foundId] = confirmation;
            migratedCongregations[foundId] = congregation;
            migratedNotes[foundId] = notes;
            if (userTime) migratedUserTimes[foundId] = userTime;
          } else if (speaker) {
            // Guardar como órfão apenas se houver um orador designado
            orphanedParts[oldId] = {
              speaker,
              congregation,
              notes,
              confirmation,
              userTime,
              originalTitle: 'Item de Migração',
              originalTime: userTime || '',
              reason: 'Vínculo perdido durante atualização de programação'
            };
          }
        });
      }

      newPartsData[partIndex] = {
        ...part,
        speakers: migratedSpeakers,
        confirmations: migratedConfirmations,
        congregations: migratedCongregations,
        notes: migratedNotes,
        userTimes: migratedUserTimes,
        orphanedParts
      };
    });

    return newPartsData;
  };

  const [initialPartsData, setInitialPartsData] = useState<string>('');
  const [personalData, setPersonalData] = useState<any>(null);
  const [templates, setTemplates] = useState<Record<string, { content: string, updatedAt: string }>>({});
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isCheckingNext, setIsCheckingNext] = useState(false);
  const [nextSeasonPreview, setNextSeasonPreview] = useState<{ year: string; theme: string; headerImage?: string; itemCount: number; fullData: any } | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showEditDetailsModal, setShowEditDetailsModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  // Digital A4 Landscape Zoom & Viewport controls
  const [zoom, setZoom] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('circuit_assembly_a4_zoom');
      if (saved) return parseInt(saved, 10);
    }
    return 100;
  });
  const [sheetHeight, setSheetHeight] = useState<number>(794);
  const containerRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  // Measure real rendered sheet height for accurate zoom container height and smooth scrolling
  useEffect(() => {
    if (!sheetRef.current) return;
    const updateHeight = () => {
      if (sheetRef.current) {
        setSheetHeight(sheetRef.current.offsetHeight);
      }
    };
    updateHeight();
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(updateHeight);
      observer.observe(sheetRef.current);
      return () => observer.disconnect();
    }
  }, [partsData, selectedPart, selectedYear, isLoading]);

  const handleFitToScreen = () => {
    if (!containerRef.current) return;
    const containerWidth = containerRef.current.clientWidth - 32;
    // Virtual A4 landscape width is 1122.5px (297mm)
    const a4LandscapeWidthPx = 1122.5;
    const fitScale = Math.max(35, Math.min(150, Math.floor((containerWidth / a4LandscapeWidthPx) * 100)));
    setZoom(fitScale);
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('circuit_assembly_a4_zoom', zoom.toString());
    }
  }, [zoom]);

  // Initial zoom calculation on mount:
  // On smartphones (<1024px), prioritize readability (~80%) with horizontal scroll
  // On larger viewports, calculate fit scale up to 100%
  useEffect(() => {
    if (!containerRef.current) return;
    if (sessionStorage.getItem('circuit_assembly_a4_zoom')) return;

    const isMobileOrTablet = typeof window !== 'undefined' && window.innerWidth < 1024;
    if (isMobileOrTablet) {
      setZoom(80);
    } else {
      const containerWidth = containerRef.current.clientWidth - 48;
      const a4LandscapeWidthPx = 1122.5;
      const calculatedScale = Math.floor((containerWidth / a4LandscapeWidthPx) * 100);
      const fitScale = Math.max(80, Math.min(100, calculatedScale));
      setZoom(fitScale);
    }
  }, [isLoading]);

  // Pinch-to-zoom touch gesture listener
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let initialDistance = 0;
    let initialZoomLevel = zoom;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        initialDistance = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
        initialZoomLevel = zoom;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && initialDistance > 0) {
        e.preventDefault();
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const currentDistance = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
        const scaleFactor = currentDistance / initialDistance;
        const newZoom = Math.min(200, Math.max(35, Math.round(initialZoomLevel * scaleFactor)));
        setZoom(newZoom);
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

  // Active part data
  const currentPart = partsData[selectedPart];
  const speakers = currentPart.speakers;
  const congregations = currentPart.congregations || {};
  const confirmedSpeakers = currentPart.confirmations;
  const details = currentPart.details;

  const collectionName = type === 'supt' ? 'circuit_assembly_supt_speakers' : 'circuit_assembly_branch_speakers';

  const hasChanges = initialPartsData !== JSON.stringify(partsData);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const response = await fetch('/api/assembly/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          year: selectedYear, 
          type,
          mode: 'update'
        })
      });

      const result = await response.json();
      if (result.success) {
        const currentResult = result.results[0];

        if (currentResult) {
          if (currentResult.status === 'UPDATE_AVAILABLE') {
            setDynamicProgram(currentResult.data);
            setPartsData(prev => migrateLegacyData(prev, currentResult.data));
            await showAlert(`✓ Programação ${selectedYear} atualizada com sucesso.`, 'Sincronização');
          } else if (currentResult.status === 'CURRENT_UP_TO_DATE') {
            await showAlert(`✓ Programação ${selectedYear} já está em dia com o jw.org.`, 'Sincronização');
          } else if (currentResult.status === 'SYNC_ERROR') {
            await showAlert(`⚠ Erro ao sincronizar ${selectedYear}: ${currentResult.error}`, 'Erro de Sincronização');
          }
        }
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      console.error('Erro ao sincronizar:', error);
      await showAlert(`Erro ao sincronizar com JW.org: ${error.message}`, 'Erro');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCheckNextSeason = async () => {
    setIsCheckingNext(true);
    try {
      // Identificar a temporada mais recente para calcular a próxima
      const maxYear = availableYears.reduce((max, y) => y > max ? y : max, availableYears[0]);
      
      const response = await fetch('/api/assembly/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          year: maxYear, 
          type,
          mode: 'check-next'
        })
      });

      const result = await response.json();
      if (result.success) {
        if (result.status === 'AVAILABLE') {
          setNextSeasonPreview({
            year: result.year,
            theme: result.data.theme,
            headerImage: result.data.headerImage,
            itemCount: result.data.itemCount,
            fullData: result.data.fullData
          });
        } else if (result.status === 'NOT_PUBLISHED') {
          await showAlert(`A temporada ${result.year} ainda não foi localizada no JW.org.`, 'Próxima Temporada');
        } else if (result.status === 'INCOMPLETE') {
          await showAlert(`A temporada ${result.year} foi localizada, mas a programação ainda não está disponível ou está incompleta.`, 'Próxima Temporada');
        }
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      console.error('Erro ao verificar próxima temporada:', error);
      await showAlert(`Erro ao verificar JW.org: ${error.message}`, 'Erro');
    } finally {
      setIsCheckingNext(false);
    }
  };

  const handleConfirmNewSeason = async () => {
    if (!nextSeasonPreview) return;
    
    try {
      // Gravar no Firestore
      const docId = `${nextSeasonPreview.year}_${type}`;
      const docRef = doc(db, 'assembly_programs', docId);
      
      // O fullData já passou pelo performSync na API e gerou IDs estáveis
      await setDoc(docRef, nextSeasonPreview.fullData, { merge: true });
      
      setAvailableYears(prev => Array.from(new Set([...prev, nextSeasonPreview.year])).sort((a, b) => b.localeCompare(a)));
      setSelectedYear(nextSeasonPreview.year);
      setDynamicProgram(nextSeasonPreview.fullData);
      setNextSeasonPreview(null);
      
      await showAlert(`A temporada ${nextSeasonPreview.year} foi adicionada com sucesso!`, 'Nova Temporada');
    } catch (error: any) {
      console.error('Erro ao salvar nova temporada:', error);
      await showAlert(`Erro ao salvar: ${error.message}`, 'Erro');
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        // Load list of available seasons from Firestore
        const programsSnapshot = await getDocs(collection(db, 'assembly_programs'));
        const years = new Set(['2025-2026', '2026-2027']);
        programsSnapshot.forEach(doc => {
          const [y, t] = doc.id.split('_');
          if (t === type) years.add(y);
        });
        setAvailableYears(Array.from(years).sort((a, b) => b.localeCompare(a)));

        // Load dynamic program from Firestore
        const programRef = doc(db, 'assembly_programs', `${selectedYear}_${type}`);
        const programSnap = await getDoc(programRef);
        if (programSnap.exists()) {
          setDynamicProgram(programSnap.data());
        } else {
          setDynamicProgram(null); // Fallback to static
        }

        // More robust personal data fetching
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

        const templatesSnapshot = await getDocs(collection(db, 'document_templates'));
        const fetchedTemplates: Record<string, any> = {};
        templatesSnapshot.forEach((doc) => {
          fetchedTemplates[doc.id] = doc.data();
        });
        setTemplates(fetchedTemplates);

        // Try to load year-specific data
        const docId = selectedYear === '2026-2027' ? userId : `${userId}_${selectedYear}`;
        let docRef = doc(db, collectionName, docId);
        let docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.parts) {
            const migrated = migrateLegacyData(data.parts, assemblyProgram);
            setPartsData(migrated);
            setInitialPartsData(JSON.stringify(migrated));
          } else {
            // Migration from old format
            const migratedData = {
              0: { 
                speakers: data.speakers || {}, 
                confirmations: data.confirmations || {}, 
                details: {
                  eventDate: data.details?.eventDate || '',
                  eventLocation: data.details?.eventLocation || '',
                  rehearsalDate: data.details?.rehearsalDate || '',
                  rehearsalLocation: data.details?.rehearsalLocation || '',
                  assemblyTheme: data.details?.assemblyTheme || assemblyProgram.theme,
                }
              },
              1: { speakers: {}, confirmations: {}, details: { eventDate: '', eventLocation: '', rehearsalDate: '', rehearsalLocation: '', assemblyTheme: assemblyProgram.theme } },
              2: { speakers: {}, confirmations: {}, details: { eventDate: '', eventLocation: '', rehearsalDate: '', rehearsalLocation: '', assemblyTheme: assemblyProgram.theme } },
              3: { speakers: {}, confirmations: {}, details: { eventDate: '', eventLocation: '', rehearsalDate: '', rehearsalLocation: '', assemblyTheme: assemblyProgram.theme } },
            };
            setPartsData(migratedData);
            setInitialPartsData(JSON.stringify(migratedData));
          }
        } else {
          // Reset data for new year or missing doc
          const defaultData = {
            0: { speakers: {}, confirmations: {}, details: { eventDate: '', eventLocation: '', rehearsalDate: '', rehearsalLocation: '', assemblyTheme: assemblyProgram.theme } },
            1: { speakers: {}, confirmations: {}, details: { eventDate: '', eventLocation: '', rehearsalDate: '', rehearsalLocation: '', assemblyTheme: assemblyProgram.theme } },
            2: { speakers: {}, confirmations: {}, details: { eventDate: '', eventLocation: '', rehearsalDate: '', rehearsalLocation: '', assemblyTheme: assemblyProgram.theme } },
            3: { speakers: {}, confirmations: {}, details: { eventDate: '', eventLocation: '', rehearsalDate: '', rehearsalLocation: '', assemblyTheme: assemblyProgram.theme } },
          };
          setPartsData(defaultData);
          setInitialPartsData(JSON.stringify(defaultData));
        }
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [userId, collectionName, selectedYear, assemblyProgram.theme]);

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
        await showAlert('Alterações salvas com sucesso!', 'Sucesso');
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

  const handleConfirmReassign = async (targetId: string, force = false) => {
    if (!reassigningOrphan) return;

    const currentSpeaker = partsData[selectedPart].speakers?.[targetId];
    const currentCong = partsData[selectedPart].congregations?.[targetId];
    const currentNotes = partsData[selectedPart].notes?.[targetId];

    if (!force && (currentSpeaker || currentCong || currentNotes)) {
      setReplaceConfirm({ targetId, orphanId: reassigningOrphan.id });
      return;
    }

    setIsSavingReassignment(true);
    try {
      const newPartsData = { ...partsData };
      const currentPartData = { ...newPartsData[selectedPart] };
      
      // Garantir que os objetos existam
      const speakers = { ...(currentPartData.speakers || {}) };
      const congregations = { ...(currentPartData.congregations || {}) };
      const notes = { ...(currentPartData.notes || {}) };
      const confirmations = { ...(currentPartData.confirmations || {}) };
      const userTimes = { ...(currentPartData.userTimes || {}) };

      // Copiar dados do órfão
      speakers[targetId] = reassigningOrphan.data.speaker || '';
      if (reassigningOrphan.data.congregation) {
        congregations[targetId] = reassigningOrphan.data.congregation;
      }
      if (reassigningOrphan.data.notes) {
        notes[targetId] = reassigningOrphan.data.notes;
      }
      if (reassigningOrphan.data.userTime) {
        userTimes[targetId] = reassigningOrphan.data.userTime;
      }
      confirmations[targetId] = reassigningOrphan.data.confirmation || false;

      // Remover do orphanedParts
      const newOrphans = { ...(currentPartData.orphanedParts || {}) };
      delete newOrphans[reassigningOrphan.id];

      newPartsData[selectedPart] = {
        ...currentPartData,
        speakers,
        congregations,
        notes,
        confirmations,
        userTimes,
        orphanedParts: newOrphans
      };

      // Atualizar estado local para acionar a barra de salvar (hasChanges = true)
      setPartsData(newPartsData);
      
      setShowReassignModal(false);
      setReassigningOrphan(null);
      setReplaceConfirm(null);
      
      await showAlert('Designação reatribuída à programação com sucesso! Lembre-se de salvar as alterações.', 'Sucesso');
    } catch (error) {
      console.error('Error reassigning orphan:', error);
      await showAlert('Não foi possível concluir a reatribuição. Tente novamente.', 'Erro');
    } finally {
      setIsSavingReassignment(false);
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

  const handleYearChange = (year: string) => {
    if (hasChanges) {
      setPendingAction(() => () => setSelectedYear(year));
      setShowConfirmModal(true);
    } else {
      setSelectedYear(year);
    }
  };

  const handleSpeakerChange = (id: string, value: string) => {
    setPartsData(prev => ({
      ...prev,
      [selectedPart]: {
        ...prev[selectedPart],
        speakers: { ...prev[selectedPart].speakers, [id]: value }
      }
    }));
  };

  const handleCongregationChange = (id: string, value: string) => {
    setPartsData(prev => ({
      ...prev,
      [selectedPart]: {
        ...prev[selectedPart],
        congregations: { ...prev[selectedPart].congregations, [id]: value }
      }
    }));
  };

  const handleNotesChange = (id: string, value: string) => {
    setPartsData(prev => ({
      ...prev,
      [selectedPart]: {
        ...prev[selectedPart],
        notes: { ...prev[selectedPart].notes, [id]: value }
      }
    }));
  };

  const handleUserTimeChange = (id: string, value: string) => {
    setPartsData(prev => ({
      ...prev,
      [selectedPart]: {
        ...prev[selectedPart],
        userTimes: { ...(prev[selectedPart].userTimes || {}), [id]: value }
      }
    }));
  };

  const handleConfirmationToggle = (id: string) => {
    setPartsData(prev => ({
      ...prev,
      [selectedPart]: {
        ...prev[selectedPart],
        confirmations: { ...prev[selectedPart].confirmations, [id]: !prev[selectedPart].confirmations[id] }
      }
    }));
  };

  const generateDocument = async (item: any, type: 'docx' | 'pdf') => {
    const speakerName = speakers[item.id];
    if (!speakerName) {
      await showAlert('Por favor, informe o nome do orador primeiro.', 'Aviso');
      return;
    }

    const speakerCongregation = currentPart.congregations?.[item.id]?.trim();
    const speakerDisplayName = speakerCongregation ? `${speakerName} - ${speakerCongregation}` : speakerName;

    const isSpeech = (it: any) => {
      if (it.noSpeaker || it.isRole) return false;
      const t = it.title.toLowerCase();
      // A prayer is identified by "Cântico" AND "oração"
      const isPr = t.includes('cântico') && t.includes('oração');
      if (isPr) return false;
      
      if (t.includes('música') || t.includes('anúncios') || t.includes('intervalo') || t.includes('cântico')) return false;
      return true;
    };

    let n = 0;
    let found = false;
    let parentItem: any = null;
    for (const session of assemblyProgram.sessions) {
      for (const pItem of session.items) {
        if (pItem.subitems) {
          const subTarget = pItem.subitems.find(si => si.id === item.id);
          if (subTarget) parentItem = pItem;
          
          for (const sub of pItem.subitems) {
            if (isSpeech(sub)) n++;
            if (sub.id === item.id) { found = true; break; }
          }
        } else {
          if (isSpeech(pItem)) n++;
          if (pItem.id === item.id) { found = true; break; }
        }
        if (found) break;
      }
      if (found) break;
    }

    let templateId = '';
    let designation = '';

    const isPrayer = item.title.toLowerCase().includes('cântico') && item.title.toLowerCase().includes('oração');
    const isPresident = item.isRole && item.title.toLowerCase().includes('presidente');

    if (isPrayer) {
      templateId = 'ass_convite_oracao';
      // Identify which prayer it is based on all items in the program
      const allItems: any[] = [];
      assemblyProgram.sessions.forEach(s => {
        s.items.forEach(i => {
          allItems.push(i);
          if (i.subitems) i.subitems.forEach(si => allItems.push(si));
        });
      });
      const prayerItems = allItems.filter(i => i.title.toLowerCase().includes('cântico') && i.title.toLowerCase().includes('oração'));
      const prayerIndex = prayerItems.findIndex(i => i.id === item.id);
      
      if (prayerIndex === 0) designation = 'ORAÇÃO INICIAL';
      else if (prayerIndex === 1) designation = 'ORAÇÃO DA TARDE';
      else if (prayerIndex === 2) designation = 'ORAÇÃO FINAL';
      else designation = 'ORAÇÃO';
    } else if (isPresident) {
      templateId = 'ass_convite_presidente';
      const allItems: any[] = [];
      assemblyProgram.sessions.forEach(s => {
        s.items.forEach(i => {
          allItems.push(i);
          if (i.subitems) i.subitems.forEach(si => allItems.push(si));
        });
      });
      const presidentItems = allItems.filter(i => i.isRole && i.title.toLowerCase().includes('presidente'));
      const presidentIndex = presidentItems.findIndex(i => i.id === item.id);
      
      if (presidentIndex === 0) designation = 'PRESIDENTE DE SESSÃO MANHÃ';
      else if (presidentIndex === 1) designation = 'PRESIDENTE DE SESSÃO TARDE';
      else designation = 'PRESIDENTE DE SESSÃO';
    } else {
      templateId = 'ass_carta_oradores';
      designation = item.title;
    }

    const template = templates[templateId] || templates[`${userId}_${templateId}`];
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

      const xmlFiles = zip.file(/word\/(document|header\d+|footer\d+)\.xml/);
      xmlFiles.forEach(xmlResource => {
        let xmlContent = xmlResource.asText();
        xmlContent = xmlContent.replace(/<w:proofErr w:type="(?:spell|gram)(?:Start|End)"\/>/g, "");
        xmlContent = xmlContent.replace(/<w:noProof\/>/g, "");
        
        for (let i = 0; i < 6; i++) {
          xmlContent = xmlContent.replace(/(@[A-Za-z0-9À-ÿ\u00C0-\u00FF\_\s]*)(<\/w:t>(?:<(?!w:p|w:tr|w:tbl|w:br|w:tc|w:tr)[^>]+>)*?<w:t[^>]*>)([A-Za-z0-9À-ÿ\u00C0-\u00FF\_\s]+)/g, "$1$3$2");
        }
        
        xmlContent = xmlContent.replace(/(@[A-Za-z0-9À-ÿ\_]*)(<\/w:t><\/w:r><w:r><w:t>)/g, "$1");

        xmlContent = xmlContent.replace(/(<w:t[^>]*>)(.*?)(<\/w:t>)/g, (match, opening, text, closing) => {
          let newText = text;
          // Handle @Assinatura specially as an image tag
          newText = newText.replace(/@Assinatura([A-Za-z0-9À-ÿ\_]*\s*Global|_Global)?/gi, '[%ASSINATURA]');
          newText = newText.replace(/@Signature([A-Za-z0-9À-ÿ\_]*\s*Global|_Global)?/gi, '[%ASSINATURA]');
          newText = newText.replace(/@AssinaturaGlobal/gi, '[%ASSINATURA]');
          newText = newText.replace(/@Assinatura_Global/gi, '[%ASSINATURA]');
          
          // Generic @TAG replacement
          newText = newText.replace(/(^|[^A-Za-z0-9À-ÿ\u00C0-\u00FF])@([A-Za-z0-9À-ÿ\_]+)/g, (m, p1, p2) => {
            const tag = p2.toUpperCase();
            if (tag.includes('ASSINATURA') || tag.includes('SIGNATURE')) return `${p1}[%ASSINATURA]`;
            return `${p1}[${tag}]`;
          });
          return `${opening}${newText}${closing}`;
        });
        zip.file(xmlResource.name, xmlContent);
      });

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

      const imgOpts: any = {
        centered: false,
        getImage: (tagValue: string) => {
          if (!tagValue || typeof tagValue !== 'string' || !tagValue.startsWith('data:image')) return null;
          try {
            const base64Data = tagValue.split(',')[1];
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
      
      const themeValue = details.assemblyTheme || assemblyProgram.theme;
      const itemLabel = (item as any).label || '';
      const parentLabel = parentItem?.label || '';
      const parentTitle = parentItem?.title || '';

      const isSerie = parentLabel.toUpperCase().includes('SÉRIE DE DISCURSOS') || itemLabel.toUpperCase().includes('SÉRIE DE DISCURSOS');
      const isPub = itemLabel.toUpperCase().includes('DISCURSO PARA O PÚBLICO') || item.title.toUpperCase().includes('DISCURSO PARA O PÚBLICO');

      let tituloValue = (isPrayer || isPresident) ? designation : item.title;
      
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
      } else if (isPub) {
        const cleanTitle = item.title.replace(/^DISCURSO PARA O PÚBLICO:\s*/i, '');
        tituloValue = `DISCURSO PARA O PÚBLICO:\n${cleanTitle}`;
      }

      const replacements = {
        'EVENTO': assemblyProgram.title,
        'TEMA': themeValue,
        'DATA': details.eventDate || '________________',
        'LOCAL': details.eventLocation || '________________',
        'DATA_EVENTO': details.eventDate || '________________',
        'LOCAL_EVENTO': details.eventLocation || '________________',
        'ORADOR': speakerDisplayName,
        'orador': speakerDisplayName,
        'NOME_ORADOR': speakerDisplayName,
        'DESIGNADO': speakerDisplayName,
        'NOME_DESIGNADO': speakerDisplayName,
        'D_ENSAIO': details.rehearsalDate || '________________',
        'L_ENSAIO': details.rehearsalLocation || '________________',
        'DATA_ENSAIO': details.rehearsalDate || '________________',
        'LOCAL_ENSAIO': details.rehearsalLocation || '________________',
        'DATAHORA': details.rehearsalDate || '________________',
        'LOCALTREINO': details.rehearsalLocation || '________________',
        'HORA': item.time || '',
        'N': n.toString(),
        'TITULO': tituloValue,
        // Mantendo compatibilidade
        'ANO': '2026',
        'DESIGNAÇÃO': designation,
        'DESIGNACAO': designation,
        'DIA': 'Assembleia',
        'ASSINATURA': signatureImage,
        '%ASSINATURA': signatureImage,
        'VIAJANTE': personalData?.nome || '________________',
        'NOME': personalData?.nome || '________________',
        'CIRCUITO': personalData?.circuito || '________________',
        'CONGREGACAO': currentPart.congregations?.[item.id] || '________________',
        'NOTAS': currentPart.notes?.[item.id] || '________________',
        'FONE': personalData?.telefoneCircuito || personalData?.telefone || '________________',
        'TELEFONE': personalData?.telefoneCircuito || personalData?.telefone || '________________',
      };

      const docObj = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
        delimiters: { start: '[', end: ']' },
        modules: ImageModule ? [new ImageModule(imgOpts)] : []
      });

      docObj.render(replacements);

      const out = docObj.getZip().generate({
        type: 'blob',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });

      const url = URL.createObjectURL(out);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Carta_${speakerName.replace(/\s+/g, '_')}.docx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Error generating document:', err);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <Loader2 size={40} className="text-[#512da8] animate-spin" />
        <p className="text-gray-500 font-medium">Carregando programação...</p>
      </div>
    );
  }

  return (
    <div id="circuit-assembly-print-content" className="space-y-6 pb-16 print:p-0">
      <style jsx global>{`
        @media screen {
          .print-only {
            display: none !important;
          }
        }

        @media print {
          @page { 
            size: A4 landscape; 
            margin: 8mm 10mm; 
          }
          
          body * { 
            visibility: hidden; 
          }
          
          #circuit-assembly-a4-sheet, 
          #circuit-assembly-a4-sheet * { 
            visibility: visible !important; 
          }
          
          #circuit-assembly-a4-sheet { 
            position: absolute !important; 
            top: 0 !important; 
            left: 0 !important; 
            width: 100% !important; 
            min-width: 100% !important;
            max-width: 100% !important;
            display: block !important;
            background: #ffffff !important;
            color: #111827 !important;
            padding: 0 !important;
            margin: 0 !important;
            border: none !important;
            box-shadow: none !important;
            transform: none !important;
          }
          
          .no-print { 
            display: none !important; 
          }
          
          body {
            background: #ffffff !important;
            color: #111827 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
          }

          input {
            border: none !important;
            background: transparent !important;
            padding: 0 !important;
            color: #111827 !important;
          }
          input::placeholder {
            color: transparent !important;
          }
        }
      `}</style>

      {/* Screen Header & Top Controls (no-print) */}
      <div className="space-y-3 no-print">
        {/* Top bar: Back, Title & Action Bar */}
        <div className="flex items-center justify-between gap-2 sm:gap-4 flex-wrap">
          {/* Back button & Title hierarchy */}
          <div className="flex items-center gap-2.5 min-w-0">
            <button 
              onClick={handleBackClick} 
              className="h-9 w-9 sm:h-10 sm:w-10 p-1.5 sm:p-2 hover:bg-gray-100 active:scale-95 rounded-xl transition-all text-[#512da8] bg-white shadow-xs border border-gray-200 flex items-center justify-center shrink-0 cursor-pointer"
              title="Voltar"
              aria-label="Voltar para eventos"
            >
              <ChevronLeft size={20} strokeWidth={2.5} />
            </button>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h1 className="text-base sm:text-xl font-black text-gray-900 tracking-tight leading-none truncate">
                  <span className="hidden xs:inline">PROGRAMAÇÃO DA ASSEMBLEIA</span>
                  <span className="xs:hidden">PROGRAMAÇÃO</span>
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider bg-violet-100 text-[#512da8] border border-violet-200">
                  {type === 'supt' ? 'CAco' : 'CAbr'}
                </span>
              </div>
              <p className="text-[11px] sm:text-xs font-medium text-gray-500 truncate hidden sm:block">
                {type === 'supt' ? 'Com o Superintendente de Circuito' : 'Com o Representante de Betel'} • Documento A4 Digital
              </p>
            </div>
          </div>

          {/* Action Bar (Barra de Ações) */}
          <div className="flex items-center gap-1.5 sm:gap-2 ml-auto">
            <button 
              onClick={() => setShowEditDetailsModal(true)}
              className="h-9 sm:h-10 px-2.5 sm:px-3 rounded-xl text-xs font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 shadow-xs flex items-center justify-center gap-1.5 transition-all active:scale-[0.98]"
              title="Editar dados da assembleia (data, local, ensaio)"
            >
              <CalendarDays size={15} className="shrink-0 text-amber-600" />
              <span className="hidden md:inline">Dados do Evento</span>
            </button>

            <button 
              onClick={handleSync} 
              disabled={isSyncing}
              className="h-9 sm:h-10 px-2.5 sm:px-3 rounded-xl text-xs font-bold text-violet-700 bg-violet-50 hover:bg-violet-100 border border-violet-200 shadow-xs flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              title="Atualizar programação da temporada selecionada"
            >
              <RefreshCw size={15} className={`shrink-0 ${isSyncing ? 'animate-spin' : ''}`} />
              <span className="hidden md:inline">{isSyncing ? 'Atualizando...' : 'Atualizar'}</span>
            </button>
            
            <button 
              onClick={handleCheckNextSeason} 
              disabled={isCheckingNext}
              className="h-9 sm:h-10 px-2.5 sm:px-3 rounded-xl text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 shadow-xs flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              title="Verificar se uma nova temporada foi publicada no JW.org"
            >
              {isCheckingNext ? <Loader2 size={15} className="animate-spin shrink-0" /> : <Search size={15} className="shrink-0" />}
              <span className="hidden lg:inline">{isCheckingNext ? 'Verificando...' : 'Verificar próxima'}</span>
              <span className="hidden md:inline lg:hidden">{isCheckingNext ? '...' : 'Próxima'}</span>
            </button>

            <button 
              onClick={() => window.print()} 
              className="h-9 sm:h-10 px-2.5 sm:px-3 rounded-xl text-xs font-bold text-gray-700 bg-white hover:bg-gray-50 border border-gray-200 shadow-xs flex items-center justify-center gap-1.5 transition-all active:scale-[0.98]"
              title="Imprimir folha A4 em modo Paisagem"
            >
              <Printer size={15} className="shrink-0 text-gray-500" />
              <span className="hidden md:inline">Imprimir A4</span>
            </button>
          </div>
        </div>

        {/* Compact Navigation Bar: Season Dropdown & Parts Selector */}
        <div className="flex items-center justify-between gap-2 p-1.5 bg-gray-100/90 rounded-2xl border border-gray-200/80 flex-wrap">
          {/* Seletor de Temporada */}
          <div className="flex items-center gap-1.5 shrink-0">
            <label htmlFor="season-select" className="text-[11px] font-bold text-gray-500 uppercase tracking-wider pl-1 hidden xs:inline">
              Temporada:
            </label>
            <div className="relative inline-flex items-center">
              <select
                id="season-select"
                value={selectedYear}
                onChange={(e) => handleYearChange(e.target.value)}
                className="h-8 sm:h-9 pl-3 pr-8 rounded-lg sm:rounded-xl text-xs font-bold text-gray-800 bg-white border border-gray-200 shadow-2xs focus:outline-none focus:ring-2 focus:ring-[#512da8]/30 focus:border-[#512da8] appearance-none cursor-pointer"
              >
                {availableYears.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-2.5 pointer-events-none text-gray-400" />
            </div>
          </div>

          {/* Seletor de Partes (A, B, C, D) */}
          <div className="flex items-center gap-1 bg-white p-0.5 rounded-xl border border-gray-200/60 shadow-2xs shrink-0 ml-auto">
            {[0, 1, 2, 3].map((part) => {
              const isActive = selectedPart === part;
              const letter = ['A', 'B', 'C', 'D'][part];
              return (
                <button
                  key={part}
                  onClick={() => setSelectedPart(part)}
                  className={`h-8 sm:h-9 px-2.5 sm:px-3.5 rounded-lg text-xs transition-all whitespace-nowrap active:scale-[0.98] flex items-center justify-center ${
                    isActive 
                      ? 'bg-violet-600 text-white shadow-xs font-bold' 
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50 font-medium'
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

        {/* Zoom & Document Viewport Toolbar (A4 Controller) */}
        <div className="flex items-center justify-between gap-2 p-2 bg-slate-900 text-white rounded-2xl shadow-md flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-300 px-2 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              Folha A4 Paisagem (297 × 210 mm)
            </span>
          </div>

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
                  className={`px-2 py-1 text-[11px] font-bold rounded-md transition-all ${
                    zoom === preset ? 'bg-violet-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
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
              className="px-2.5 py-1 text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg flex items-center gap-1 transition-colors"
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
      </div>

      {/* A4 Document Viewport Container */}
      <div 
        ref={containerRef}
        className="w-full overflow-x-auto overflow-y-visible bg-slate-200/80 rounded-3xl p-3 sm:p-6 lg:p-8 flex flex-col items-start shadow-inner custom-scrollbar relative border border-slate-300/80"
        style={{
          minHeight: '400px',
          touchAction: 'pan-x pan-y',
        }}
      >
        {/* Scaled Document Wrapper */}
        <div 
          className="flex flex-col items-start transition-all duration-150 relative mx-auto shrink-0"
          style={{
            width: `${(297 * zoom) / 100}mm`,
            minWidth: `${(297 * zoom) / 100}mm`,
            height: `${(sheetHeight * zoom) / 100 + 40}px`,
            minHeight: `${(sheetHeight * zoom) / 100 + 40}px`,
          }}
        >
          {/* Physical A4 Digital Document Sheet */}
          <div 
            id="circuit-assembly-a4-sheet"
            ref={sheetRef}
            className="bg-white text-slate-900 shadow-2xl rounded-xs border border-gray-300 print:shadow-none print:border-none print:m-0 flex flex-col box-border select-text"
            style={{
              width: '297mm',
              minWidth: '297mm',
              minHeight: '210mm',
              padding: '10mm 12mm',
              transform: `scale(${zoom / 100})`,
              transformOrigin: 'top left',
              position: 'relative',
              transition: 'transform 0.15s ease-out',
            }}
          >
            {/* Sheet Top Header */}
            <div className="border-b border-gray-200 pb-2 mb-3">
              {/* Assembly Program Title & Part Identification */}
              <div className="flex items-center justify-between gap-4">
                <p className="text-[9.5pt] font-extrabold uppercase tracking-wide text-gray-600 leading-tight">
                  {assemblyProgram.title}
                </p>
                <span className="text-[9pt] font-black uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-200/80 px-2 py-0.5 rounded shrink-0">
                  PROGRAMA — PARTE {['A', 'B', 'C', 'D'][selectedPart] || 'A'}
                </span>
              </div>

              {/* Main Theme Verse */}
              <h2 className="font-serif italic font-bold text-[14pt] text-gray-950 text-center tracking-tight my-1.5 leading-snug">
                {details.assemblyTheme || assemblyProgram.theme}
              </h2>

              {/* Event Metadata Strip (Data, Local, Ensaio) */}
              <div className="flex items-center justify-between gap-3 text-[8.5pt] text-gray-700 bg-gray-50/80 border border-gray-200/70 rounded px-3 py-1 mt-1 flex-wrap">
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <span className="font-black text-gray-500 uppercase text-[7.5pt]">DATA:</span>
                    <span className="font-bold text-gray-900">{details.eventDate || 'A definir'}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-black text-gray-500 uppercase text-[7.5pt]">LOCAL:</span>
                    <span className="font-bold text-gray-900">{details.eventLocation || 'A definir'}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-black text-gray-500 uppercase text-[7.5pt]">ENSAIO:</span>
                    <span className="font-bold text-gray-900">
                      {details.rehearsalDate ? `${details.rehearsalDate}${details.rehearsalLocation ? ` — ${details.rehearsalLocation}` : ''}` : 'A definir'}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => setShowEditDetailsModal(true)}
                  className="no-print text-[8pt] font-bold text-amber-700 hover:text-amber-900 hover:underline flex items-center gap-1 cursor-pointer"
                  title="Editar informações do evento"
                >
                  <Edit3 size={11} />
                  <span>Editar</span>
                </button>
              </div>
            </div>

            {/* Two Balanced Columns for Landscape (Sessão da Manhã & Sessão da Tarde) */}
            <div className="grid grid-cols-2 gap-6 items-start flex-1">
              {assemblyProgram.sessions.map((session: any) => (
                <div key={session.period} className="flex flex-col">
                  {/* Session Header Bar */}
                  <div className="flex items-baseline justify-between border-b-2 border-amber-500 pb-1 mb-2">
                    <h3 className="text-[11pt] font-black tracking-wider uppercase text-amber-900">
                      SESSÃO DA {session.period.toUpperCase()}
                    </h3>
                    <span className="text-[7.5pt] font-bold tracking-wider uppercase text-gray-400">
                      HORÁRIO • PROGRAMA • ORADOR
                    </span>
                  </div>

                  {/* Session Items List */}
                  <div className="space-y-1.5">
                    {session.items.map((item: any) => {
                      const isSymposium = item.subitems && item.subitems.length > 0;
                      const hasSpeaker = !item.noSpeaker;
                      const isRole = item.isRole;

                      if (isSymposium) {
                        return (
                          <div key={item.id} className="bg-amber-50/30 rounded p-1.5 border border-amber-100/60 my-1">
                            {/* Symposium Title Row */}
                            <div className="flex items-start gap-2 mb-1">
                              <span className="text-[8.5pt] font-black text-amber-700 w-11 shrink-0 mt-0.5">
                                {item.time || ''}
                              </span>
                              <div className="flex-1 min-w-0">
                                <span className="text-[7.5pt] font-extrabold uppercase text-amber-700 tracking-wider mr-1.5 block leading-tight">
                                  {item.label || 'SÉRIE DE DISCURSOS:'}
                                </span>
                                <span className="text-[9.5pt] font-bold text-gray-950 leading-tight">
                                  {item.title}
                                </span>
                              </div>
                            </div>

                            {/* Symposium Subitems (Indented with amber border) */}
                            <div className="ml-11 border-l-2 border-amber-300/80 pl-2.5 space-y-1.5 mt-1">
                              {item.subitems.map((sub: any, idx: number) => {
                                const subSpeaker = speakers[sub.id] || '';
                                const subCong = congregations[sub.id] || '';
                                const subNote = currentPart.notes?.[sub.id] || '';
                                const isConfirmed = !!confirmedSpeakers[sub.id];

                                return (
                                  <div key={sub.id} className="border-b border-amber-100/50 pb-1 last:border-b-0">
                                    <div className="flex items-start justify-between gap-1.5">
                                      <div className="flex items-start gap-1 flex-1 min-w-0">
                                        <span className="text-amber-700 font-black text-[8.5pt] shrink-0 mt-0.5">
                                          {idx + 1}.
                                        </span>
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className="text-[9pt] font-semibold text-gray-900 leading-tight">
                                              {sub.title}
                                            </span>
                                            {sub.time ? (
                                              <span className="text-[7.5pt] font-bold text-amber-700 bg-amber-100/60 px-1 py-0.2 rounded">
                                                {sub.time}
                                              </span>
                                            ) : (
                                              <input
                                                type="text"
                                                placeholder="--:--"
                                                value={currentPart.userTimes?.[sub.id] || ''}
                                                onChange={e => handleUserTimeChange(sub.id, e.target.value)}
                                                className="w-8 text-[7.5pt] font-bold text-amber-700 bg-transparent border-b border-amber-200 outline-none text-center"
                                                title="Horário personalizado"
                                              />
                                            )}
                                          </div>

                                          {/* Speaker & Details Inputs */}
                                          <div className="mt-0.5 space-y-0.5">
                                            <div className="relative">
                                              <input
                                                type="text"
                                                placeholder="Nome do orador..."
                                                value={subSpeaker}
                                                onChange={e => handleSpeakerChange(sub.id, e.target.value)}
                                                className={`w-full text-[9pt] font-bold text-gray-900 bg-transparent border-b border-gray-200/80 focus:border-amber-500 outline-none placeholder:text-gray-300 ${!subSpeaker ? 'print:hidden' : ''}`}
                                              />
                                              {!subSpeaker && (
                                                <div className="hidden print:flex items-baseline w-full text-[8.5pt] text-gray-600 font-normal">
                                                  <span className="text-[7.5pt] font-semibold text-gray-400 mr-1.5 shrink-0">Orador:</span>
                                                  <span className="flex-1 border-b border-dotted border-gray-400 pb-0.5">&nbsp;</span>
                                                </div>
                                              )}
                                            </div>
                                            <div className="flex items-center gap-2">
                                              <div className="w-1/2 relative">
                                                <input
                                                  type="text"
                                                  placeholder="Congregação..."
                                                  value={subCong}
                                                  onChange={e => handleCongregationChange(sub.id, e.target.value)}
                                                  className={`w-full text-[8pt] text-gray-600 bg-transparent border-b border-gray-100 focus:border-amber-400 outline-none placeholder:text-gray-300 ${!subCong ? 'print:hidden' : ''}`}
                                                />
                                                {!subCong && (
                                                  <div className="hidden print:flex items-baseline w-full text-[7.5pt] text-gray-500 font-normal">
                                                    <span className="text-[7pt] font-medium text-gray-400 mr-1 shrink-0">Congr:</span>
                                                    <span className="flex-1 border-b border-dotted border-gray-300 pb-0.5">&nbsp;</span>
                                                  </div>
                                                )}
                                              </div>
                                              <div className="w-1/2 relative">
                                                <input
                                                  type="text"
                                                  placeholder="Notas..."
                                                  value={subNote}
                                                  onChange={e => handleNotesChange(sub.id, e.target.value)}
                                                  className="w-1/2 text-[8pt] text-gray-500 italic bg-transparent border-b border-gray-100 focus:border-amber-400 outline-none placeholder:text-gray-300"
                                                />
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      </div>

                                      {/* Action buttons (Confirmation & Docx letter) */}
                                      <div className="flex items-center gap-1 shrink-0 no-print mt-1">
                                        <button
                                          onClick={() => handleConfirmationToggle(sub.id)}
                                          className={`p-1 rounded transition-colors cursor-pointer ${
                                            isConfirmed ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-400 hover:text-gray-600'
                                          }`}
                                          title={isConfirmed ? 'Confirmado' : 'Marcar confirmação'}
                                        >
                                          <CheckCircle2 size={13} />
                                        </button>
                                        <button
                                          onClick={() => generateDocument({ ...sub, time: sub.time || currentPart.userTimes?.[sub.id] || '', title: `${item.title}: ${sub.title}` }, 'docx')}
                                          className="p-1 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded transition-colors cursor-pointer"
                                          title="Gerar Carta de Designação (.docx)"
                                        >
                                          <FileText size={13} />
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

                      const isMusicOrIntermission = !hasSpeaker;
                      const speakerName = speakers[item.id] || '';
                      const speakerCong = congregations[item.id] || '';
                      const speakerNote = currentPart.notes?.[item.id] || '';
                      const isConfirmed = !!confirmedSpeakers[item.id];

                      return (
                        <div 
                          key={item.id} 
                          className={`p-1.5 rounded transition-colors ${
                            isRole ? 'bg-violet-50/50 border border-violet-100' : 'border-b border-gray-100 hover:bg-gray-50/50'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-2 flex-1 min-w-0">
                              {item.time ? (
                                <span className="text-[8.5pt] font-black text-amber-700 w-11 shrink-0 mt-0.5">
                                  {item.time}
                                </span>
                              ) : (
                                <span className="w-11 shrink-0"></span>
                              )}

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {item.label && (
                                    <span className="text-[7.5pt] font-extrabold uppercase text-amber-700 tracking-wider">
                                      {item.label}
                                    </span>
                                  )}
                                  <span className={`text-[9pt] leading-tight ${
                                    isMusicOrIntermission ? 'font-medium text-gray-500 italic' : isRole ? 'font-black text-violet-900 tracking-wider uppercase' : 'font-bold text-gray-900'
                                  }`}>
                                    {item.title}
                                  </span>
                                </div>

                                 {hasSpeaker && (
                                  <div className="mt-1 space-y-0.5">
                                    <div className="relative">
                                      <input
                                        type="text"
                                        placeholder={isRole ? "Nome do Presidente..." : "Nome do orador..."}
                                        value={speakerName}
                                        onChange={e => handleSpeakerChange(item.id, e.target.value)}
                                        className={`w-full text-[9pt] font-bold text-gray-900 bg-transparent border-b border-gray-200/80 focus:border-amber-500 outline-none placeholder:text-gray-300 ${!speakerName ? 'print:hidden' : ''}`}
                                      />
                                      {!speakerName && (
                                        <div className="hidden print:flex items-baseline w-full text-[8.5pt] text-gray-600 font-normal">
                                          <span className="text-[7.5pt] font-semibold text-gray-400 mr-1.5 shrink-0">
                                            {isRole ? 'Designado:' : 'Orador:'}
                                          </span>
                                          <span className="flex-1 border-b border-dotted border-gray-400 pb-0.5">&nbsp;</span>
                                        </div>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <div className="w-1/2 relative">
                                        <input
                                          type="text"
                                          placeholder="Congregação..."
                                          value={speakerCong}
                                          onChange={e => handleCongregationChange(item.id, e.target.value)}
                                          className={`w-full text-[8pt] text-gray-600 bg-transparent border-b border-gray-100 focus:border-amber-400 outline-none placeholder:text-gray-300 ${!speakerCong ? 'print:hidden' : ''}`}
                                        />
                                        {!speakerCong && (
                                          <div className="hidden print:flex items-baseline w-full text-[7.5pt] text-gray-500 font-normal">
                                            <span className="text-[7pt] font-medium text-gray-400 mr-1 shrink-0">Congr:</span>
                                            <span className="flex-1 border-b border-dotted border-gray-300 pb-0.5">&nbsp;</span>
                                          </div>
                                        )}
                                      </div>
                                      <div className="w-1/2 relative">
                                        <input
                                          type="text"
                                          placeholder="Notas..."
                                          value={speakerNote}
                                          onChange={e => handleNotesChange(item.id, e.target.value)}
                                          className="w-full text-[8pt] text-gray-500 italic bg-transparent border-b border-gray-100 focus:border-amber-400 outline-none placeholder:text-gray-300"
                                        />
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>

                            {hasSpeaker && (
                              <div className="flex items-center gap-1 shrink-0 no-print mt-1">
                                <button
                                  onClick={() => handleConfirmationToggle(item.id)}
                                  className={`p-1 rounded transition-colors cursor-pointer ${
                                    isConfirmed ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-400 hover:text-gray-600'
                                  }`}
                                  title={isConfirmed ? 'Confirmado' : 'Marcar confirmação'}
                                >
                                  <CheckCircle2 size={13} />
                                </button>
                                <button
                                  onClick={() => generateDocument(item, 'docx')}
                                  className="p-1 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded transition-colors cursor-pointer"
                                  title="Gerar Carta de Designação (.docx)"
                                >
                                  <FileText size={13} />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Sheet Bottom Footer */}
            <div className="border-t border-gray-200 pt-2 mt-4 flex items-center justify-between text-[7.5pt] font-semibold text-gray-400 uppercase tracking-wider">
              <span>{assemblyProgram.title}</span>
              <span>Temporada {selectedYear} • Parte {['A', 'B', 'C', 'D'][selectedPart] || 'A'}</span>
            </div>
          </div>
        </div>

        {/* Orphaned Parts / Revisions Section (Below A4 Sheet) */}
        {Object.keys(currentPart.orphanedParts || {}).length > 0 && (
          <div className="mt-8 sm:mt-12 w-full max-w-5xl mx-auto px-4 no-print">
            <div className="bg-amber-50 rounded-[2rem] border border-amber-200 p-6 sm:p-8 shadow-sm">
              <div className="flex items-start gap-4 mb-6">
                <div className="p-3 bg-amber-100 rounded-2xl text-amber-600">
                  <AlertTriangle size={28} />
                </div>
                <div>
                  <h3 className="text-xl font-black uppercase tracking-tight text-amber-900 leading-tight">Itens Órfãos / Revisões Necessárias</h3>
                  <p className="text-sm text-amber-700 font-medium mt-1">
                    Estes dados foram preservados de versões anteriores mas não possuem correspondência automática na programação atual.
                  </p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(currentPart.orphanedParts || {}).map(([oldId, data]: [string, any]) => (
                  <div key={oldId} className="bg-white p-5 rounded-2xl border border-amber-200 shadow-sm hover:shadow-md transition-all group">
                    <div className="flex justify-between items-start mb-4">
                      <div className="min-w-0">
                        <div className="text-[10px] font-black uppercase text-amber-600 mb-1 px-2 py-0.5 bg-amber-50 rounded-full inline-block">
                          {data.reason || 'Diferença de Versão'}
                        </div>
                        <h4 className="text-base font-bold text-gray-900 leading-tight line-clamp-2">{data.originalTitle || 'Título Desconhecido'}</h4>
                        <div className="text-xs text-gray-500 font-medium mt-0.5">{data.originalTime || '--:--'}</div>
                      </div>
                      <button 
                        onClick={() => {
                          setPartsData(prev => {
                            const newOrphans = { ...prev[selectedPart].orphanedParts };
                            delete newOrphans[oldId];
                            return {
                              ...prev,
                              [selectedPart]: { ...prev[selectedPart], orphanedParts: newOrphans }
                            };
                          });
                        }}
                        className="text-gray-300 hover:text-red-500 p-1.5 transition-colors"
                        title="Remover permanentemente"
                      >
                        <RefreshCw size={14} className="rotate-45" />
                      </button>
                    </div>
                    
                    <div className="space-y-2.5 pt-3 border-t border-gray-50">
                      <div className="flex items-center gap-2.5">
                        <User size={14} className="text-amber-500 shrink-0" />
                        <span className="text-sm font-bold text-gray-800 truncate">{data.speaker}</span>
                      </div>
                      {data.congregation && (
                        <div className="flex items-center gap-2.5">
                          <MapPin size={14} className="text-gray-400 shrink-0" />
                          <span className="text-xs text-gray-600 truncate">{data.congregation}</span>
                        </div>
                      )}
                      {data.notes && (
                        <div className="flex items-start gap-2.5 bg-gray-50 p-2 rounded-lg">
                          <FileText size={14} className="text-gray-400 shrink-0 mt-0.5" />
                          <span className="text-xs text-gray-500 italic leading-tight line-clamp-2">{data.notes}</span>
                        </div>
                      )}
                      
                      <button 
                        onClick={() => {
                          setReassigningOrphan({ id: oldId, data });
                          setShowReassignModal(true);
                        }}
                        className="w-full mt-4 py-2.5 bg-violet-50 text-violet-700 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-violet-100 transition-all active:scale-[0.98]"
                      >
                        <RefreshCw size={14} />
                        Reatribuir à programação
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Discard Changes Modal */}
      {/* Modals e overlays */}
      <AnimatePresence>
        {nextSeasonPreview && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm no-print">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-100"
            >
              <div className="p-6">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-4">
                  <Search size={24} className="text-blue-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">🆕 Nova programação encontrada!</h3>
                <p className="text-gray-500 text-sm mb-6 leading-relaxed">
                  A programação da temporada <strong>{nextSeasonPreview.year}</strong> foi localizada no JW.org e está pronta para ser adicionada ao seu sistema.
                </p>

                <div className="bg-gray-50 rounded-xl p-4 mb-6 border border-gray-100 overflow-hidden">
                  {nextSeasonPreview.headerImage && (
                    <div className="relative h-28 w-full rounded-lg overflow-hidden mb-3 border border-gray-200">
                      <Image 
                        src={nextSeasonPreview.headerImage} 
                        alt="Tema da Assembleia" 
                        fill 
                        className="object-cover" 
                        unoptimized
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  )}
                  <div className="flex flex-col gap-3">
                    <div>
                      <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Temporada</span>
                      <p className="font-bold text-gray-800">{nextSeasonPreview.year}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Tema Encontrado</span>
                      <p className="font-medium text-gray-800 italic">“{nextSeasonPreview.theme}”</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Partes Detectadas</span>
                      <p className="font-bold text-gray-800">{nextSeasonPreview.itemCount} itens na programação</p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <button
                    onClick={handleConfirmNewSeason}
                    className="w-full py-3 bg-[#512da8] text-white font-bold rounded-xl shadow-lg shadow-violet-200 hover:bg-[#4527a0] transition-all"
                  >
                    Adicionar nova temporada
                  </button>
                  <button
                    onClick={() => setNextSeasonPreview(null)}
                    className="w-full py-3 bg-white text-gray-400 font-bold rounded-xl hover:bg-gray-50 transition-all"
                  >
                    Agora não
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* Modal de Reatribuição Manual */}
        {showReassignModal && reassigningOrphan && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }} 
              className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-100"
            >
              {/* Header */}
              <div className="p-6 border-b border-gray-100 bg-indigo-50/50">
                <h3 className="text-xl font-black text-indigo-900 uppercase tracking-tight">Reatribuir Designação</h3>
                <p className="text-sm text-indigo-700">Mover dados preservados para uma parte da programação atual.</p>
              </div>

              {/* Orphan Info */}
              <div className="p-6 bg-amber-50/30 border-b border-amber-100/50">
                <div className="text-[10px] font-black uppercase text-amber-600 mb-2">Dados Preservados</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm font-bold text-gray-800">
                      <User size={16} className="text-indigo-500" />
                      {reassigningOrphan.data.speaker}
                    </div>
                    {reassigningOrphan.data.congregation && (
                      <div className="flex items-center gap-2 text-xs text-gray-500 ml-6">
                        <MapPin size={12} />
                        {reassigningOrphan.data.congregation}
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 bg-white/50 p-2 rounded-xl border border-amber-100">
                    <span className="font-bold">Parte Anterior:</span> {reassigningOrphan.data.originalTitle} ({reassigningOrphan.data.originalTime})
                  </div>
                </div>
                {reassigningOrphan.data.notes && (
                  <div className="mt-3 text-xs italic text-gray-600 bg-white/50 p-2 rounded-xl border border-amber-100 flex gap-2">
                    <FileText size={14} className="shrink-0" />
                    "{reassigningOrphan.data.notes}"
                  </div>
                )}
              </div>

              {/* Target Selection */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {assemblyProgram.sessions.map((session: any) => (
                  <div key={session.period} className="space-y-3">
                    <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                      <Clock size={12} />
                      Sessão da {session.period}
                    </h4>
                    <div className="grid grid-cols-1 gap-2">
                      {session.items
                        .filter((item: any) => !item.noSpeaker && !item.isRole)
                        .map((item: any) => {
                          const hasData = partsData[selectedPart].speakers?.[item.id] || 
                                         partsData[selectedPart].congregations?.[item.id] || 
                                         partsData[selectedPart].notes?.[item.id];
                          
                          return (
                            <button
                              key={item.id}
                              onClick={() => handleConfirmReassign(item.id)}
                              className={`text-left p-4 rounded-2xl border transition-all flex items-center justify-between group ${
                                replaceConfirm?.targetId === item.id 
                                  ? 'border-amber-500 bg-amber-50 ring-2 ring-amber-200' 
                                  : 'border-gray-100 hover:border-indigo-300 hover:bg-indigo-50'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div className="text-xs font-bold text-indigo-600 w-10">{item.time}</div>
                                <div>
                                  <div className="text-sm font-bold text-gray-800">{item.title}</div>
                                  <div className="text-[10px] text-gray-400 font-mono">{item.id}</div>
                                </div>
                              </div>
                              {hasData && (
                                <div className="px-2 py-1 bg-amber-100 text-amber-700 text-[10px] font-bold rounded-lg uppercase">
                                  Já preenchido
                                </div>
                              )}
                            </button>
                          );
                        })}
                      
                      {/* Subitems (Série de discursos) */}
                      {session.items
                        .filter((item: any) => item.subitems)
                        .flatMap((item: any) => item.subitems.map((sub: any) => {
                          const hasData = partsData[selectedPart].speakers?.[sub.id] || 
                                         partsData[selectedPart].congregations?.[sub.id] || 
                                         partsData[selectedPart].notes?.[sub.id];
                          
                          return (
                            <button
                              key={sub.id}
                              onClick={() => handleConfirmReassign(sub.id)}
                              className={`text-left p-4 rounded-2xl border transition-all flex items-center justify-between group ml-4 border-l-4 ${
                                replaceConfirm?.targetId === sub.id 
                                  ? 'border-amber-500 bg-amber-50 ring-2 ring-amber-200' 
                                  : 'border-gray-100 hover:border-indigo-300 hover:bg-indigo-50'
                              }`}
                              style={{ borderLeftColor: replaceConfirm?.targetId === sub.id ? '#F59E0B' : '#E5E7EB' }}
                            >
                              <div className="flex items-center gap-3">
                                <div className="text-[10px] font-bold text-gray-400 w-10">
                                  {sub.time || partsData[selectedPart].userTimes?.[sub.id] || 'SUB'}
                                </div>
                                <div>
                                  <div className="text-sm font-bold text-gray-800 line-clamp-1">{sub.title}</div>
                                  <div className="text-[10px] text-gray-400 font-mono">{sub.id}</div>
                                </div>
                              </div>
                              {hasData && (
                                <div className="px-2 py-1 bg-amber-100 text-amber-700 text-[10px] font-bold rounded-lg uppercase">
                                  Já preenchido
                                </div>
                              )}
                            </button>
                          );
                        }))
                      }
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer / Confirmations */}
              <div className="p-6 border-t border-gray-100 bg-gray-50 flex flex-col gap-3">
                {replaceConfirm && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }} 
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 bg-amber-100 rounded-2xl border border-amber-200 mb-2"
                  >
                    <div className="flex gap-3">
                      <AlertTriangle className="text-amber-600 shrink-0" size={20} />
                      <div>
                        <p className="text-sm font-bold text-amber-900">Esta parte já possui uma designação.</p>
                        <p className="text-xs text-amber-700">Deseja substituir os dados existentes pelos dados deste item órfão?</p>
                        <div className="flex gap-3 mt-3">
                          <button 
                            onClick={() => handleConfirmReassign(replaceConfirm.targetId, true)}
                            className="px-4 py-2 bg-amber-600 text-white text-xs font-bold rounded-lg hover:bg-amber-700"
                          >
                            Substituir e reatribuir
                          </button>
                          <button 
                            onClick={() => setReplaceConfirm(null)}
                            className="px-4 py-2 bg-white text-amber-700 text-xs font-bold rounded-lg border border-amber-200"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                <div className="flex justify-between items-center">
                  <button 
                    onClick={() => {
                      setShowReassignModal(false);
                      setReassigningOrphan(null);
                      setReplaceConfirm(null);
                    }}
                    className="px-6 py-3 text-gray-500 font-bold hover:bg-gray-100 rounded-xl transition-colors"
                  >
                    Fechar
                  </button>
                  <div className="text-xs text-gray-400 italic">Selecione uma parte da lista acima</div>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* Modal de Edição de Detalhes do Evento */}
        {showEditDetailsModal && (
          <div className="fixed inset-0 z-[1001] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md no-print">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden border border-gray-100"
            >
              <div className="p-6 bg-amber-50 border-b border-amber-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-amber-100 rounded-xl text-amber-600">
                    <CalendarDays size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-amber-900 uppercase tracking-tight">Detalhes do Evento</h3>
                    <p className="text-xs text-amber-700">Informações que aparecem no cabeçalho da folha.</p>
                  </div>
                </div>
                <button onClick={() => setShowEditDetailsModal(false)} className="p-2 text-amber-400 hover:text-amber-600 transition-colors">
                  <X size={24} />
                </button>
              </div>

              <div className="p-6 space-y-5">
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Tema da Assembleia</label>
                      <input 
                        type="text" 
                        value={details.assemblyTheme} 
                        onChange={e => setPartsData(prev => ({ ...prev, [selectedPart]: { ...prev[selectedPart], details: { ...prev[selectedPart].details, assemblyTheme: e.target.value } } }))}
                        placeholder="Ex: 'Encontre a Mais Plena Alegria em Jeová'"
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Data do Evento</label>
                      <input 
                        type="text" 
                        value={details.eventDate} 
                        onChange={e => setPartsData(prev => ({ ...prev, [selectedPart]: { ...prev[selectedPart], details: { ...prev[selectedPart].details, eventDate: e.target.value } } }))}
                        placeholder="Ex: 15 de Outubro"
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Local</label>
                      <input 
                        type="text" 
                        value={details.eventLocation} 
                        onChange={e => setPartsData(prev => ({ ...prev, [selectedPart]: { ...prev[selectedPart], details: { ...prev[selectedPart].details, eventLocation: e.target.value } } }))}
                        placeholder="Ex: Salão de Assembleias"
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Data do Ensaio</label>
                      <input 
                        type="text" 
                        value={details.rehearsalDate} 
                        onChange={e => setPartsData(prev => ({ ...prev, [selectedPart]: { ...prev[selectedPart], details: { ...prev[selectedPart].details, rehearsalDate: e.target.value } } }))}
                        placeholder="Ex: Sábado, 14:00"
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Local do Ensaio</label>
                      <input 
                        type="text" 
                        value={details.rehearsalLocation} 
                        onChange={e => setPartsData(prev => ({ ...prev, [selectedPart]: { ...prev[selectedPart], details: { ...prev[selectedPart].details, rehearsalLocation: e.target.value } } }))}
                        placeholder="Ex: Congregação Central"
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all"
                      />
                    </div>
                  </div>
                </div>

                <button 
                  onClick={() => setShowEditDetailsModal(false)}
                  className="w-full py-4 bg-amber-600 text-white font-bold rounded-2xl shadow-lg shadow-amber-100 hover:bg-amber-700 transition-all active:scale-[0.98] mt-4"
                >
                  Concluir Edição
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Floating Save Bar (quando houver alterações não salvas) */}
        {hasChanges && !isGuest && (
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            className="fixed bottom-20 portrait:bottom-20 landscape:bottom-6 sm:bottom-6 left-1/2 -translate-x-1/2 z-[1002] bg-gray-950/95 text-white backdrop-blur-lg px-4 sm:px-6 py-2.5 sm:py-3 rounded-2xl shadow-2xl flex items-center justify-between gap-3 sm:gap-6 border border-white/15 max-w-[calc(100vw-1.5rem)] w-auto no-print"
          >
            <div className="flex items-center gap-2 shrink-0">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <span className="text-xs sm:text-sm font-semibold text-gray-200 whitespace-nowrap">
                Alterações não salvas
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setPartsData(JSON.parse(initialPartsData))}
                disabled={isSaving}
                className="px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-gray-300 hover:text-white rounded-lg transition-colors cursor-pointer disabled:opacity-50"
              >
                Descartar
              </button>
              <button
                onClick={() => handleSave(true)}
                disabled={isSaving}
                className="px-3.5 sm:px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs sm:text-sm font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 whitespace-nowrap"
              >
                {isSaving ? <Loader2 size={15} className="animate-spin shrink-0" /> : <Save size={15} className="shrink-0" />}
                <span>{isSaving ? 'Salvando...' : 'Salvar Agora'}</span>
              </button>
            </div>
          </motion.div>
        )}

        {showConfirmModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl">
              <h3 className="text-xl font-bold text-gray-900 mb-2">Alterações não salvas</h3>
              <p className="text-gray-500 text-sm mb-6">Existem alterações não salvas. Deseja salvar antes de sair?</p>
              <div className="flex flex-col gap-3">
                <button onClick={async () => { await handleSave(false); setShowConfirmModal(false); if (pendingAction) pendingAction(); }} className="w-full py-3 bg-emerald-500 text-white rounded-2xl font-bold">Salvar e Continuar</button>
                <button onClick={() => { setPartsData(JSON.parse(initialPartsData)); setShowConfirmModal(false); if (pendingAction) pendingAction(); }} className="w-full py-3 bg-red-50 text-red-600 rounded-2xl font-bold">Descartar Alterações</button>
                <button onClick={() => setShowConfirmModal(false)} className="w-full py-3 text-gray-400 font-bold">Cancelar</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
