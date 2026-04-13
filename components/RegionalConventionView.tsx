'use client';

import { useState, useEffect } from 'react';
import { Landmark, ChevronLeft, Calendar, Clock, BookOpen, Music, Info, User, Save, AlertTriangle, Loader2, Printer } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '@/utils/firestore';

interface RegionalConventionViewProps {
  userId: string;
  onBack: () => void;
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
          { id: 't2', time: '1:45', title: 'Cântico 23', icon: Music, noSpeaker: true },
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
          { id: 'sat_t2', time: '1:45', title: 'Cântico 125', icon: Music, noSpeaker: true },
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
          { id: 'sun_t2', time: '1:45', title: 'Cântico 108', icon: Music, noSpeaker: true },
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

export default function RegionalConventionView({ userId, onBack }: RegionalConventionViewProps) {
  const [speakers, setSpeakers] = useState<Record<string, string>>({});
  const [initialSpeakers, setInitialSpeakers] = useState<Record<string, string>>({});
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  const currentDay = regionalConventionProgram[selectedDayIndex];
  const hasChanges = JSON.stringify(speakers) !== JSON.stringify(initialSpeakers);

  // Load data from Firestore and localStorage
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        // 1. Try Firestore
        const docRef = doc(db, 'regional_convention_speakers', userId);
        const docSnap = await getDoc(docRef);
        
        let loadedSpeakers = {};
        if (docSnap.exists()) {
          loadedSpeakers = docSnap.data().speakers || {};
        } else {
          // 2. Fallback to localStorage
          const localData = localStorage.getItem(`speakers_${userId}`);
          if (localData) {
            loadedSpeakers = JSON.parse(localData);
          }
        }
        
        setSpeakers(loadedSpeakers);
        setInitialSpeakers(loadedSpeakers);
      } catch (error) {
        console.error('Error loading speakers:', error);
        // Fallback to localStorage on error
        const localData = localStorage.getItem(`speakers_${userId}`);
        if (localData) {
          const parsed = JSON.parse(localData);
          setSpeakers(parsed);
          setInitialSpeakers(parsed);
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
    }
  }, [speakers, userId, isLoading]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const docRef = doc(db, 'regional_convention_speakers', userId);
      await setDoc(docRef, { 
        speakers,
        updatedAt: new Date().toISOString()
      });
      setInitialSpeakers(speakers);
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
    setShowConfirmModal(false);
    if (pendingAction) pendingAction();
  };

  const handleSpeakerChange = (id: string, value: string) => {
    setSpeakers(prev => ({ ...prev, [id]: value }));
  };

  const handlePrint = () => {
    window.print();
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
    <div className="space-y-8 pb-12 print:p-0 print:space-y-4">
      {/* Print Styles */}
      <style jsx global>{`
        /* Hide print elements on screen */
        .print-hero, .print-day-title, .print-theme-text, .print-session-header, .print-item-row, .print-subitem-row {
          display: none !important;
        }

        @media print {
          @page {
            size: A4;
            margin: 10mm;
          }
          body {
            background: white !important;
            color: black !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print {
            display: none !important;
          }
          
          .print-container {
            display: block !important;
            width: 100% !important;
            opacity: 1 !important;
            visibility: visible !important;
            transform: none !important;
          }

          .print-hero {
            display: block !important;
            width: 100% !important;
            height: auto !important;
            max-height: 150px !important;
            object-fit: cover !important;
            object-position: center 33% !important;
            margin-bottom: 1rem !important;
          }

          .print-day-title {
            display: block !important;
            font-size: 24pt !important;
            font-weight: 700 !important;
            margin-bottom: 0.2rem !important;
            line-height: 1 !important;
          }

          .print-theme-text {
            display: block !important;
            font-size: 11pt !important;
            font-style: italic !important;
            color: #4b5563 !important;
            margin-bottom: 1rem !important;
          }

          .print-session-header {
            display: block !important;
            font-size: 14pt !important;
            font-weight: 800 !important;
            margin-top: 1rem !important;
            margin-bottom: 0.5rem !important;
            text-transform: uppercase !important;
            border-bottom: 2px solid !important;
            padding-bottom: 2pt !important;
          }

          .print-table {
            width: 100% !important;
            border-collapse: collapse !important;
            border: 0.5pt solid #ccc !important;
          }

          .print-row {
            display: flex !important;
            border-bottom: 0.5pt solid #eee !important;
            break-inside: avoid !important;
            min-height: 22pt !important;
            align-items: center !important;
          }

          .print-cell-time {
            width: 45pt !important;
            padding: 4pt !important;
            font-size: 10pt !important;
            border-right: 0.5pt solid #eee !important;
            flex-shrink: 0 !important;
            text-align: center !important;
          }

          .print-cell-content {
            flex-grow: 1 !important;
            padding: 4pt 8pt !important;
            font-size: 10pt !important;
          }

          .print-cell-speaker {
            width: 160pt !important;
            padding: 4pt 8pt !important;
            font-size: 10pt !important;
            font-weight: 700 !important;
            text-align: left !important;
            flex-shrink: 0 !important;
            border-right: 0.5pt solid #eee !important;
          }

          .print-title-bold {
            font-weight: 700 !important;
          }

          .print-label-small {
            font-size: 8pt !important;
            font-weight: 800 !important;
            text-transform: uppercase !important;
            margin-right: 4pt !important;
          }

          .print-subitem-row {
            background-color: #fafafa !important;
          }
        }
      `}</style>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 no-print">
        <div className="flex items-center gap-4">
          <button 
            onClick={handleBackClick}
            className="p-2 hover:bg-gray-100 rounded-full transition-all text-[#512da8] bg-white shadow-md border border-gray-200"
            title="Voltar"
          >
            <ChevronLeft size={28} strokeWidth={3} />
          </button>
          <div className="min-w-0">
            <h2 className="text-2xl font-bold text-gray-800">
              Congresso Regional 2026
            </h2>
            <div className="flex items-center gap-4 mt-1 overflow-x-auto scrollbar-hide pb-1">
              {regionalConventionProgram.map((day, idx) => (
                <button
                  key={idx}
                  onClick={() => handleDayChange(idx)}
                  className={`text-sm font-bold transition-all pb-1 border-b-2 whitespace-nowrap shrink-0 ${
                    selectedDayIndex === idx 
                      ? 'border-current' 
                      : 'text-gray-400 border-transparent hover:text-gray-600'
                  }`}
                  style={{ color: selectedDayIndex === idx ? currentDay.color : undefined }}
                >
                  {day.day}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 self-start sm:self-center">
          <button
            onClick={handlePrint}
            className="p-2 hover:bg-gray-100 rounded-full transition-all text-gray-600 bg-white shadow-md border border-gray-200"
            title="Imprimir"
          >
            <Printer size={24} />
          </button>
        </div>
      </div>

      {/* Hero Image */}
      <motion.div 
        key={`hero-${selectedDayIndex}`}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative h-48 md:h-64 rounded-3xl overflow-hidden shadow-lg border border-gray-100 no-print"
      >
        <img 
          src={currentDay.headerImage} 
          alt="Congresso Regional"
          className="w-full h-full object-cover"
          style={{ objectPosition: 'center 33%' }}
          referrerPolicy="no-referrer"
        />
      </motion.div>
      <img 
        src={currentDay.headerImage} 
        alt="" 
        className="print-hero"
        referrerPolicy="no-referrer"
      />

      {/* Theme Section */}
      <motion.div 
        key={`theme-${selectedDayIndex}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="bg-white p-6 md:p-8 rounded-3xl border border-gray-100 shadow-sm text-center space-y-2 no-print"
      >
        <p className="text-lg md:text-xl font-medium text-gray-600 italic">
          {currentDay.theme}
        </p>
      </motion.div>

      {/* Print Header Info */}
      <div className="print-day-title-container">
        <h1 className="print-day-title" style={{ color: currentDay.color }}>{currentDay.title}</h1>
        <p className="print-theme-text">{currentDay.theme}</p>
      </div>

      {/* Program Sessions - Combined into a single card */}
      <motion.div 
        key={`program-${selectedDayIndex}`}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden print:bg-transparent print:border-none print:shadow-none print:rounded-none print-container"
      >
        <div className="print-container overflow-x-auto custom-scrollbar">
          <div className="min-w-[800px] md:min-w-full print:min-w-0">
            {currentDay.sessions.map((session, sIdx) => (
              <div key={sIdx} className="print:border-none">
                <div className="bg-gray-50/50 px-8 py-4 border-y border-gray-100 flex items-center justify-between no-print first:border-t-0">
                  <h5 className="text-lg font-black uppercase tracking-tight" style={{ color: currentDay.color }}>{session.period}</h5>
                  <Calendar className="text-gray-400" size={18} />
                </div>
                
                {/* Print Session Header */}
                <h2 className="print-session-header" style={{ color: currentDay.color }}>
                  {session.period}
                </h2>

                <div className="p-6 md:p-8 space-y-8 print:p-0 print:space-y-0 print:print-table">
                  <div className="space-y-8 print:space-y-0">
                    {session.items.map((item, iIdx) => (
                    <div key={iIdx} className="space-y-4 print:space-y-0 print:contents">
                      {/* Print Item Row */}
                      <div className="hidden print:flex print-row">
                        <div className="print-cell-speaker" style={{ color: currentDay.color }}>
                          {!item.noSpeaker && (speakers[item.id] || '')}
                        </div>
                        <div className="print-cell-time">{item.time || ''}</div>
                        <div className="print-cell-content">
                          <span className="print-title">
                            {item.label && <span className="print-label-small" style={{ color: currentDay.color }}>{item.label} </span>}
                            <span className={`${item.label || item.isRole ? '' : 'print-title-bold'} ${item.isRole ? 'text-[#512da8]' : ''}`}>
                              {item.title}
                            </span>
                          </span>
                          {item.subtitle && <div className="text-[8pt] italic font-medium mt-0.5">— {item.subtitle}</div>}
                        </div>
                      </div>

                      <div className="flex flex-row gap-4 md:gap-6 no-print">
                        {/* Speaker Input - Left Side */}
                        <div className="w-64 shrink-0">
                          {!item.noSpeaker && (
                            <div className="relative group">
                              <input 
                                type="text"
                                placeholder="Orador..."
                                value={speakers[item.id] || ''}
                                onChange={(e) => handleSpeakerChange(item.id, e.target.value)}
                                className="w-full px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-xs font-medium focus:bg-white outline-none transition-all placeholder:text-gray-300 text-right"
                                style={{ 
                                  borderColor: speakers[item.id] ? currentDay.color : undefined,
                                  borderWidth: speakers[item.id] ? '2px' : '1px'
                                }}
                              />
                            </div>
                          )}
                        </div>

                        <div className="flex flex-1 gap-4">
                          <div className="w-12 shrink-0 text-right pt-1">
                            <span className="text-sm font-bold text-gray-500">
                              {item.time || ''}
                            </span>
                          </div>
                          <div className="flex-1 space-y-2">
                            <div className="flex items-start gap-3">
                              <div className="flex-1">
                                <h6 className="text-base leading-tight text-gray-800">
                                  {item.label && <span className="font-bold mr-1" style={{ color: currentDay.color }}>{item.label}</span>}
                                  <span className={item.label || item.isRole ? 'font-medium' : 'font-bold'}>
                                    {item.isRole ? <span className="text-[#512da8] font-bold">{item.title}</span> : item.title}
                                  </span>
                                </h6>
                                {item.subtitle && (
                                  <p className="text-sm text-gray-700 font-bold italic mt-1">{item.subtitle}</p>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Subitems - Aligned with main items */}
                      {item.subitems && (
                        <div className="space-y-4 pt-2 print:space-y-0 print:pt-0 print:w-full print:contents">
                          {item.subitems.map((sub, subIdx) => (
                            <div key={subIdx} className="flex flex-row gap-4 md:gap-6 print:contents">
                              {/* Print Subitem Layout */}
                              <div className="hidden print:flex print-row print-subitem-row">
                                <div className="print-cell-speaker" style={{ color: currentDay.color }}>
                                  {speakers[sub.id] || ''}
                                </div>
                                <div className="print-cell-time"></div>
                                <div className="print-cell-content">
                                  <div className="italic font-semibold text-gray-700">
                                    • {sub.title}
                                  </div>
                                </div>
                              </div>

                              {/* Speaker Input - Left Side (Hidden in Print) */}
                              <div className="w-64 shrink-0 no-print">
                                <div className="relative group">
                                  <input 
                                    type="text"
                                    placeholder="Orador..."
                                    value={speakers[sub.id] || ''}
                                    onChange={(e) => handleSpeakerChange(sub.id, e.target.value)}
                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-xs font-medium focus:bg-white outline-none transition-all placeholder:text-gray-300 text-right"
                                    style={{ 
                                      borderColor: speakers[sub.id] ? currentDay.color : undefined,
                                      borderWidth: speakers[sub.id] ? '2px' : '1px'
                                    }}
                                  />
                                </div>
                              </div>
                              
                              <div className="flex flex-1 gap-4 no-print">
                                <div className="w-12 shrink-0"></div>
                                <div className="flex-1 pl-4 border-l-2" style={{ borderColor: `${currentDay.color}20` }}>
                                  <p className="text-sm text-gray-700 font-semibold">• {sub.title}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {showConfirmModal && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden"
            >
              <div className="p-8 text-center space-y-4">
                <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto text-orange-600">
                  <AlertTriangle size={32} />
                </div>
                <h3 className="text-xl font-bold text-gray-800">Alterações não salvas</h3>
                <p className="text-gray-600">Você fez alterações na lista de oradores. Deseja salvar antes de continuar?</p>
              </div>
              <div className="flex border-t border-gray-100">
                <button 
                  onClick={confirmDiscard}
                  className="flex-1 px-6 py-4 text-gray-500 font-bold hover:bg-gray-50 transition-colors border-r border-gray-100"
                >
                  Descartar
                </button>
                <button 
                  onClick={() => setShowConfirmModal(false)}
                  className="flex-1 px-6 py-4 text-gray-500 font-bold hover:bg-gray-50 transition-colors border-r border-gray-100"
                >
                  Cancelar
                </button>
                <button 
                  onClick={confirmSave}
                  className="flex-1 px-6 py-4 font-bold hover:bg-opacity-10 transition-colors"
                  style={{ color: currentDay.color, backgroundColor: `${currentDay.color}05` }}
                >
                  Salvar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
