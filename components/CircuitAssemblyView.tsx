'use client';

import { useDialog } from '@/hooks/useDialog';
import { cleanPSSMetadata } from '@/lib/docxUtils';
import CustomSelect from '@/components/CustomSelect';
import { db } from '@/lib/firebase';
import Docxtemplater from 'docxtemplater';
import { collection, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { AlertTriangle, BookOpen, Calendar, CalendarDays, Check, CheckCircle2, ChevronDown, ChevronLeft, Clock, Edit3, FileDown, FileText, Info, LayoutGrid, LayoutList, Loader2, Mail, MapPin, Maximize2, Minimize2, Minus, Music, Plus, Printer, RefreshCw, Save, Search, Table as TableIcon, Trash2, User, UserCheck, X, ZoomIn, ZoomOut } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import Image from 'next/image';
import PizZip from 'pizzip';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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
  customHeaderImage?: string;
  assemblyAssistants?: string[];
  assemblyAssistant?: string;
  assistantCongregations?: Record<number, string>;
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
            { id: 't2', time: '1:30', title: 'Cântico 111 e oração', icon: Music },
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
            { id: 't2', time: '1:30', title: 'Cântico e oração', icon: Music },
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
  
  const normalizeProgram = useCallback((base: any) => {
    if (!base || !base.sessions) return base;

    const normalizedSessions = base.sessions.map((session: any, sIdx: number) => {
      let items = [...(session.items || [])];
      const isMorning = session.period?.toLowerCase().includes('manhã') || sIdx === 0;
      const expectedPresidentId = isMorning ? 'm0' : 't0';

      // Localizar qualquer item existente de Presidente de Sessão
      const presidentIndex = items.findIndex(i => {
        const titleNorm = (i.title || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return i.id === expectedPresidentId || 
               i.id === 'm0' || 
               i.id === 't0' ||
               (i.isRole && titleNorm.includes('presidente')) ||
               titleNorm.trim() === 'presidente de sessao';
      });

      if (presidentIndex >= 0) {
        // Garantir ID canônico e único para cada sessão (m0 para Manhã, t0 para Tarde)
        items[presidentIndex] = {
          ...items[presidentIndex],
          id: expectedPresidentId,
          title: 'PRESIDENTE DE SESSÃO',
          isRole: true,
          noSpeaker: false
        };
      } else {
        // Inserir no topo se ainda não estiver presente
        items.unshift({
          id: expectedPresidentId,
          title: 'PRESIDENTE DE SESSÃO',
          isRole: true,
          noSpeaker: false
        });
      }

      // Remover quaisquer duplicatas acidentais do presidente nesta sessão
      let seenPres = false;
      items = items.filter(item => {
        const itemTitleNorm = (item.title || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const isPres = item.id === expectedPresidentId || 
                       item.id === 'm0' || 
                       item.id === 't0' || 
                       (item.isRole && itemTitleNorm.includes('presidente')) ||
                       itemTitleNorm.trim() === 'presidente de sessao';
        
        if (isPres) {
          if (seenPres) return false;
          seenPres = true;
          // Se for o presidente encontrado, garantimos que tenha o ID correto se já não tiver
          if (item.id !== expectedPresidentId && (item.id === 'm0' || item.id === 't0' || item.isRole)) {
             item.id = expectedPresidentId;
          }
        }
        return true;
      });

      // Garantir que orações e papéis de presidente não tenham noSpeaker: true, sem sobrescrever IDs de outros itens
      items = items.map((item: any) => {
        const titleNorm = (item.title || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const isPrayer = titleNorm.includes('oracao') || titleNorm.includes('prayer');
        const isCurrentPresident = item.id === expectedPresidentId;
        
        if (isPrayer || isCurrentPresident) {
          return {
            ...item,
            noSpeaker: false,
            isRole: isCurrentPresident ? true : !!item.isRole
          };
        }
        return item;
      });

      // Garantir unicidade absoluta de todos os IDs de itens e subitens nesta sessão
      const seenItemIds = new Set<string>();
      items = items.map((item: any, itemIdx: number) => {
        let finalId = item.id;
        if (!finalId || seenItemIds.has(finalId)) {
          finalId = `${expectedPresidentId === 'm0' ? 'm' : 't'}_item_${itemIdx}_${item.time ? item.time.replace(':', '') : itemIdx}`;
          if (seenItemIds.has(finalId)) {
            finalId = `${finalId}_${itemIdx}`;
          }
        }
        seenItemIds.add(finalId);

        let subitems = item.subitems;
        if (subitems && Array.isArray(subitems)) {
          const seenSubIds = new Set<string>();
          subitems = subitems.map((sub: any, subIdx: number) => {
            let subId = sub.id;
            if (!subId || seenSubIds.has(subId) || seenItemIds.has(subId)) {
              subId = `${finalId}_${subIdx + 1}`;
            }
            seenSubIds.add(subId);
            return { ...sub, id: subId };
          });
        }

        return {
          ...item,
          id: finalId,
          ...(subitems ? { subitems } : {})
        };
      });

      return { ...session, items };
    });

    return {
      ...base,
      sessions: normalizedSessions
    };
  }, []);

  const assemblyProgram = useMemo(() => {
    const base = dynamicProgram 
      ? { ...staticProgram, ...dynamicProgram } 
      : staticProgram;
    
    return normalizeProgram(base);
  }, [staticProgram, dynamicProgram, normalizeProgram]);

  const { showAlert } = useDialog();

  const [reassigningOrphan, setReassigningOrphan] = useState<{id: string, data: any} | null>(null);
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [isSavingReassignment, setIsSavingReassignment] = useState(false);
  const [replaceConfirm, setReplaceConfirm] = useState<{ targetId: string, orphanId: string } | null>(null);

  const [partsData, setPartsData] = useState<Record<number, PartData>>({
    0: { speakers: {}, congregations: {}, notes: {}, confirmations: {}, details: { eventDate: '', eventLocation: '', rehearsalDate: '', rehearsalLocation: '', assemblyTheme: assemblyProgram.theme } },
    1: { speakers: {}, congregations: {}, notes: {}, confirmations: {}, details: { eventDate: '', eventLocation: '', rehearsalDate: '', rehearsalLocation: '', assemblyTheme: assemblyProgram.theme } },
    2: { speakers: {}, congregations: {}, notes: {}, confirmations: {}, details: { eventDate: '', eventLocation: '', rehearsalDate: '', rehearsalLocation: '', assemblyTheme: assemblyProgram.theme } },
    3: { speakers: {}, congregations: {}, notes: {}, confirmations: {}, details: { eventDate: '', eventLocation: '', rehearsalDate: '', rehearsalLocation: '', assemblyTheme: assemblyProgram.theme } },
  });

  /**
   * Migra dados legados (por índice ou hash antigo) para os novos IDs estáveis
   */
  const migrateLegacyData = (data: any, currentProgram: any) => {
    if (!currentProgram || !currentProgram.sessions) return data;

    const newPartsData = { ...data };
    
    // Mapear todos os IDs válidos no programa atual para verificação rápida
    const validIds = new Set<string>();
    const currentItemsMap: Record<string, string> = {};
    
    const normalizeText = (text: string) => text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    const normalizeTime = (time: string | null) => {
      if (!time) return '';
      return time.replace(/^0/, '').trim(); // Remove leading zero (09:00 -> 9:00)
    };

    currentProgram.sessions.forEach((s: any) => {
      const periodKey = s.period?.toLowerCase().includes('manhã') ? 'manha' : 'tarde';
      const processItems = (items: any[]) => {
        items.forEach((item: any) => {
          validIds.add(item.id);
          const normTitle = normalizeText(item.title || '');
          const normTime = normalizeTime(item.time);
          
          // Chaves para busca
          const fullKey = `${periodKey}_${normTitle}_${normTime}`;
          const titleKey = `${periodKey}_${normTitle}`;
          
          if (!currentItemsMap[fullKey]) currentItemsMap[fullKey] = item.id;
          if (!currentItemsMap[titleKey]) currentItemsMap[titleKey] = item.id;
          // Fallback sem período
          if (!currentItemsMap[`${normTitle}_${normTime}`]) currentItemsMap[`${normTitle}_${normTime}`] = item.id;

          if (item.subitems) processItems(item.subitems);
        });
      };
      processItems(s.items || []);
    });

    Object.keys(newPartsData).forEach((partIndex: any) => {
      const part = newPartsData[partIndex];
      
      const migratedSpeakers: Record<string, string> = {};
      const migratedCongregations: Record<string, string> = {};
      const migratedNotes: Record<string, string> = {};
      const migratedConfirmations: Record<string, boolean> = {};
      const migratedUserTimes: Record<string, string> = { ...(part.userTimes || {}) };
      const orphanedParts: any = { ...(part.orphanedParts || {}) };

      // Helper para atribuir valor sem sobrescrever um valor válido existente por string vazia
      const assignIfBetter = (targetObj: Record<string, any>, key: string, val: any) => {
        if (val === undefined || val === null) return;
        if (typeof val === 'string') {
          // Se o destino já possui um valor não vazio e o novo valor é vazio, mantém o destino
          if (targetObj[key] && String(targetObj[key]).trim() && !val.trim()) {
            return;
          }
          if (val.trim() || !targetObj[key]) {
            targetObj[key] = val;
          }
        } else if (typeof val === 'boolean') {
          targetObj[key] = val || targetObj[key] || false;
        } else {
          targetObj[key] = val;
        }
      };

      // Identificadores conhecidos para Presidentes de Sessão
      const isMorningPresId = (id: string) => {
        if (!id) return false;
        const norm = String(id).toLowerCase();
        return norm === 'm0' || 
          norm === 'item_abd86e44' || 
          norm === 'item_c4613a76' || 
          norm === 'item_18599ef6' || 
          norm === 'item_41749199' || 
          norm === 'item_20b51eb6' || 
          norm === 'item_0f5fde1b' || 
          norm === 'item_e49082de' || 
          norm === 'item_bd40bb57' ||
          norm === 'item_dac54d50' ||
          norm === '0' || 
          norm === 'item_0' || 
          norm === 'm_item_0' || 
          norm === 'm_item_0_0' ||
          norm.includes('m_item_0') ||
          norm.includes('presidente_manha') ||
          norm.includes('pres_manha') ||
          norm.includes('presidente_m');
      };

      const isAfternoonPresId = (id: string) => {
        if (!id) return false;
        const norm = String(id).toLowerCase();
        return norm === 't0' || 
          norm === 'item_542b6a50' || 
          norm === 'item_581fec36' || 
          norm === 'item_b271d490' || 
          norm === 'item_04066060' || 
          norm === 'item_a8f6be4e' || 
          norm === 't_item_0' || 
          norm === 't_item_0_0' ||
          norm.includes('t_item_0') ||
          norm.includes('presidente_tarde') ||
          norm.includes('pres_tarde') ||
          norm.includes('presidente_t');
      };

      // Se existir o formato antigo de speakers por ID ou índice
      if (part.speakers) {
        // Ordena chaves para priorizar chaves canônicas válidas ('m0', 't0', etc.) antes de aliases legados
        const sortedKeys = Object.keys(part.speakers).sort((a, b) => {
          const aValid = validIds.has(a) ? 1 : 0;
          const bValid = validIds.has(b) ? 1 : 0;
          return bValid - aValid;
        });

        sortedKeys.forEach(oldId => {
          const speaker = part.speakers[oldId];
          const confirmation = part.confirmations?.[oldId] || false;
          const congregation = part.congregations?.[oldId] || '';
          const notes = part.notes?.[oldId] || '';
          const userTime = part.userTimes?.[oldId] || '';

          // 1. Identificar presidentes (retrocompatibilidade e mapeamento canônico estrito)
          if (isMorningPresId(oldId)) {
            assignIfBetter(migratedSpeakers, 'm0', speaker);
            assignIfBetter(migratedConfirmations, 'm0', confirmation);
            assignIfBetter(migratedCongregations, 'm0', congregation);
            assignIfBetter(migratedNotes, 'm0', notes);
            if (userTime) assignIfBetter(migratedUserTimes, 'm0', userTime);
            return;
          }

          if (isAfternoonPresId(oldId)) {
            assignIfBetter(migratedSpeakers, 't0', speaker);
            assignIfBetter(migratedConfirmations, 't0', confirmation);
            assignIfBetter(migratedCongregations, 't0', congregation);
            assignIfBetter(migratedNotes, 't0', notes);
            if (userTime) assignIfBetter(migratedUserTimes, 't0', userTime);
            return;
          }

          // 2. Se o ID já é válido no programa atual, mantemos
          if (validIds.has(oldId)) {
            assignIfBetter(migratedSpeakers, oldId, speaker);
            assignIfBetter(migratedConfirmations, oldId, confirmation);
            assignIfBetter(migratedCongregations, oldId, congregation);
            assignIfBetter(migratedNotes, oldId, notes);
            if (userTime) assignIfBetter(migratedUserTimes, oldId, userTime);
            return;
          }

          // 3. Tentar encontrar por título e tempo (Migração Heurística)
          let foundId = '';
          
          if (!isNaN(Number(oldId)) && Number(oldId) < 100) {
            const allStaticItems: any[] = [];
            staticProgram.sessions.forEach((s: any) => {
              s.items.forEach((i: any) => {
                allStaticItems.push(i);
                if (i.subitems) i.subitems.forEach((si: any) => allStaticItems.push(si));
              });
            });
            const staticItem = allStaticItems.find(i => i.id === oldId || i.id === `m${oldId}` || i.id === `t${oldId}`);
            if (staticItem) {
              const periodKey = staticItem.id.startsWith('m') ? 'manha' : 'tarde';
              const normTitle = normalizeText(staticItem.title || '');
              const normTime = normalizeTime(staticItem.time);
              foundId = currentItemsMap[`${periodKey}_${normTitle}_${normTime}`] || 
                        currentItemsMap[`${periodKey}_${normTitle}`] ||
                        currentItemsMap[`${normTitle}_${normTime}`] || '';
            }
          }

          if (foundId) {
            assignIfBetter(migratedSpeakers, foundId, speaker);
            assignIfBetter(migratedConfirmations, foundId, confirmation);
            assignIfBetter(migratedCongregations, foundId, congregation);
            assignIfBetter(migratedNotes, foundId, notes);
            if (userTime) assignIfBetter(migratedUserTimes, foundId, userTime);
          } else if (speaker && typeof speaker === 'string' && speaker.trim()) {
            // Se não encontrou mas tem um orador, move para órfãos para evitar perda de dados
            if (!orphanedParts[oldId]) {
              orphanedParts[oldId] = {
                speaker,
                congregation,
                notes,
                confirmation,
                userTime,
                originalTitle: 'Item não localizado',
                reason: 'O ID do item mudou ou o item foi removido da programação'
              };
            }
          }
        });
      }

      // 4. Recuperar presidente de sessão caso tenha sido acidentalmente movido para órfãos
      Object.keys(orphanedParts).forEach(orphanKey => {
        const orphan = orphanedParts[orphanKey];
        if (!orphan) return;
        const origTitle = (orphan.originalTitle || '').toLowerCase();
        const isMorningPresOrphan = isMorningPresId(orphanKey) || 
          (origTitle.includes('presidente') && (origTitle.includes('manhã') || origTitle.includes('manha') || orphanKey.startsWith('m')));
        const isAfternoonPresOrphan = isAfternoonPresId(orphanKey) || 
          (origTitle.includes('presidente') && (origTitle.includes('tarde') || orphanKey.startsWith('t')));

        if (isMorningPresOrphan) {
          assignIfBetter(migratedSpeakers, 'm0', orphan.speaker);
          assignIfBetter(migratedConfirmations, 'm0', orphan.confirmation);
          assignIfBetter(migratedCongregations, 'm0', orphan.congregation);
          assignIfBetter(migratedNotes, 'm0', orphan.notes);
          if (orphan.userTime) assignIfBetter(migratedUserTimes, 'm0', orphan.userTime);
          delete orphanedParts[orphanKey];
        } else if (isAfternoonPresOrphan) {
          assignIfBetter(migratedSpeakers, 't0', orphan.speaker);
          assignIfBetter(migratedConfirmations, 't0', orphan.confirmation);
          assignIfBetter(migratedCongregations, 't0', orphan.congregation);
          assignIfBetter(migratedNotes, 't0', orphan.notes);
          if (orphan.userTime) assignIfBetter(migratedUserTimes, 't0', orphan.userTime);
          delete orphanedParts[orphanKey];
        }
      });

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

  // Modo de visualização: 'responsive' (Cards interativos modernos em telas pequenas) ou 'a4' (Folha Oficial impressa em telas grandes)
  const [viewMode, setViewMode] = useState<'responsive' | 'a4'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('progcir_assembly_view_mode') as 'responsive' | 'a4' | null;
      if (saved === 'responsive' || saved === 'a4') return saved;
      return window.innerWidth < 1024 ? 'responsive' : 'a4';
    }
    return 'a4';
  });
  const [activeSessionTab, setActiveSessionTab] = useState<number>(0);

  // Digital A4 Portrait Zoom & Viewport controls (padrão S-303)
  const [autoFit, setAutoFit] = useState(true);
  const [showZoomMenu, setShowZoomMenu] = useState(false);
  const [zoom, setZoom] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const isMobile = window.innerWidth < 1024;
      const approxWidth = isMobile ? window.innerWidth : Math.max(300, window.innerWidth - 280);
      const approxAvailable = Math.max(240, approxWidth - 32);
      return Math.max(35, Math.round((approxAvailable / 793.7) * 100));
    }
    return 85;
  });
  const containerRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  const ZOOM_STEPS = [35, 50, 65, 75, 85, 100, 115, 125, 150, 175, 200];

  const calculateAutoFitZoom = useCallback(() => {
    let containerWidth = containerRef.current?.clientWidth || 0;
    if (!containerWidth && typeof window !== 'undefined') {
      const isMobile = window.innerWidth < 1024;
      containerWidth = isMobile ? window.innerWidth : Math.max(300, window.innerWidth - 280);
    }
    const availableWidth = Math.max(240, containerWidth - 32);
    const a4WidthPx = 793.7;
    const calculated = Math.round((availableWidth / a4WidthPx) * 100);
    return Math.max(35, calculated);
  }, []);

  const handleZoomIn = () => {
    setAutoFit(false);
    setZoom(prev => {
      const next = ZOOM_STEPS.find(s => s > prev + 4);
      return next ? next : Math.min(200, prev + 15);
    });
    setShowZoomMenu(false);
  };

  const handleZoomOut = () => {
    setAutoFit(false);
    setZoom(prev => {
      const prevStep = [...ZOOM_STEPS].reverse().find(s => s < prev - 4);
      return prevStep ? prevStep : Math.max(35, prev - 15);
    });
    setShowZoomMenu(false);
  };

  const handleSetZoom = (newZoom: number) => {
    setAutoFit(false);
    setZoom(newZoom);
    setShowZoomMenu(false);
  };

  const handleToggleAutoFit = () => {
    if (autoFit) {
      setAutoFit(false);
      setZoom(100);
    } else {
      setAutoFit(true);
      const fitZoom = calculateAutoFitZoom();
      setZoom(fitZoom);
    }
    setShowZoomMenu(false);
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('circuit_assembly_a4_zoom', zoom.toString());
    }
  }, [zoom]);

  // Observer de auto-ajuste ao redimensionar a tela
  useEffect(() => {
    const handleResize = () => {
      if (!containerRef.current) return;
      if (autoFit && viewMode === 'a4') {
        const fitZoom = calculateAutoFitZoom();
        setZoom(fitZoom);
      }
    };

    const observer = new ResizeObserver(handleResize);
    if (containerRef.current) observer.observe(containerRef.current);
    window.addEventListener('resize', handleResize);
    handleResize();

    handleResize();
    const rafId = requestAnimationFrame(handleResize);
    const timer50 = setTimeout(handleResize, 50);
    const timer150 = setTimeout(handleResize, 150);
    const timer300 = setTimeout(handleResize, 300);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(rafId);
      clearTimeout(timer50);
      clearTimeout(timer150);
      clearTimeout(timer300);
    };
  }, [autoFit, viewMode, calculateAutoFitZoom]);

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

  // Estatísticas de progresso para a visão responsiva
  const stats = useMemo(() => {
    let totalWithSpeaker = 0;
    let assignedCount = 0;
    let confirmedCount = 0;

    assemblyProgram.sessions.forEach((session: any) => {
      session.items.forEach((item: any) => {
        const isSymposium = item.subitems && item.subitems.length > 0;
        if (isSymposium) {
          item.subitems.forEach((sub: any) => {
            totalWithSpeaker++;
            if (speakers[sub.id]?.trim()) {
              assignedCount++;
              if (confirmedSpeakers[sub.id]) confirmedCount++;
            }
          });
        } else {
          const itemTitleNorm = (item.title || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          const isPrayer = itemTitleNorm.includes('oracao') || itemTitleNorm.includes('prayer');
          const isRole = item.isRole || itemTitleNorm.includes('presidente') || item.id === 'm0' || item.id === 't0';
          const hasSpeaker = !item.noSpeaker || isPrayer || isRole;

          if (hasSpeaker) {
            totalWithSpeaker++;
            if (speakers[item.id]?.trim()) {
              assignedCount++;
              if (confirmedSpeakers[item.id]) confirmedCount++;
            }
          }
        }
      });
    });

    return {
      totalWithSpeaker,
      assignedCount,
      confirmedCount,
      pendingConfirmation: Math.max(0, assignedCount - confirmedCount),
      percentageAssigned: totalWithSpeaker > 0 ? Math.round((assignedCount / totalWithSpeaker) * 100) : 0,
      percentageConfirmed: totalWithSpeaker > 0 ? Math.round((confirmedCount / totalWithSpeaker) * 100) : 0,
    };
  }, [assemblyProgram, speakers, confirmedSpeakers]);

  const collectionName = type === 'supt' ? 'circuit_assembly_supt_speakers' : 'circuit_assembly_branch_speakers';

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
          if (currentResult.data) {
            setDynamicProgram(currentResult.data);
            setPartsData(prev => {
              const migrated = migrateLegacyData(prev, currentResult.data);
              const updatedParts: Record<number, PartData> = { ...migrated };
              [0, 1, 2, 3].forEach(partIdx => {
                if (updatedParts[partIdx]) {
                  const currentTheme = updatedParts[partIdx].details?.assemblyTheme;
                  // Se o tema estiver vazio ou for igual ao tema estático anterior, atualiza para o novo tema sincronizado
                  if (!currentTheme || currentTheme === staticProgram.theme || currentTheme === assemblyProgram.theme) {
                    updatedParts[partIdx] = {
                      ...updatedParts[partIdx],
                      details: {
                        ...updatedParts[partIdx].details,
                        assemblyTheme: currentResult.data.theme || currentTheme
                      }
                    };
                  }
                }
              });
              return updatedParts;
            });
          }

          if (currentResult.status === 'UPDATE_AVAILABLE') {
            await showAlert(`✓ Programação ${selectedYear} atualizada com sucesso com dados oficiais do jw.org (título, tema, imagem e partes).`, 'Sincronização');
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
        let currentDynamicProgram = null;
        if (programSnap.exists()) {
          currentDynamicProgram = programSnap.data();
          setDynamicProgram(currentDynamicProgram);
        } else {
          setDynamicProgram(null); // Fallback to static
        }

        // Calcular a programação efetiva (normalizada) para usar na migração IMEDIATAMENTE
        const baseProgram = currentDynamicProgram 
          ? { ...staticProgram, ...currentDynamicProgram } 
          : staticProgram;
        const normalizedProgram = normalizeProgram(baseProgram);

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

        const defaultData: Record<number, PartData> = {
          0: { speakers: {}, congregations: {}, notes: {}, confirmations: {}, details: { eventDate: '', eventLocation: '', rehearsalDate: '', rehearsalLocation: '', assemblyTheme: assemblyProgram.theme } },
          1: { speakers: {}, congregations: {}, notes: {}, confirmations: {}, details: { eventDate: '', eventLocation: '', rehearsalDate: '', rehearsalLocation: '', assemblyTheme: assemblyProgram.theme } },
          2: { speakers: {}, congregations: {}, notes: {}, confirmations: {}, details: { eventDate: '', eventLocation: '', rehearsalDate: '', rehearsalLocation: '', assemblyTheme: assemblyProgram.theme } },
          3: { speakers: {}, congregations: {}, notes: {}, confirmations: {}, details: { eventDate: '', eventLocation: '', rehearsalDate: '', rehearsalLocation: '', assemblyTheme: assemblyProgram.theme } },
        };

        // Try to load year-specific data
        const docId = selectedYear === '2026-2027' ? userId : `${userId}_${selectedYear}`;
        let docRef = doc(db, collectionName, docId);
        let docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.parts) {
            const migrated = migrateLegacyData(data.parts, normalizedProgram);
            
            // Garantir que todas as partes (0-3) existam após a migração
            const fullData: Record<number, PartData> = { ...defaultData };
            Object.keys(migrated).forEach(k => {
              const idx = parseInt(k, 10);
              if (!isNaN(idx)) {
                fullData[idx] = {
                  ...fullData[idx],
                  ...migrated[idx],
                  // Garantir que sub-objetos existam
                  speakers: migrated[idx].speakers || {},
                  congregations: migrated[idx].congregations || {},
                  notes: migrated[idx].notes || {},
                  confirmations: migrated[idx].confirmations || {},
                  details: {
                    ...fullData[idx].details,
                    ...(migrated[idx].details || {})
                  }
                };
              }
            });
            
            setPartsData(fullData);
            setInitialPartsData(JSON.stringify(fullData));
          } else {
            // Migration from old format
            const rawParts = {
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
                  assemblyTheme: data.details?.assemblyTheme || assemblyProgram.theme,
                }
              },
              1: { speakers: {}, congregations: {}, notes: {}, confirmations: {}, details: { eventDate: '', eventLocation: '', rehearsalDate: '', rehearsalLocation: '', assemblyTheme: assemblyProgram.theme } },
              2: { speakers: {}, congregations: {}, notes: {}, confirmations: {}, details: { eventDate: '', eventLocation: '', rehearsalDate: '', rehearsalLocation: '', assemblyTheme: assemblyProgram.theme } },
              3: { speakers: {}, congregations: {}, notes: {}, confirmations: {}, details: { eventDate: '', eventLocation: '', rehearsalDate: '', rehearsalLocation: '', assemblyTheme: assemblyProgram.theme } },
            };
            const migratedData = migrateLegacyData(rawParts, normalizedProgram);
            setPartsData(migratedData);
            setInitialPartsData(JSON.stringify(migratedData));
          }
        } else {
          // Reset data for new year or missing doc
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
      const cleanParts = JSON.parse(JSON.stringify(partsData));

      // Limpar chaves legadas obsoletas de presidentes para manter banco de dados consistente
      const obsoleteKeys = [
        'item_abd86e44', 'item_c4613a76', 'item_18599ef6', 'item_41749199', 
        'item_20b51eb6', 'item_0f5fde1b', 'item_e49082de', 'item_bd40bb57', 
        'item_dac54d50', 'item_542b6a50', 'item_581fec36', 'item_b271d490', 
        'item_04066060', 'item_a8f6be4e', '0', 'item_0'
      ];

      Object.keys(cleanParts).forEach(pIdx => {
        const p = cleanParts[pIdx];
        if (p) {
          obsoleteKeys.forEach(obKey => {
            if (p.speakers) delete p.speakers[obKey];
            if (p.congregations) delete p.congregations[obKey];
            if (p.notes) delete p.notes[obKey];
            if (p.confirmations) delete p.confirmations[obKey];
            if (p.userTimes) delete p.userTimes[obKey];
            if (p.orphanedParts) delete p.orphanedParts[obKey];
          });
        }
      });

      await setDoc(docRef, { 
        parts: cleanParts,
        updatedAt: new Date().toISOString(),
        year: selectedYear
      }, { merge: true });
      setInitialPartsData(JSON.stringify(cleanParts));
      if (showNotification) {
        await showAlert('Alterações salvas com sucesso!', 'Sucesso');
      }
      return true;
    } catch (error) {
      console.error('Error saving data:', error);
      if (showNotification) {
        await showAlert(`Não foi possível salvar as alterações: ${error instanceof Error ? error.message : String(error)}`, 'Erro');
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

  const generateDocument = async (item: any, format: 'docx' | 'pdf') => {
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
          const subTarget = pItem.subitems.find((si: any) => si.id === item.id);
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

    const titleNorm = (item.title || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const isPrayer = titleNorm.includes('oracao') || titleNorm.includes('prayer');
    const isPresident = item.isRole || titleNorm.includes('presidente') || item.id === 'm0' || item.id === 't0';

    if (isPrayer) {
      templateId = 'ass_convite_oracao';
      // Identify which prayer it is based on all items in the program
      const allItems: any[] = [];
      assemblyProgram.sessions.forEach((s: any) => {
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
    } else if (isPresident) {
      templateId = 'ass_convite_presidente';
      if (item.id === 'm0') {
        designation = 'PRESIDENTE DE SESSÃO MANHÃ';
      } else if (item.id === 't0') {
        designation = 'PRESIDENTE DE SESSÃO TARDE';
      } else {
        const isMorning = assemblyProgram.sessions[0]?.items?.some((i: any) => i.id === item.id);
        designation = isMorning ? 'PRESIDENTE DE SESSÃO MANHÃ' : 'PRESIDENTE DE SESSÃO TARDE';
      }
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
          xmlContent = xmlContent.replace(/(@|\[[#\/^>?]?)([A-Za-z0-9À-ÿ\u00C0-\u00FF\_]*)(<\/w:t>(?:<(?!w:p|w:tr|w:tbl|w:br|w:tc|w:tr)[^>]+>)*?<w:t[^>]*>)([A-Za-z0-9À-ÿ\u00C0-\u00FF\_]+|\])/g, "$1$2$4$3");
        }
        
        xmlContent = xmlContent.replace(/(@[A-Za-z0-9À-ÿ\_]*)(<\/w:t><\/w:r><w:r><w:t>)/g, "$1");

        xmlContent = xmlContent.replace(/(<w:t[^>]*>)(.*?)(<\/w:t>)/g, (match, opening, text, closing) => {
          let newText = text;
          // Handle [ASSINATURA] and @Assinatura specially as an image tag
          newText = newText.replace(/\[ASSINATURA([\s\_]GLOBAL)?\]/gi, '[%ASSINATURA]');
          newText = newText.replace(/@Assinatura([\s\_]GLOBAL)?/gi, '[%ASSINATURA]');
          newText = newText.replace(/@Signature([\s\_]GLOBAL)?/gi, '[%ASSINATURA]');
          newText = newText.replace(/@AssinaturaGlobal/gi, '[%ASSINATURA]');
          newText = newText.replace(/@Assinatura_Global/gi, '[%ASSINATURA]');
          
          // Generic @TAG replacement
          newText = newText.replace(/(^|[^A-Za-z0-9À-ÿ\u00C0-\u00FF])@([A-Za-z0-9À-ÿ\_]+)/g, (m: string, p1: string, p2: string) => {
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
        'DIA': type === 'supt' ? 'Assembleia CAco' : 'Assembleia CAbr',
        'ASSISTENTE': details.assemblyAssistant || '________________',
        'ASSINATURA': `${personalData?.nome || '________________'} (${personalData?.circuito || '________________'})`,
        'ASSINATURA_GLOBAL': `${personalData?.nome || '________________'} (${personalData?.circuito || '________________'})`,
        'ASSINATURA GLOBAL': `${personalData?.nome || '________________'} (${personalData?.circuito || '________________'})`,
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
      // Calculate sequential index
      let allItems: any[] = [];
      assemblyProgram.sessions.forEach((s: any) => {
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

      let eventPrefix = 'CA';
      if (assemblyProgram.title.includes('Superintendente')) {
        eventPrefix = 'CAco';
      } else if (assemblyProgram.title.includes('Representante')) {
        eventPrefix = 'CArb';
      }
      const eventYear = assemblyProgram.year || new Date().getFullYear().toString();
      const safeSpeaker = speakerName.trim().replace(/\s+/g, '_');
      link.download = `${indexStr}_${eventPrefix}_(${eventYear})_${safeSpeaker}.docx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Error generating document:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const generateAnciaosLetter = async () => {
    const templateId = 'ass_carta_anciaos';
    const template = templates[templateId] || templates[`${userId}_${templateId}`];
    
    if (!template) {
      await showAlert(`Template de Carta aos Anciãos ("${templateId}") não encontrado. Por favor, carregue-o em Cartas > Gerenciar.`, 'Aviso');
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
          xmlContent = xmlContent.replace(/(@|\[[#\/^>?]?)([A-Za-z0-9À-ÿ\u00C0-\u00FF\_]*)(<\/w:t>(?:<(?!w:p|w:tr|w:tbl|w:br|w:tc|w:tr)[^>]+>)*?<w:t[^>]*>)([A-Za-z0-9À-ÿ\u00C0-\u00FF\_]+|\])/g, "$1$2$4$3");
        }
        
        xmlContent = xmlContent.replace(/(@[A-Za-z0-9À-ÿ\_]*)(<\/w:t><\/w:r><w:r><w:t>)/g, "$1");

        xmlContent = xmlContent.replace(/(<w:t[^>]*>)(.*?)(<\/w:t>)/g, (match, opening, text, closing) => {
          let newText = text;
          newText = newText.replace(/\[ASSINATURA([\s\_]GLOBAL)?\]/gi, '[%ASSINATURA]');
          newText = newText.replace(/@Assinatura([\s\_]GLOBAL)?/gi, '[%ASSINATURA]');
          newText = newText.replace(/(^|[^A-Za-z0-9À-ÿ\u00C0-\u00FF])@([A-Za-z0-9À-ÿ\_]+)/g, (m: string, p1: string, p2: string) => {
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
      const now = new Date();
      const hoje = new Intl.DateTimeFormat('pt-BR', { 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric' 
      }).format(now);

      const replacements = {
        'EVENTO': assemblyProgram.title,
        'TEMA': themeValue,
        'DATA': details.eventDate || '________________',
        'LOCAL': details.eventLocation || '________________',
        'DATA_EVENTO': details.eventDate || '________________',
        'LOCAL_EVENTO': details.eventLocation || '________________',
        'HOJE': hoje,
        'data': hoje,
        'DATA_ATUAL': hoje,
        'ASSINATURA': `${personalData?.nome || '________________'} (${personalData?.circuito || '________________'})`,
        'ASSINATURA_GLOBAL': `${personalData?.nome || '________________'} (${personalData?.circuito || '________________'})`,
        'ASSINATURA GLOBAL': `${personalData?.nome || '________________'} (${personalData?.circuito || '________________'})`,
        '%ASSINATURA': signatureImage,
        'VIAJANTE': personalData?.nome || '________________',
        'NOME': personalData?.nome || '________________',
        'CIRCUITO': personalData?.circuito || '________________',
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
      const eventYear = assemblyProgram.year || new Date().getFullYear().toString();
      const partLetter = ['A', 'B', 'C', 'D'][selectedPart] || 'A';
      link.download = `Carta_Anciaos_${type === 'supt' ? 'CAco' : 'CAbr'}_${eventYear}_Parte_${partLetter}.docx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Error generating anciaos letter:', err);
      await showAlert('Erro ao gerar carta aos anciãos.', 'Erro');
    } finally {
      setIsSaving(false);
    }
  };

  const generateAssistantDocument = async (assistantName: string, assistantCong?: string) => {
    if (!assistantName || !assistantName.trim()) {
      await showAlert('Por favor, informe o nome do assistente.', 'Aviso');
      return;
    }

    const trimmedName = assistantName.trim();
    const assistantDisplayName = assistantCong && assistantCong.trim() 
      ? `${trimmedName} - ${assistantCong.trim()}` 
      : trimmedName;

    // Procura por ass_convite_assistente ou templates legados/globais
    const templateId = 'ass_convite_assistente';
    const template = templates[templateId] || templates[`${userId}_${templateId}`] || templates['ass_carta_oradores'] || templates[`${userId}_ass_carta_oradores`];
    
    if (!template) {
      await showAlert(`Template de convite para assistentes ("${templateId}") não encontrado. Por favor, carregue-o em Cartas > Gerenciar.`, 'Aviso');
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
          xmlContent = xmlContent.replace(/(@|\[[#\/^>?]?)([A-Za-z0-9À-ÿ\u00C0-\u00FF\_]*)(<\/w:t>(?:<(?!w:p|w:tr|w:tbl|w:br|w:tc|w:tr)[^>]+>)*?<w:t[^>]*>)([A-Za-z0-9À-ÿ\u00C0-\u00FF\_]+|\])/g, "$1$2$4$3");
        }
        
        xmlContent = xmlContent.replace(/(@[A-Za-z0-9À-ÿ\_]*)(<\/w:t><\/w:r><w:r><w:t>)/g, "$1");

        xmlContent = xmlContent.replace(/(<w:t[^>]*>)(.*?)(<\/w:t>)/g, (match, opening, text, closing) => {
          let newText = text;
          newText = newText.replace(/\[ASSINATURA([\s\_]GLOBAL)?\]/gi, '[%ASSINATURA]');
          newText = newText.replace(/@Assinatura([\s\_]GLOBAL)?/gi, '[%ASSINATURA]');
          newText = newText.replace(/@Signature([\s\_]GLOBAL)?/gi, '[%ASSINATURA]');
          newText = newText.replace(/@AssinaturaGlobal/gi, '[%ASSINATURA]');
          newText = newText.replace(/@Assinatura_Global/gi, '[%ASSINATURA]');
          
          newText = newText.replace(/(^|[^A-Za-z0-9À-ÿ\u00C0-\u00FF])@([A-Za-z0-9À-ÿ\_]+)/g, (m: string, p1: string, p2: string) => {
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
      const designation = 'ASSISTENTE DA ASSEMBLEIA';

      const replacements = {
        'EVENTO': assemblyProgram.title,
        'TEMA': themeValue,
        'DATA': details.eventDate || '________________',
        'LOCAL': details.eventLocation || '________________',
        'DATA_EVENTO': details.eventDate || '________________',
        'LOCAL_EVENTO': details.eventLocation || '________________',
        'ORADOR': assistantDisplayName,
        'orador': assistantDisplayName,
        'NOME_ORADOR': trimmedName,
        'DESIGNADO': assistantDisplayName,
        'NOME_DESIGNADO': trimmedName,
        'ASSISTENTE': trimmedName,
        'D_ENSAIO': details.rehearsalDate || '________________',
        'L_ENSAIO': details.rehearsalLocation || '________________',
        'DATA_ENSAIO': details.rehearsalDate || '________________',
        'LOCAL_ENSAIO': details.rehearsalLocation || '________________',
        'DATAHORA': details.rehearsalDate || '________________',
        'LOCALTREINO': details.rehearsalLocation || '________________',
        'HORA': '',
        'N': '',
        'TITULO': designation,
        'DESIGNAÇÃO': designation,
        'DESIGNACAO': designation,
        'DIA': type === 'supt' ? 'Assembleia com o Superintendente de Circuito' : 'Assembleia com o Representante de Betel',
        'ANO': '2026',
        'ASSINATURA': `${personalData?.nome || '________________'} (${personalData?.circuito || '________________'})`,
        'ASSINATURA_GLOBAL': `${personalData?.nome || '________________'} (${personalData?.circuito || '________________'})`,
        'ASSINATURA GLOBAL': `${personalData?.nome || '________________'} (${personalData?.circuito || '________________'})`,
        '%ASSINATURA': signatureImage,
        'VIAJANTE': personalData?.nome || '________________',
        'NOME': personalData?.nome || '________________',
        'CIRCUITO': personalData?.circuito || '________________',
        'CONGREGACAO': assistantCong || '________________',
        'NOTAS': '',
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
      link.download = `Convite_Assistente_${trimmedName.replace(/\s+/g, '_')}.docx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Error generating assistant document:', err);
      await showAlert('Erro ao gerar convite do assistente.', 'Erro');
    } finally {
      setIsSaving(false);
    }
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
    <div id="circuit-assembly-print-content" className="space-y-6 pb-16 print:p-0 print:m-0 print:space-y-0 w-full max-w-full min-w-0 overflow-x-hidden">
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
          
          #circuit-assembly-print-content,
          #circuit-assembly-print-content * { 
            visibility: visible !important; 
          }
          
          #circuit-assembly-print-content {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 210mm !important;
            max-width: 210mm !important;
            margin: 0 !important;
            padding: 0 !important;
            display: block !important;
          }
          
          .circuit-assembly-viewport,
          .circuit-assembly-session-wrapper,
          .circuit-assembly-scale-wrapper {
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

          .circuit-assembly-a4-page { 
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

          .circuit-assembly-session-wrapper:last-child .circuit-assembly-a4-page,
          .circuit-assembly-a4-page:last-child,
          .circuit-assembly-a4-page:last-of-type {
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
          .circuit-assembly-a4-page .session-items-container > * + * {
            margin-top: 5px !important;
          }

          .circuit-assembly-a4-page .speaker-grid {
            display: grid !important;
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 6px !important;
            margin-top: 4px !important;
          }

          .circuit-assembly-a4-page input {
            border: none !important;
            background: transparent !important;
            padding: 0 !important;
            margin: 0 !important;
            color: #111827 !important;
            max-width: 100% !important;
            line-height: 1.25 !important;
            height: auto !important;
          }
          .circuit-assembly-a4-page input::placeholder {
            color: transparent !important;
          }
        }
      `}</style>

      {/* Screen Header & Top Controls (no-print) */}
      <div className="space-y-3 no-print w-full max-w-full min-w-0">
        {/* Top bar: Back, Title & Action Bar */}
        <div className="flex items-center justify-between gap-2 sm:gap-4 flex-wrap bg-surface-100 p-3 sm:p-4 rounded-3xl border border-surface-300 shadow-xs relative overflow-hidden w-full max-w-full min-w-0">
          <div 
            className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r opacity-90"
            style={{ 
              backgroundImage: `linear-gradient(to right, ${type === 'supt' ? '#F59E0B' : '#F43F5E'}, transparent)` 
            }} 
          />
          {/* Back button & Title hierarchy */}
          <div className="flex items-center gap-2.5 min-w-0">
            <button 
              onClick={handleBackClick} 
              className="h-9 w-9 sm:h-10 sm:w-10 p-1.5 sm:p-2 hover:bg-surface-200 active:scale-95 rounded-xl transition-all text-typography-900 bg-surface-200/80 shadow-xs border border-surface-300 flex items-center justify-center shrink-0 cursor-pointer"
              title="Voltar"
              aria-label="Voltar para eventos"
            >
              <ChevronLeft size={20} strokeWidth={2.5} />
            </button>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h1 className="text-base sm:text-xl font-black text-typography-900 tracking-tight leading-none truncate">
                  <span className="hidden xs:inline">PROGRAMAÇÃO DA ASSEMBLEIA</span>
                  <span className="xs:hidden">PROGRAMAÇÃO</span>
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider bg-primary-200/10 text-primary-200 border border-primary-200/20">
                  {type === 'supt' ? 'CAco' : 'CAbr'}
                </span>
              </div>
              <p className="text-[11px] sm:text-xs font-medium text-typography-500 truncate hidden sm:block">
                {type === 'supt' ? 'Com o Superintendente de Circuito' : 'Com o Representante de Betel'}
              </p>
            </div>
          </div>

          {/* Action Bar (Barra de Ações) */}
          <div className="flex items-center gap-1.5 sm:gap-2 ml-auto flex-wrap">
            <button 
              onClick={() => setShowEditDetailsModal(true)}
              className="h-9 sm:h-10 px-2.5 sm:px-3 rounded-xl text-xs font-bold text-amber-700 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 shadow-xs flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] cursor-pointer"
              title="Editar dados da assembleia (data, local, ensaio, assistentes)"
            >
              <CalendarDays size={15} className="shrink-0 text-amber-600" />
              <span className="hidden md:inline">Dados do Evento</span>
            </button>

            <button 
              onClick={() => setShowEditDetailsModal(true)}
              className="h-9 sm:h-10 px-2.5 sm:px-3 rounded-xl text-xs font-bold text-indigo-700 dark:text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 shadow-xs flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] cursor-pointer"
              title="Gerenciar assistentes da assembleia e gerar convites (.docx)"
            >
              <UserCheck size={15} className="shrink-0 text-indigo-600" />
              <span className="hidden md:inline">Assistentes</span>
            </button>

            <button 
              onClick={handleSync} 
              disabled={isSyncing}
              className="h-9 sm:h-10 px-2.5 sm:px-3 rounded-xl text-xs font-bold text-violet-700 dark:text-violet-400 bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/20 shadow-xs flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              title="Atualizar programação da temporada selecionada"
            >
              <RefreshCw size={15} className={`shrink-0 ${isSyncing ? 'animate-spin' : ''}`} />
              <span className="hidden md:inline">{isSyncing ? 'Atualizando...' : 'Atualizar'}</span>
            </button>
            
            <button 
              onClick={handleCheckNextSeason} 
              disabled={isCheckingNext}
              className="h-9 sm:h-10 px-2.5 sm:px-3 rounded-xl text-xs font-bold text-blue-700 dark:text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 shadow-xs flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              title="Verificar se uma nova temporada foi publicada no JW.org"
            >
              {isCheckingNext ? <Loader2 size={15} className="animate-spin shrink-0" /> : <Search size={15} className="shrink-0" />}
              <span className="hidden lg:inline">{isCheckingNext ? 'Verificando...' : 'Verificar próxima'}</span>
              <span className="hidden md:inline lg:hidden">{isCheckingNext ? '...' : 'Próxima'}</span>
            </button>

            <button 
              onClick={generateAnciaosLetter}
              className="h-9 sm:h-10 px-2.5 sm:px-3 rounded-xl text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 shadow-xs flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] cursor-pointer"
              title="Gerar Carta aos Anciãos para esta assembleia (.docx)"
            >
              <Mail size={15} className="shrink-0 text-emerald-600" />
              <span className="hidden md:inline">Carta Anciãos</span>
            </button>

            <button 
              onClick={() => window.print()} 
              className="h-9 sm:h-10 px-2.5 sm:px-3 rounded-xl text-xs font-bold text-typography-700 bg-surface-200/80 hover:bg-surface-200 border border-surface-300 shadow-xs flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] cursor-pointer"
              title="Imprimir folha A4 em modo Retrato"
            >
              <Printer size={15} className="shrink-0 text-typography-500" />
              <span className="hidden md:inline">Imprimir A4</span>
            </button>
          </div>
        </div>

        {/* Compact Navigation Bar: Season Dropdown, Mode Switch & Parts Selector */}
        <div className="flex items-center justify-between gap-2 p-1.5 bg-surface-100 rounded-2xl border border-surface-300 flex-wrap shadow-2xs">
          {/* Seletor de Temporada */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[11px] font-bold text-typography-500 uppercase tracking-wider pl-1 hidden xs:inline">
              Temporada:
            </span>
            <CustomSelect
              value={selectedYear}
              onChange={handleYearChange}
              options={availableYears}
            />
          </div>

          {/* Toggle de Modo: Tabela vs Lista */}
          <div className="flex items-center bg-surface-200/80 p-0.5 rounded-xl border border-surface-300 shadow-2xs">
            <button
              onClick={() => setViewMode('a4')}
              className={`h-8 sm:h-9 px-3 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'a4'
                  ? 'bg-primary-200 text-white shadow-xs'
                  : 'text-typography-600 hover:text-typography-900'
              }`}
              title="Modo Tabela"
            >
              <TableIcon size={14} />
              <span>Tabela</span>
            </button>
            <button
              onClick={() => setViewMode('responsive')}
              className={`h-8 sm:h-9 px-3 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'responsive'
                  ? 'bg-primary-200 text-white shadow-xs'
                  : 'text-typography-600 hover:text-typography-900'
              }`}
              title="Modo Lista"
            >
              <LayoutList size={14} />
              <span>Lista</span>
            </button>
          </div>

          {/* Seletor de Partes (A, B, C, D) */}
          <div className="flex items-center gap-1 bg-surface-200/80 p-0.5 rounded-xl border border-surface-300 shadow-2xs shrink-0">
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
                      : 'text-typography-600 hover:text-typography-900 font-medium'
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

      </div>

      {/* MODO DE VISUALIZAÇÃO RESPONSIVO (CARDS MODERNOS SEM SCROLL LATERAL) */}
      {viewMode === 'responsive' && (
        <div className="no-print space-y-6">
          {/* Hero Card com Tema e Metadados do Evento */}
          <div className="relative rounded-3xl overflow-hidden bg-surface-100 border border-surface-300 shadow-xs p-5 sm:p-7 space-y-5">
            {/* Background Image Artwork com Overlay Suave */}
            {(details.customHeaderImage || assemblyProgram.headerImage) && (
              <div className="absolute inset-0 z-0 pointer-events-none opacity-20 dark:opacity-25 overflow-hidden">
                <Image
                  src={details.customHeaderImage || assemblyProgram.headerImage}
                  alt="Tema da Assembleia"
                  fill
                  sizes="100vw"
                  className="object-cover object-center filter blur-xs"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-surface-100 via-surface-100/90 to-surface-100/60" />
              </div>
            )}

            <div className="relative z-10 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-primary-200/10 text-primary-200 border border-primary-200/20">
                    Assembleia de Circuito • {selectedYear}
                  </span>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-surface-200 text-typography-600 border border-surface-300">
                    Parte {['A', 'B', 'C', 'D'][selectedPart]}
                  </span>
                </div>

                <button
                  onClick={() => setShowEditDetailsModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-surface-200 hover:bg-surface-300 text-typography-700 transition-colors border border-surface-300/80 cursor-pointer"
                >
                  <Edit3 size={13} />
                  <span>Editar Informações</span>
                </button>
              </div>

              {/* Tema Principal */}
              <div className="space-y-1">
                <h2 className="text-lg sm:text-2xl font-black text-typography-900 tracking-tight leading-tight">
                  {details.assemblyTheme || assemblyProgram.theme}
                </h2>
                <p className="text-xs sm:text-sm text-typography-500 font-medium">
                  {assemblyProgram.title}
                </p>
              </div>

              {/* Metadados: Data, Local, Ensaio */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-surface-300/70">
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
                    <span className="block text-[10px] uppercase font-bold text-typography-400">Ensaio</span>
                    <span className="font-bold text-typography-900 truncate block">
                      {details.rehearsalDate || 'A definir'}
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

          {/* Abas de Navegação entre Sessões */}
          <div className="flex items-center gap-2 p-1.5 bg-surface-100 rounded-2xl border border-surface-300 overflow-x-auto">
            {assemblyProgram.sessions.map((session: any, sIdx: number) => {
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

          {/* Lista de Partes por Sessão */}
          <div className="space-y-6">
            {assemblyProgram.sessions
              .filter((_: any, idx: number) => activeSessionTab === -1 || activeSessionTab === idx)
              .map((session: any, sIdx: number) => (
                <div key={`resp-session-${session.period || sIdx}`} className="space-y-3">
                  <div className="flex items-center gap-2 px-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-primary-200" />
                    <h3 className="text-sm font-black text-typography-900 uppercase tracking-wider">
                      Sessão da {session.period}
                    </h3>
                  </div>

                  <div className="space-y-2.5">
                    {session.items.map((item: any, itemIdx: number) => {
                      const isSymposium = item.subitems && item.subitems.length > 0;
                      const itemTitleNorm = (item.title || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                      const isPrayer = itemTitleNorm.includes('oracao') || itemTitleNorm.includes('prayer');
                      const isRole = item.isRole || itemTitleNorm.includes('presidente') || item.id === 'm0' || item.id === 't0';
                      const hasSpeaker = !item.noSpeaker || isPrayer || isRole;

                      {/* Simpósio / Série de Discursos */}
                      if (isSymposium) {
                        return (
                          <div
                            key={`resp-item-${item.id || itemIdx}`}
                            className="p-4 rounded-3xl bg-surface-100 border-2 border-amber-500/20 shadow-2xs space-y-3.5"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-600 border border-amber-500/20">
                                    {item.label || 'SÉRIE DE DISCURSOS'}
                                  </span>
                                  {item.time && (
                                    <span className="text-xs font-black text-typography-500">
                                      {item.time}
                                    </span>
                                  )}
                                </div>
                                <h4 className="text-sm sm:text-base font-black text-typography-900 leading-tight">
                                  {item.title}
                                </h4>
                              </div>
                            </div>

                            {/* Subpartes do Simpósio */}
                            <div className="space-y-2.5 pt-1">
                              {item.subitems.map((sub: any, subIdx: number) => {
                                const subSpeaker = speakers[sub.id] || '';
                                const subCong = congregations[sub.id] || '';
                                const isConfirmed = !!confirmedSpeakers[sub.id];

                                return (
                                  <div
                                    key={`resp-sub-${sub.id || subIdx}`}
                                    className="p-3.5 rounded-2xl bg-surface-200/50 border border-surface-300 space-y-3"
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="flex items-start gap-2 min-w-0">
                                        <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-700 text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">
                                          {subIdx + 1}
                                        </span>
                                        <div className="min-w-0">
                                          <h5 className="text-xs sm:text-sm font-bold text-typography-900 leading-tight">
                                            {sub.title}
                                          </h5>
                                          {sub.time ? (
                                            <span className="text-[10px] font-bold text-amber-600 mt-0.5 block">
                                              {sub.time}
                                            </span>
                                          ) : (
                                            <div className="flex items-center gap-1.5 mt-1">
                                              <span className="text-[10px] text-typography-400">Horário:</span>
                                              <input
                                                type="text"
                                                placeholder="--:--"
                                                value={currentPart.userTimes?.[sub.id] || ''}
                                                onChange={e => handleUserTimeChange(sub.id, e.target.value)}
                                                className="w-12 text-xs font-bold text-amber-600 bg-surface-100 border border-surface-300 rounded px-1 text-center"
                                              />
                                            </div>
                                          )}
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-1 shrink-0">
                                        <button
                                          onClick={() => handleConfirmationToggle(sub.id)}
                                          className={`px-2.5 py-1 rounded-xl text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                                            isConfirmed
                                              ? 'bg-emerald-500 text-white shadow-xs'
                                              : 'bg-surface-200 text-typography-500 hover:text-typography-900 border border-surface-300'
                                          }`}
                                          title={isConfirmed ? 'Confirmado' : 'Marcar como confirmado'}
                                        >
                                          <CheckCircle2 size={13} />
                                          <span className="hidden xs:inline">{isConfirmed ? 'Confirmado' : 'Pendente'}</span>
                                        </button>

                                        <button
                                          onClick={() => generateDocument({ ...sub, time: sub.time || currentPart.userTimes?.[sub.id] || '', title: `${item.title}: ${sub.title}` }, 'docx')}
                                          className="p-1.5 rounded-xl bg-amber-500/10 text-amber-600 hover:bg-amber-500 hover:text-white border border-amber-500/20 transition-all cursor-pointer"
                                          title="Gerar Carta de Designação (.docx)"
                                        >
                                          <FileText size={15} />
                                        </button>
                                      </div>
                                    </div>

                                    {/* Inputs de Orador e Congregação */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                      <div className="relative">
                                        <input
                                          type="text"
                                          placeholder="Nome do orador..."
                                          value={subSpeaker}
                                          onChange={e => handleSpeakerChange(sub.id, e.target.value)}
                                          className="w-full text-xs font-bold text-typography-900 bg-surface-100 border border-surface-300 focus:border-primary-200 rounded-xl px-3 py-2 outline-none placeholder:text-typography-400 placeholder:font-normal transition-all"
                                        />
                                      </div>
                                      <div className="relative">
                                        <input
                                          type="text"
                                          placeholder="Congregação..."
                                          value={subCong}
                                          onChange={e => handleCongregationChange(sub.id, e.target.value)}
                                          className="w-full text-xs font-semibold text-typography-700 bg-surface-100 border border-surface-300 focus:border-primary-200 rounded-xl px-3 py-2 outline-none placeholder:text-typography-400 placeholder:font-normal transition-all"
                                        />
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      }

                      {/* Item sem orador (Cântico, Música, Intervalo) */}
                      if (!hasSpeaker) {
                        return (
                          <div
                            key={`resp-item-${item.id || itemIdx}`}
                            className="flex items-center gap-3 p-3 rounded-2xl bg-surface-100/60 border border-surface-300/60"
                          >
                            <span className="text-xs font-mono font-bold text-typography-400 w-12 shrink-0">
                              {item.time || '--:--'}
                            </span>
                            <div className="p-1.5 rounded-lg bg-surface-200 text-typography-400 shrink-0">
                              {item.icon ? <item.icon size={14} /> : <Music size={14} />}
                            </div>
                            <span className="text-xs sm:text-sm font-medium text-typography-500 truncate">
                              {item.title}
                            </span>
                          </div>
                        );
                      }

                      {/* Item com orador / Presidente / Oração */}
                      const speakerName = speakers[item.id] || '';
                      const speakerCong = congregations[item.id] || '';
                      const isConfirmed = !!confirmedSpeakers[item.id];

                      return (
                        <div
                          key={`resp-item-${item.id || itemIdx}`}
                          className={`p-4 rounded-3xl bg-surface-100 border shadow-2xs space-y-3 transition-all ${
                            isRole
                              ? 'border-violet-500/30 ring-1 ring-violet-500/10'
                              : 'border-surface-300'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="space-y-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                {item.time && (
                                  <span className="px-2 py-0.5 rounded-md text-[11px] font-mono font-black bg-surface-200 text-typography-700 border border-surface-300">
                                    {item.time}
                                  </span>
                                )}
                                {item.label && (
                                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-600">
                                    {item.label}
                                  </span>
                                )}
                                {isRole && (
                                  <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-violet-500/10 text-violet-600 border border-violet-500/20">
                                    Presidente de Sessão
                                  </span>
                                )}
                              </div>
                              <h4 className="text-xs sm:text-sm font-bold text-typography-900 leading-tight">
                                {item.title}
                              </h4>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => handleConfirmationToggle(item.id)}
                                className={`px-2.5 py-1 rounded-xl text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                                  isConfirmed
                                    ? 'bg-emerald-500 text-white shadow-xs'
                                    : 'bg-surface-200 text-typography-500 hover:text-typography-900 border border-surface-300'
                                }`}
                                title={isConfirmed ? 'Confirmado' : 'Marcar como confirmado'}
                              >
                                <CheckCircle2 size={13} />
                                <span className="hidden xs:inline">{isConfirmed ? 'Confirmado' : 'Pendente'}</span>
                              </button>

                              <button
                                onClick={() => generateDocument(item, 'docx')}
                                className="p-1.5 rounded-xl bg-amber-500/10 text-amber-600 hover:bg-amber-500 hover:text-white border border-amber-500/20 transition-all cursor-pointer"
                                title="Gerar Carta de Designação (.docx)"
                              >
                                <FileText size={15} />
                              </button>
                            </div>
                          </div>

                          {/* Inputs de Orador e Congregação */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div className="relative">
                              <input
                                type="text"
                                placeholder={isRole ? "Nome do Presidente..." : isPrayer ? "Nome do irmão (oração)..." : "Nome do orador..."}
                                value={speakerName}
                                onChange={e => handleSpeakerChange(item.id, e.target.value)}
                                className="w-full text-xs font-bold text-typography-900 bg-surface-200/50 border border-surface-300 focus:border-primary-200 rounded-xl px-3 py-2 outline-none placeholder:text-typography-400 placeholder:font-normal transition-all"
                              />
                            </div>
                            <div className="relative">
                              <input
                                type="text"
                                placeholder="Congregação..."
                                value={speakerCong}
                                onChange={e => handleCongregationChange(item.id, e.target.value)}
                                className="w-full text-xs font-semibold text-typography-700 bg-surface-200/50 border border-surface-300 focus:border-primary-200 rounded-xl px-3 py-2 outline-none placeholder:text-typography-400 placeholder:font-normal transition-all"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* A4 Document Viewport Container (Apenas no Modo Folha A4 na tela, mas SEMPRE presente no print) */}
      <div 
        ref={containerRef}
        className={`circuit-assembly-viewport w-full max-w-full min-w-0 overflow-x-auto overflow-y-auto bg-slate-200/80 dark:bg-slate-900/80 rounded-3xl p-3 sm:p-6 lg:p-8 flex-col shadow-inner custom-scrollbar relative border border-slate-300/80 dark:border-slate-800 ${
          viewMode === 'a4' ? 'flex' : 'hidden print:flex'
        }`}
        style={{
          minHeight: viewMode === 'a4' ? '400px' : '0',
          touchAction: 'pan-x pan-y',
        }}
      >
        <div className="min-w-full w-max flex flex-col items-center gap-8 mx-auto">
        {/* Render 2 Physical A4 Pages: Page 1 = Manhã, Page 2 = Tarde */}
        {assemblyProgram.sessions.map((session: any, pageIdx: number) => {
          const pageNum = pageIdx + 1;
          const totalPages = assemblyProgram.sessions.length;

          return (
            <div key={`session-${session.period || pageIdx}-${pageIdx}`} className="circuit-assembly-session-wrapper flex flex-col items-center w-full">
              {/* Screen-only Page Divider / Header Pill */}
              <div className="no-print mb-2.5 px-3 py-1 bg-slate-800 text-slate-200 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-sm border border-slate-700">
                <span className="w-2 h-2 rounded-full bg-violet-400"></span>
                <span>Página {pageNum} de {totalPages} • Sessão da {session.period}</span>
              </div>

              {/* Scaled Document Wrapper — Strict Proportional Model (A4 Portrait) */}
              <div 
                className="circuit-assembly-scale-wrapper mx-auto shrink-0 relative transition-all duration-150"
                style={{
                  width: `${(210 * zoom) / 100}mm`,
                  minWidth: `${(210 * zoom) / 100}mm`,
                  height: `${(297 * zoom) / 100}mm`,
                  minHeight: `${(297 * zoom) / 100}mm`,
                }}
              >
                {/* Physical A4 Digital Document Sheet — Rigid Fixed Dimensions (210 x 297 mm) */}
                <div 
                  id={`circuit-assembly-a4-page-${pageNum}`}
                  ref={pageIdx === 0 ? sheetRef : undefined}
                  className="circuit-assembly-a4-page bg-white text-slate-900 shadow-2xl rounded-sm ring-1 ring-black/10 print:ring-0 print:shadow-none print:border-none print:m-0 flex flex-col justify-between box-border select-text"
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
                    <div className="relative w-full rounded-2xl overflow-hidden mb-2.5 shadow-md border border-slate-300/80 bg-slate-950 text-white shrink-0">
                      {/* Background Image Artwork / Gradient Fallback */}
                      {(details.customHeaderImage || assemblyProgram.headerImage) ? (
                        <div className="absolute inset-0 z-0">
                          <Image 
                            src={details.customHeaderImage || assemblyProgram.headerImage} 
                            alt={details.assemblyTheme || assemblyProgram.theme || 'Tema da Assembleia'}
                            fill
                            className="object-cover"
                            style={{ objectPosition: 'center 25%' }}
                            priority
                            quality={100}
                            unoptimized
                            referrerPolicy="no-referrer"
                          />
                          {/* Rich glass gradient overlay */}
                          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/75 to-slate-950/45" />
                        </div>
                      ) : (
                        <div className="absolute inset-0 z-0 bg-gradient-to-br from-slate-950 via-slate-900 to-amber-950" />
                      )}

                      {/* Overlaid Banner Content */}
                      <div className="relative z-10 p-3.5 flex flex-col justify-between min-h-[38mm]">
                        {/* Top Bar: Program Title & Part Pill */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-[7.5pt] font-black uppercase tracking-widest text-amber-200 drop-shadow-sm flex items-center gap-1.5 min-w-0">
                            <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0"></span>
                            <span className="truncate">{assemblyProgram.title}</span>
                          </div>
                          <span className="text-[7.5pt] font-black uppercase tracking-wider text-amber-950 bg-amber-400 px-3 py-0.5 rounded-full shadow-sm shrink-0 border border-amber-300/60">
                            PARTE {['A', 'B', 'C', 'D'][selectedPart] || 'A'}
                          </span>
                        </div>

                        {/* Main Theme Verse Typography */}
                        <div className="my-1.5 space-y-0.5">
                          <div className="text-[13pt] font-black uppercase tracking-tight text-white drop-shadow-md leading-tight">
                            {details.assemblyTheme || assemblyProgram.theme}
                          </div>
                        </div>

                        {/* Bottom Event Metadata Strip with Chips */}
                        <div className="flex items-center justify-between gap-2 pt-1 flex-wrap border-t border-white/10">
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                            <div className="flex items-center gap-1.5 text-[8pt] font-bold uppercase tracking-wider text-white drop-shadow-sm">
                              <CalendarDays size={13} className="text-amber-400 shrink-0" />
                              <span>{details.eventDate || 'Data a definir'}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-[8pt] font-bold uppercase tracking-wider text-white drop-shadow-sm">
                              <MapPin size={13} className="text-amber-400 shrink-0" />
                              <span>{details.eventLocation || 'Local a definir'}</span>
                            </div>
                            {details.rehearsalDate && (
                              <div className="flex items-center gap-1.5 text-[7.5pt] font-bold uppercase tracking-wider text-white/85 drop-shadow-sm">
                                <Clock size={12} className="text-amber-400/90 shrink-0" />
                                <span>Ensaio: {details.rehearsalDate}{details.rehearsalLocation ? ` — ${details.rehearsalLocation}` : ''}</span>
                              </div>
                            )}
                            {details.assemblyAssistant && (
                              <div className="flex items-center gap-1.5 text-[7.5pt] font-bold uppercase tracking-wider text-amber-200 drop-shadow-sm">
                                <UserCheck size={12} className="text-amber-400 shrink-0" />
                                <span>Assistente: {details.assemblyAssistant}</span>
                              </div>
                            )}
                          </div>

                          <button
                            onClick={() => setShowEditDetailsModal(true)}
                            className="no-print text-[7.5pt] font-bold text-amber-200 hover:text-white flex items-center gap-1.5 cursor-pointer bg-white/15 hover:bg-white/25 px-2.5 py-0.5 rounded-lg transition-all ml-auto drop-shadow-sm border border-white/15 active:scale-95"
                            title="Editar informações e imagem do evento"
                          >
                            <Edit3 size={11} />
                            <span>Editar</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Session Content for this Page */}
                    <div className="flex flex-col flex-1 min-h-0">
                      {/* Session Header Bar */}
                      <div className="flex items-center justify-between px-3 py-1.5 bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-transparent border-l-4 border-amber-500 rounded-r-lg mb-2">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0"></span>
                          <h3 className="text-[10pt] font-black tracking-wider uppercase text-amber-950">
                            SESSÃO DA {session.period.toUpperCase()}
                          </h3>
                        </div>
                        <span className="text-[7pt] font-bold tracking-wider uppercase text-amber-800/70">
                          HORÁRIO • PROGRAMA • ORADOR / CONGREGAÇÃO
                        </span>
                      </div>

                      {/* Session Items List */}
                      <div className="space-y-1.5 flex-1 session-items-container">
                        {session.items.map((item: any, itemIdx: number) => {
                          const isSymposium = item.subitems && item.subitems.length > 0;
                          const itemTitleNorm = (item.title || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                          const isPrayer = itemTitleNorm.includes('oracao') || itemTitleNorm.includes('prayer');
                          const isRole = item.isRole || itemTitleNorm.includes('presidente') || item.id === 'm0' || item.id === 't0';
                          const hasSpeaker = !item.noSpeaker || isPrayer || isRole;

                          if (isSymposium) {
                            return (
                              <div key={`item-${item.id || itemIdx}-${itemIdx}`} className="bg-amber-50/40 rounded-xl p-2 border border-amber-200/70 my-1 session-item-row symposium-box shadow-2xs">
                                {/* Symposium Title Row */}
                                <div className="flex items-start gap-2 mb-1.5">
                                  <span className="text-[8.5pt] font-black text-amber-700 w-11 shrink-0 mt-0.5">
                                    {item.time || ''}
                                  </span>
                                  <div className="flex-1 min-w-0">
                                    <span className="text-[7pt] font-black uppercase text-amber-600 tracking-wider mr-1.5 inline-block leading-tight px-1.5 py-0.2 bg-amber-100/70 rounded">
                                      {item.label || 'SÉRIE DE DISCURSOS:'}
                                    </span>
                                    <span className="text-[9.5pt] font-black text-gray-950 leading-tight ml-1">
                                      {item.title}
                                    </span>
                                  </div>
                                </div>

                                {/* Symposium Subitems (Indented with amber border) */}
                                <div className="ml-11 border-l-2 border-amber-400/80 pl-2.5 space-y-1.5 mt-1">
                                  {item.subitems.map((sub: any, idx: number) => {
                                    const subSpeaker = speakers[sub.id] || '';
                                    const subCong = congregations[sub.id] || '';
                                    const subNote = currentPart.notes?.[sub.id] || '';
                                    const isConfirmed = !!confirmedSpeakers[sub.id];

                                    return (
                                      <div key={`sub-${sub.id || idx}-${itemIdx}-${idx}`} className="border-b border-amber-200/40 pb-1.5 last:border-b-0 symposium-subitem">
                                        <div className="flex items-start justify-between gap-1.5">
                                          <div className="flex items-start gap-1.5 flex-1 min-w-0">
                                            <span className="w-4 h-4 rounded-full bg-amber-200/90 text-amber-900 font-black text-[7.5pt] flex items-center justify-center shrink-0 mt-0.5">
                                              {idx + 1}
                                            </span>
                                            <div className="flex-1 min-w-0">
                                              <div className="flex items-center gap-1.5 flex-wrap">
                                                <span className="text-[8.5pt] font-bold text-gray-900 leading-tight">
                                                  {sub.title}
                                                </span>
                                                {sub.time ? (
                                                  <span className="text-[7.5pt] font-bold text-amber-800 bg-amber-100 px-1 py-0.2 rounded">
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

                                              {/* Speaker & Congregation Inputs */}
                                              <div className="grid grid-cols-2 gap-1.5 mt-1 speaker-grid">
                                                <div className="relative">
                                                  <input
                                                    type="text"
                                                    placeholder="Nome do orador..."
                                                    value={subSpeaker}
                                                    onChange={e => handleSpeakerChange(sub.id, e.target.value)}
                                                    className={`w-full text-[8.5pt] font-bold text-gray-900 bg-transparent border-b border-gray-200/90 focus:border-amber-500 hover:bg-amber-50/40 px-1 rounded-t-sm outline-none placeholder:text-gray-300 transition-colors ${!subSpeaker ? 'print:hidden' : ''}`}
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
                                                    className={`w-full text-[8pt] text-gray-600 bg-transparent border-b border-gray-200/90 focus:border-amber-500 hover:bg-amber-50/40 px-1 rounded-t-sm outline-none placeholder:text-gray-300 transition-colors ${!subCong ? 'print:hidden' : ''}`}
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

                                          {/* Action buttons (Confirmation & Docx letter) */}
                                          <div className="flex items-center gap-1 shrink-0 no-print mt-0.5">
                                            <button
                                              onClick={() => handleConfirmationToggle(sub.id)}
                                              className={`p-1 rounded-md transition-all cursor-pointer shadow-2xs active:scale-90 ${
                                                isConfirmed ? 'bg-emerald-500 text-white shadow-emerald-200' : 'bg-gray-100 text-gray-400 hover:text-gray-700 hover:bg-gray-200'
                                              }`}
                                              title={isConfirmed ? 'Confirmado' : 'Marcar confirmação'}
                                            >
                                              <CheckCircle2 size={13} />
                                            </button>
                                            <button
                                              onClick={() => generateDocument({ ...sub, time: sub.time || currentPart.userTimes?.[sub.id] || '', title: `${item.title}: ${sub.title}` }, 'docx')}
                                              className="p-1 bg-amber-500 text-white hover:bg-amber-600 rounded-md shadow-2xs shadow-amber-200 transition-all cursor-pointer active:scale-90"
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
                              key={`item-${item.id || itemIdx}-${itemIdx}`} 
                              className={`p-1.5 rounded-lg transition-colors session-item-row ${
                                isRole ? 'bg-violet-50/70 border border-violet-200/80 shadow-2xs' : isPrayer ? 'bg-amber-50/25 border-b border-gray-100 hover:bg-amber-50/40' : 'border-b border-gray-100 hover:bg-gray-50/60'
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
                                        <span className="text-[7pt] font-black uppercase text-amber-700 tracking-wider bg-amber-100/70 px-1.5 py-0.2 rounded">
                                          {item.label}
                                        </span>
                                      )}
                                      <span className={`text-[9pt] leading-tight ${
                                        isRole ? 'font-black text-violet-950 uppercase tracking-wide' : isPrayer ? 'font-bold text-amber-950' : isMusicOrIntermission ? 'font-medium text-gray-500 italic' : 'font-bold text-gray-900'
                                      }`}>
                                        {item.title}
                                      </span>
                                    </div>

                                    {hasSpeaker && (
                                      <div className="grid grid-cols-2 gap-1.5 mt-1 speaker-grid">
                                        <div className="relative">
                                          <input
                                            type="text"
                                            placeholder={isRole ? "Nome do Presidente..." : isPrayer ? "Nome do irmão (oração)..." : "Nome do orador..."}
                                            value={speakerName}
                                            onChange={e => handleSpeakerChange(item.id, e.target.value)}
                                            className={`w-full text-[9pt] font-bold text-gray-900 bg-transparent border-b border-gray-200/90 focus:border-amber-500 hover:bg-amber-50/30 px-1 rounded-t-sm outline-none placeholder:text-gray-300 transition-colors ${!speakerName ? 'print:hidden' : ''}`}
                                          />
                                          {!speakerName && (
                                            <div className="hidden print:flex items-baseline w-full text-[8.5pt] text-gray-600 font-normal">
                                              <span className="text-[7.5pt] font-semibold text-gray-400 mr-1.5 shrink-0">
                                                {isRole ? 'Presidente:' : isPrayer ? 'Oração:' : 'Orador:'}
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
                                            className={`w-full text-[8.5pt] text-gray-600 bg-transparent border-b border-gray-200/90 focus:border-amber-500 hover:bg-amber-50/30 px-1 rounded-t-sm outline-none placeholder:text-gray-300 transition-colors ${!speakerCong ? 'print:hidden' : ''}`}
                                          />
                                          {!speakerCong && (
                                            <div className="hidden print:flex items-baseline w-full text-[8.5pt] text-gray-500 font-normal">
                                              <span className="text-[7.5pt] font-semibold text-gray-400 mr-1.5 shrink-0">Cong:</span>
                                              <span className="flex-1 border-b border-dotted border-gray-300 pb-0.5">&nbsp;</span>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {hasSpeaker && (
                                  <div className="flex items-center gap-1 shrink-0 no-print mt-0.5">
                                    <button
                                      onClick={() => handleConfirmationToggle(item.id)}
                                      className={`p-1 rounded-md transition-all cursor-pointer shadow-2xs active:scale-90 ${
                                        isConfirmed ? 'bg-emerald-500 text-white shadow-emerald-200' : 'bg-gray-100 text-gray-400 hover:text-gray-700 hover:bg-gray-200'
                                      }`}
                                      title={isConfirmed ? 'Confirmado' : 'Marcar confirmação'}
                                    >
                                      <CheckCircle2 size={13} />
                                    </button>
                                    <button
                                      onClick={() => generateDocument(item, 'docx')}
                                      className="p-1 bg-amber-500 text-white hover:bg-amber-600 rounded-md shadow-2xs shadow-amber-200 transition-all cursor-pointer active:scale-90"
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
                  </div>

                  {/* Sheet Bottom Footer - Executive publication style */}
                  <div className="border-t-2 border-gray-200/80 pt-2 mt-auto flex items-center justify-between text-[7pt] font-bold text-gray-400 uppercase tracking-wider shrink-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0"></span>
                      <span className="truncate">{assemblyProgram.title}</span>
                      <span className="text-gray-300 font-normal">•</span>
                      <span className="text-gray-500">{selectedYear}</span>
                    </div>
                    <div className="font-mono text-[6.5pt] text-gray-400/80 px-2 hidden sm:inline">
                      CA-pgm27-T • {type === 'supt' ? 'CAco' : 'CAbr'}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-gray-700 font-black">Página {pageNum} de {totalPages}</span>
                      <span className="text-gray-300">•</span>
                      <span className="text-amber-800/90 font-bold">Sessão da {session.period}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        </div>

        {/* Orphaned Parts / Revisions Section (Below A4 Sheet) */}
        {Object.keys(currentPart.orphanedParts || {}).length > 0 && (
          <div className="mt-8 sm:mt-12 w-full max-w-5xl mx-auto px-4 no-print">
            <div className="bg-amber-500/10 rounded-3xl border border-amber-500/20 p-6 sm:p-8 shadow-xs relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 to-transparent" />
              <div className="flex items-start gap-4 mb-6">
                <div className="p-3 bg-amber-500/20 rounded-2xl text-amber-500 shrink-0">
                  <AlertTriangle size={28} />
                </div>
                <div>
                  <h3 className="text-xl font-black uppercase tracking-tight text-typography-900 leading-tight">Itens Órfãos / Revisões Necessárias</h3>
                  <p className="text-sm text-typography-600 font-medium mt-1">
                    Estes dados foram preservados de versões anteriores mas não possuem correspondência automática na programação atual.
                  </p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(currentPart.orphanedParts || {}).map(([oldId, data]: [string, any], orphanIdx: number) => (
                  <div key={`orphan-${oldId || orphanIdx}-${orphanIdx}`} className="bg-surface-100 p-5 rounded-2xl border border-surface-300 shadow-xs hover:border-amber-500/40 transition-all group">
                    <div className="flex justify-between items-start mb-4">
                      <div className="min-w-0">
                        <div className="text-[10px] font-black uppercase text-amber-600 dark:text-amber-400 mb-1 px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded-full inline-block">
                          {data.reason || 'Diferença de Versão'}
                        </div>
                        <h4 className="text-base font-bold text-typography-900 leading-tight line-clamp-2">{data.originalTitle || 'Título Desconhecido'}</h4>
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

      {/* Barra Flutuante Suspensa - Estilo Leitor de PDF integrada ao Tema (Padrão S-303) */}
      {viewMode === 'a4' && (
        <div className="fixed bottom-4 sm:bottom-6 left-0 right-0 z-[1000] flex justify-center pointer-events-none print:hidden">
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="pointer-events-auto bg-surface-100/95 dark:bg-surface-800/95 backdrop-blur-xl text-typography-800 dark:text-typography-100 border border-surface-300 dark:border-surface-600 shadow-2xl rounded-full px-2.5 sm:px-3.5 py-1.5 flex items-center gap-1 sm:gap-2 transition-all hover:shadow-primary-200/10"
          >
            {/* Indicador de Documento / Página */}
            <div className="flex items-center gap-1.5 px-2 py-1 text-typography-600 dark:text-typography-300 text-xs font-medium select-none">
              <FileText size={14} className="text-primary-200" />
              <span className="hidden sm:inline font-semibold">Folha A4</span>
              <span className="text-[11px] text-typography-500 font-mono">1/{assemblyProgram.sessions?.length || 2}</span>
            </div>

            <div className="w-px h-4 bg-surface-300 dark:bg-surface-600 mx-0.5" />

            {/* Botão Zoom Out (-) */}
            <button
              type="button"
              onClick={handleZoomOut}
              disabled={zoom <= 35}
              className="p-1.5 hover:bg-surface-200 dark:hover:bg-surface-700 active:scale-95 rounded-full text-typography-700 dark:text-typography-200 hover:text-primary-200 dark:hover:text-primary-100 transition-all disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
              title="Diminuir Zoom (-)"
            >
              <Minus size={15} />
            </button>

            {/* Seletor / Indicador de Porcentagem de Zoom */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowZoomMenu(!showZoomMenu)}
                className="px-2 py-1 hover:bg-surface-200 dark:hover:bg-surface-700 rounded-lg text-xs font-bold font-mono text-typography-800 dark:text-typography-100 transition-all flex items-center gap-1 cursor-pointer"
                title="Opções de visualização de Zoom"
              >
                <span className="min-w-[40px] text-center">{Math.round(zoom)}%</span>
                <ChevronDown size={12} className="text-typography-500" />
              </button>

              {showZoomMenu && (
                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-surface-100 dark:bg-surface-800 backdrop-blur-xl border border-surface-300 dark:border-surface-600 rounded-2xl shadow-2xl py-1.5 min-w-[200px] z-40 divide-y divide-surface-200 dark:divide-surface-700 text-xs text-typography-800 dark:text-typography-100">
                  <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-typography-500">
                    Nível de Zoom
                  </div>
                  <div className="py-1">
                    <button
                      type="button"
                      onClick={handleToggleAutoFit}
                      className={`w-full text-left px-3 py-1.5 hover:bg-surface-200 dark:hover:bg-surface-700 transition-all flex items-center justify-between cursor-pointer ${
                        autoFit ? 'text-primary-200 font-bold bg-primary-50/50 dark:bg-primary-200/10' : 'text-typography-700 dark:text-typography-200'
                      }`}
                    >
                      <span className="flex items-center gap-1.5">
                        <Maximize2 size={13} className={autoFit ? 'text-primary-200' : 'text-typography-500'} />
                        Ajustar à Tela (Automático)
                      </span>
                      {autoFit && <Check size={13} className="text-primary-200" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSetZoom(100)}
                      className={`w-full text-left px-3 py-1.5 hover:bg-surface-200 dark:hover:bg-surface-700 transition-all flex items-center justify-between cursor-pointer ${
                        !autoFit && Math.round(zoom) === 100 ? 'text-primary-200 font-bold bg-primary-50/50 dark:bg-primary-200/10' : 'text-typography-700 dark:text-typography-200'
                      }`}
                    >
                      <span>100% (Tamanho Real)</span>
                      {!autoFit && Math.round(zoom) === 100 && <Check size={13} className="text-primary-200" />}
                    </button>
                  </div>
                  <div className="py-1">
                    {[50, 65, 75, 85, 125, 150].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => handleSetZoom(s)}
                        className={`w-full text-left px-3 py-1 hover:bg-surface-200 dark:hover:bg-surface-700 transition-all flex items-center justify-between cursor-pointer ${
                          !autoFit && Math.round(zoom) === s ? 'text-primary-200 font-bold bg-primary-50/50 dark:bg-primary-200/10' : 'text-typography-700 dark:text-typography-300'
                        }`}
                      >
                        <span>{s}%</span>
                        {!autoFit && Math.round(zoom) === s && <Check size={13} className="text-primary-200" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Botão Zoom In (+) */}
            <button
              type="button"
              onClick={handleZoomIn}
              disabled={zoom >= 200}
              className="p-1.5 hover:bg-surface-200 dark:hover:bg-surface-700 active:scale-95 rounded-full text-typography-700 dark:text-typography-200 hover:text-primary-200 dark:hover:text-primary-100 transition-all disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
              title="Aumentar Zoom (+)"
            >
              <Plus size={15} />
            </button>

            <div className="w-px h-4 bg-surface-300 dark:bg-surface-600 mx-0.5" />

            {/* Botão Ajustar à Tela (Alterna entre Automático ou Não) */}
            <button
              type="button"
              onClick={handleToggleAutoFit}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm ${
                autoFit 
                  ? 'bg-primary-200 hover:bg-primary-150 text-white shadow-primary-200/30' 
                  : 'bg-surface-200 hover:bg-surface-300 dark:bg-surface-700 dark:hover:bg-surface-600 text-typography-700 dark:text-typography-200'
              }`}
              title={autoFit ? 'Ajuste à tela está ATIVO (automático). Clique para tamanho real (100%)' : 'Clique para ajustar automaticamente à tela'}
            >
              {autoFit ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
              <span className="hidden sm:inline">
                {autoFit ? 'Ajustado' : 'Ajustar à tela'}
              </span>
              <span className="sm:hidden">
                {autoFit ? 'Auto' : 'Ajustar'}
              </span>
              {autoFit && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              )}
            </button>
          </motion.div>
        </div>
      )}

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
                    className="w-full py-3 bg-primary-200 text-white font-bold rounded-2xl shadow-md hover:bg-primary-150 transition-all cursor-pointer"
                  >
                    Adicionar nova temporada
                  </button>
                  <button
                    onClick={() => setNextSeasonPreview(null)}
                    className="w-full py-3 bg-surface-200 text-typography-600 font-bold rounded-2xl hover:bg-surface-300 transition-all cursor-pointer"
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
              className="bg-surface-100 rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden border border-surface-300 relative text-typography-900"
            >
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary-200 via-primary-150 to-transparent" />
              {/* Header */}
              <div className="p-6 border-b border-surface-300 bg-surface-200/40">
                <h3 className="text-xl font-black text-typography-900 uppercase tracking-tight">Reatribuir Designação</h3>
                <p className="text-sm text-typography-500 font-medium">Mover dados preservados para uma parte da programação atual.</p>
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
                {assemblyProgram.sessions.map((session: any, sIdx: number) => (
                  <div key={`modal-session-${session.period || sIdx}-${sIdx}`} className="space-y-3">
                    <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                      <Clock size={12} />
                      Sessão da {session.period}
                    </h4>
                    <div className="grid grid-cols-1 gap-2">
                      {session.items
                        .filter((item: any) => !item.noSpeaker && !item.isRole)
                        .map((item: any, itemIdx: number) => {
                          const hasData = partsData[selectedPart].speakers?.[item.id] || 
                                         partsData[selectedPart].congregations?.[item.id] || 
                                         partsData[selectedPart].notes?.[item.id];
                          
                          return (
                            <button
                              key={`modal-item-${item.id || itemIdx}-${itemIdx}`}
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
                        .flatMap((item: any, itemIdx: number) => item.subitems.map((sub: any, subIdx: number) => {
                          const hasData = partsData[selectedPart].speakers?.[sub.id] || 
                                         partsData[selectedPart].congregations?.[sub.id] || 
                                         partsData[selectedPart].notes?.[sub.id];
                          
                          return (
                            <button
                              key={`modal-sub-${sub.id || subIdx}-${itemIdx}-${subIdx}`}
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
                        }))}
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
              className="bg-surface-100 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-surface-300 relative text-typography-900"
            >
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 to-transparent" />
              <div className="p-6 bg-surface-200/40 border-b border-surface-300 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-500">
                    <CalendarDays size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-typography-900 uppercase tracking-tight">Detalhes do Evento</h3>
                    <p className="text-xs text-typography-500 font-medium">Informações que aparecem no cabeçalho da folha.</p>
                  </div>
                </div>
                <button onClick={() => setShowEditDetailsModal(false)} className="p-2 text-typography-400 hover:text-typography-900 hover:bg-surface-200 rounded-xl transition-all cursor-pointer">
                  <X size={20} />
                </button>
              </div>

              <div className="flex flex-col max-h-[calc(100vh-140px)] sm:max-h-[85vh]">
                <div className="flex-1 p-6 space-y-5 overflow-y-auto custom-scrollbar scroll-smooth">
                  <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Tema da Assembleia</label>
                      <input 
                        type="text" 
                        value={details.assemblyTheme} 
                        onChange={e => setPartsData(prev => ({ 
                          ...prev, 
                          [selectedPart]: { 
                            ...prev[selectedPart], 
                            details: { ...prev[selectedPart].details, assemblyTheme: e.target.value } 
                          } 
                        }))}
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
                        onChange={e => setPartsData(prev => ({ 
                          ...prev, 
                          [selectedPart]: { 
                            ...prev[selectedPart], 
                            details: { ...prev[selectedPart].details, eventDate: e.target.value } 
                          } 
                        }))}
                        placeholder="Ex: 15 de Outubro"
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Local</label>
                      <input 
                        type="text" 
                        value={details.eventLocation} 
                        onChange={e => setPartsData(prev => ({ 
                          ...prev, 
                          [selectedPart]: { 
                            ...prev[selectedPart], 
                            details: { ...prev[selectedPart].details, eventLocation: e.target.value } 
                          } 
                        }))}
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
                        onChange={e => setPartsData(prev => ({ 
                          ...prev, 
                          [selectedPart]: { 
                            ...prev[selectedPart], 
                            details: { ...prev[selectedPart].details, rehearsalDate: e.target.value } 
                          } 
                        }))}
                        placeholder="Ex: Sábado, 14:00"
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Local do Ensaio</label>
                      <input 
                        type="text" 
                        value={details.rehearsalLocation} 
                        onChange={e => setPartsData(prev => ({ 
                          ...prev, 
                          [selectedPart]: { 
                            ...prev[selectedPart], 
                            details: { ...prev[selectedPart].details, rehearsalLocation: e.target.value } 
                          } 
                        }))}
                        placeholder="Ex: Congregação Central"
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all"
                      />
                    </div>
                  </div>

                  {/* Assistente(s) da Assembleia */}
                  <div className="space-y-3 pt-3 border-t border-gray-100">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <UserCheck size={15} className="text-amber-600" />
                        <label className="text-[10px] font-black uppercase text-gray-500 tracking-wider">
                          Assistente(s) da Assembleia ({type === 'supt' ? 'CAco' : 'CAbr'})
                        </label>
                      </div>
                      <span className="text-[10px] text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                        Convite .docx
                      </span>
                    </div>

                    <div className="space-y-2.5">
                      {((details.assemblyAssistants && details.assemblyAssistants.length > 0) ? details.assemblyAssistants : [details.assemblyAssistant || '']).map((asst, index) => {
                        const cong = details.assistantCongregations?.[index] || '';
                        return (
                          <div key={index} className="p-3 bg-gray-50 border border-gray-100 rounded-2xl space-y-2">
                            <div className="flex gap-2 items-center">
                              <input 
                                type="text" 
                                placeholder={`Nome do Assistente ${index + 1}`}
                                value={asst}
                                disabled={isGuest}
                                onChange={(e) => {
                                  const currentList = [...((details.assemblyAssistants && details.assemblyAssistants.length > 0) ? details.assemblyAssistants : [details.assemblyAssistant || ''])];
                                  currentList[index] = e.target.value;
                                  
                                  const filteredList = currentList.filter(n => n.trim() !== '');
                                  let formattedString = '';
                                  if (filteredList.length === 1) formattedString = filteredList[0];
                                  else if (filteredList.length > 1) {
                                    const allButLast = filteredList.slice(0, -1).join(', ');
                                    formattedString = `${allButLast} e ${filteredList[filteredList.length - 1]}`;
                                  }

                                  setPartsData(prev => ({
                                    ...prev,
                                    [selectedPart]: {
                                      ...prev[selectedPart],
                                      details: {
                                        ...prev[selectedPart].details,
                                        assemblyAssistants: currentList,
                                        assemblyAssistant: formattedString
                                      }
                                    }
                                  }));
                                }}
                                className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all placeholder:text-gray-300 disabled:opacity-60"
                              />

                              <input 
                                type="text" 
                                placeholder="Congregação (opcional)"
                                value={cong}
                                disabled={isGuest}
                                onChange={(e) => {
                                  const currentCongs = { ...(details.assistantCongregations || {}) };
                                  currentCongs[index] = e.target.value;

                                  setPartsData(prev => ({
                                    ...prev,
                                    [selectedPart]: {
                                      ...prev[selectedPart],
                                      details: {
                                        ...prev[selectedPart].details,
                                        assistantCongregations: currentCongs
                                      }
                                    }
                                  }));
                                }}
                                className="w-32 sm:w-40 px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all placeholder:text-gray-300 disabled:opacity-60"
                              />

                              {!isGuest && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const currentList = [...((details.assemblyAssistants && details.assemblyAssistants.length > 0) ? details.assemblyAssistants : [details.assemblyAssistant || ''])];
                                    const currentCongs = { ...(details.assistantCongregations || {}) };
                                    
                                    if (currentList.length <= 1) {
                                      setPartsData(prev => ({
                                        ...prev,
                                        [selectedPart]: {
                                          ...prev[selectedPart],
                                          details: {
                                            ...prev[selectedPart].details,
                                            assemblyAssistants: [''],
                                            assemblyAssistant: '',
                                            assistantCongregations: {}
                                          }
                                        }
                                      }));
                                    } else {
                                      const newList = currentList.filter((_, i) => i !== index);
                                      const newCongs: Record<number, string> = {};
                                      let newIdx = 0;
                                      for (let i = 0; i < currentList.length; i++) {
                                        if (i !== index) {
                                          if (currentCongs[i]) newCongs[newIdx] = currentCongs[i];
                                          newIdx++;
                                        }
                                      }

                                      const filteredList = newList.filter(n => n.trim() !== '');
                                      let formattedString = '';
                                      if (filteredList.length === 1) formattedString = filteredList[0];
                                      else if (filteredList.length > 1) {
                                        const allButLast = filteredList.slice(0, -1).join(', ');
                                        formattedString = `${allButLast} e ${filteredList[filteredList.length - 1]}`;
                                      }

                                      setPartsData(prev => ({
                                        ...prev,
                                        [selectedPart]: {
                                          ...prev[selectedPart],
                                          details: {
                                            ...prev[selectedPart].details,
                                            assemblyAssistants: newList,
                                            assemblyAssistant: formattedString,
                                            assistantCongregations: newCongs
                                          }
                                        }
                                      }));
                                    }
                                  }}
                                  className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                                  title="Remover assistente"
                                >
                                  <Trash2 size={16} />
                                </button>
                              )}
                            </div>

                            {asst.trim() && (
                              <div className="flex justify-end">
                                <button
                                  type="button"
                                  onClick={() => generateAssistantDocument(asst, cong)}
                                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-[11px] font-bold flex items-center gap-1.5 shadow-xs transition-all active:scale-[0.98]"
                                  title={`Gerar convite .docx para ${asst}`}
                                >
                                  <FileDown size={13} />
                                  <span>Gerar Convite (.docx)</span>
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {!isGuest && (
                        <button
                          type="button"
                          onClick={() => {
                            const currentList = [...((details.assemblyAssistants && details.assemblyAssistants.length > 0) ? details.assemblyAssistants : [details.assemblyAssistant || ''])];
                            setPartsData(prev => ({
                              ...prev,
                              [selectedPart]: {
                                ...prev[selectedPart],
                                details: {
                                  ...prev[selectedPart].details,
                                  assemblyAssistants: [...currentList, '']
                                }
                              }
                            }));
                          }}
                          className="w-full py-2.5 bg-amber-50 hover:bg-amber-100/80 text-amber-700 text-xs font-bold uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 border border-dashed border-amber-300"
                        >
                          <Plus size={14} />
                          Adicionar Assistente
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Imagem de Capa / Arte Oficial */}
                  <div className="space-y-2 pt-2 border-t border-gray-100">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Imagem do Cabeçalho (URL)</label>
                      {details.customHeaderImage && (
                        <button
                          type="button"
                          onClick={() => setPartsData(prev => ({ 
                            ...prev, 
                            [selectedPart]: { 
                              ...prev[selectedPart], 
                              details: { ...prev[selectedPart].details, customHeaderImage: '' } 
                            } 
                          }))}
                          className="text-[10px] font-bold text-amber-600 hover:text-amber-800 hover:underline"
                        >
                          Restaurar Imagem Oficial
                        </button>
                      )}
                    </div>
                    <input 
                      type="text" 
                      value={details.customHeaderImage || ''} 
                      onChange={e => setPartsData(prev => ({ 
                        ...prev, 
                        [selectedPart]: { 
                          ...prev[selectedPart], 
                          details: { ...prev[selectedPart].details, customHeaderImage: e.target.value } 
                        } 
                      }))}
                      placeholder={assemblyProgram.headerImage || 'https://...'}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-2xl text-xs font-mono text-gray-700 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all"
                    />
                    {(details.customHeaderImage || assemblyProgram.headerImage) && (
                      <div className="relative h-16 w-full rounded-xl overflow-hidden border border-gray-200 mt-1">
                        <Image
                          src={details.customHeaderImage || assemblyProgram.headerImage}
                          alt="Pré-visualização da Capa"
                          fill
                          className="object-cover object-center opacity-85"
                          unoptimized
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-2">
                          <span className="text-[9px] text-white font-bold tracking-wide">Pré-visualização da imagem</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                </div>
                <div className="p-4 sm:p-6 bg-amber-50/50 border-t border-amber-100 flex flex-col sm:flex-row gap-3">
                  {!isGuest && (
                    <button 
                      onClick={async () => {
                        const ok = await handleSave(true);
                        if (ok) setShowEditDetailsModal(false);
                      }}
                      disabled={isSaving}
                      className="flex-1 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl shadow-lg shadow-emerald-100 transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                      <span>Salvar Alterações</span>
                    </button>
                  )}
                  <button 
                    onClick={() => setShowEditDetailsModal(false)}
                    className="flex-1 py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-2xl transition-all active:scale-[0.98] cursor-pointer"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* Floating Save Bar (quando houver alterações não salvas) */}
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
                <span className="text-[10px] text-typography-400 font-mono truncate hidden sm:inline">
                  {selectedYear} • Assembleia {type === 'supt' ? 'CAco' : 'CAbr'}
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
          <div className="fixed inset-0 z-[1050] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm no-print">
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
                    {selectedYear} • Assembleia {type === 'supt' ? 'CAco' : 'CAbr'}
                  </span>
                </div>
              </div>

              <p className="text-xs sm:text-sm text-typography-500 leading-relaxed mb-5">
                Existem alterações não salvas nesta programação. O que deseja fazer antes de sair?
              </p>

              <div className="flex flex-col gap-2">
                <button 
                  onClick={async () => { 
                    await handleSave(false); 
                    setShowConfirmModal(false); 
                    if (pendingAction) pendingAction(); 
                  }} 
                  className="w-full py-2.5 sm:py-3 px-4 bg-primary-200 hover:bg-primary-150 text-white rounded-xl font-bold text-xs sm:text-sm shadow-xs transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
                >
                  <Save size={15} />
                  <span>Salvar e Continuar</span>
                </button>
                <button 
                  onClick={() => { 
                    setPartsData(JSON.parse(initialPartsData)); 
                    setShowConfirmModal(false); 
                    if (pendingAction) pendingAction(); 
                  }} 
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
