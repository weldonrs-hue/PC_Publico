'use client';

import { useState, useEffect } from 'react';
import { Landmark, ChevronLeft, Calendar, Clock, BookOpen, Music, Info, User, Save, AlertTriangle, Loader2, Printer, MapPin, CalendarDays, ChevronDown, ChevronUp, FileDown, FileText, Download, CheckCircle2, Circle, Plus, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, collection, getDocs, query, where, limit } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '@/utils/firestore';
import { useDialog } from '@/hooks/useDialog';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';

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
  year?: string;
}

const programsByYear = {
  '2024': [
    {
      day: 'Sexta-feira',
      title: 'SEXTA-FEIRA',
      color: '#0069b1', // JW Blue
      subtitle: 'Programa do congresso de 2024 — “Declare as Boas Novas!”',
      congressTheme: 'Declare as Boas Novas!',
      theme: '“Anunciem as boas novas da salvação por ele” — Salmo 96:2',
      headerImage: 'https://cms-imgp.jw-cdn.org/img/p/1102024194/univ/art/1102024194_univ_lsr_lg.jpg',
      sessions: [
        {
          period: 'Manhã',
          items: [
            { id: 'm0', title: 'PRESIDENTE DE SESSÃO', icon: User, isRole: true },
            { id: 'm1', time: '9:20', title: 'Vídeo musical', icon: Music, noSpeaker: true },
            { id: 'm2', time: '9:30', title: 'Cântico 101 e oração', icon: Music },
            { id: 'm3', time: '9:40', title: 'Por que precisamos de boas novas?', icon: BookOpen },
            { id: 'm4', time: '10:10', label: 'SÉRIE DE DISCURSOS:', title: 'As boas novas nos evangelhos', icon: BookOpen, noSpeaker: true, subitems: [{ id: 'm4_1', title: 'Mateus' }, { id: 'm4_2', title: 'Marcos' }, { id: 'm4_3', title: 'Lucas' }, { id: 'm4_4', title: 'João' }] },
            { id: 'm5', time: '11:05', title: 'Cântico 67 e anúncios', icon: Info, noSpeaker: true },
            { id: 'm6', time: '11:15', title: 'Por que não temos medo das más notícias?', icon: BookOpen },
            { id: 'm7', time: '11:35', label: 'DISCURSO DE ABERTURA:', title: '“Seu Pai, que observa em secreto, o recompensará”', icon: BookOpen },
            { id: 'm8', time: '12:05', title: 'Cântico 12 e intervalo', icon: Clock, noSpeaker: true }
          ]
        },
        {
          period: 'Tarde',
          items: [
            { id: 't0', title: 'PRESIDENTE DE SESSÃO', icon: User, isRole: true },
            { id: 't1', time: '1:20', title: 'Vídeo musical', icon: Music, noSpeaker: true },
            { id: 't2', time: '1:30', title: 'Cântico 102', icon: Music, noSpeaker: true },
            { id: 't3', time: '1:35', title: 'Não deixe as notícias falsas o enganar', icon: BookOpen },
            { id: 't4', time: '1:55', label: 'SÉRIE DE DISCURSOS:', title: 'Boas novas para todas as pessoas', icon: BookOpen, noSpeaker: true, subitems: [{ id: 't4_1', title: 'Pessoas de todas as nações' }, { id: 't4_2', title: 'Pessoas de todas as línguas' }] },
            { id: 't5', time: '2:40', title: 'Cântico 84 e anúncios', icon: Info, noSpeaker: true },
            { id: 't6', time: '2:50', label: 'VÍDEO PRINCIPAL:', title: 'A História e o Ministério de Jesus: Episódio 1', subtitle: '‘As Boas Novas Segundo Jesus’ (Parte 1)', icon: Calendar, noSpeaker: true },
            { id: 't7', time: '3:30', title: 'Cântico 134 e oração final', icon: Music }
          ]
        }
      ]
    },
    {
      day: 'Sábado',
      title: 'SÁBADO',
      color: '#00845a', // JW Green
      subtitle: 'Programa do congresso de 2024 — “Declare as Boas Novas!”',
      theme: '“Anunciem as boas novas da salvação por ele” — Salmo 96:2',
      headerImage: 'https://cms-imgp.jw-cdn.org/img/p/1102024195/univ/art/1102024195_univ_lsr_lg.jpg',
      sessions: [
        {
          period: 'Manhã',
          items: [
            { id: 'sat_m0', title: 'PRESIDENTE SÁBADO MANHÃ', icon: User, isRole: true },
            { id: 'sat_m1', time: '9:20', title: 'Vídeo musical', icon: Music, noSpeaker: true },
            { id: 'sat_m2', time: '9:30', title: 'Cântico 103 e oração', icon: Music },
            { id: 'sat_m3', time: '9:40', title: 'As boas novas e o cumprimento das profecias', icon: BookOpen },
            { id: 'sat_m4', time: '10:00', label: 'SÉRIE DE DISCURSOS:', title: 'A verdade sobre Jesus', icon: BookOpen, noSpeaker: true, subitems: [{ id: 'sat_m4_1', title: 'Seu nascimento' }, { id: 'sat_m4_2', title: 'Seu ministério' }, { id: 'sat_m4_3', title: 'Sua morte' }] },
            { id: 'sat_m5', time: '10:55', title: 'Cântico 88 e anúncios', icon: Info, noSpeaker: true },
            { id: 'sat_m6', time: '11:05', label: 'BATISMO:', title: '“Seu Pai, que observa em secreto, o recompensará”', icon: BookOpen },
            { id: 'sat_m7', time: '12:05', title: 'Cântico 52 e intervalo', icon: Clock, noSpeaker: true }
          ]
        },
        {
          period: 'Tarde',
          items: [
            { id: 'sat_t0', title: 'PRESIDENTE SÁBADO TARDE', icon: User, isRole: true },
            { id: 'sat_t1', time: '1:35', title: 'Vídeo musical', icon: Music, noSpeaker: true },
            { id: 'sat_t2', time: '1:45', title: 'Cântico 104', icon: Music, noSpeaker: true },
            { id: 'sat_t3', time: '1:50', title: 'Por que o mal ainda existe?', icon: BookOpen },
            { id: 'sat_t4', time: '2:15', label: 'SÉRIE DE DISCURSOS:', title: 'Use as boas novas para derrotar as más notícias', icon: BookOpen, noSpeaker: true, subitems: [{ id: 'sat_t4_1', title: 'Quando somos tentados' }, { id: 'sat_t4_2', title: 'Quando somos perseguidos' }, { id: 'sat_t4_3', title: 'Quando estamos ansiosos' }] },
            { id: 'sat_t5', time: '3:00', title: 'Cântico 105 e anúncios', icon: Info, noSpeaker: true },
            { id: 'sat_t6', time: '3:10', title: 'O que Jeová fará no futuro?', icon: BookOpen },
            { id: 'sat_t7', time: '4:00', title: 'Cântico 106 e oração final', icon: Music }
          ]
        }
      ]
    },
    {
      day: 'Domingo',
      title: 'DOMINGO',
      color: '#c01111', // JW Red
      subtitle: 'Programa do congresso de 2024 — “Declare as Boas Novas!”',
      theme: '“Apeguem-se firmemente às boas novas” — 1 Coríntios 15:2',
      headerImage: 'https://cms-imgp.jw-cdn.org/img/p/1102024196/univ/art/1102024196_univ_lsr_lg.jpg',
      sessions: [
        {
          period: 'Manhã',
          items: [
            { id: 'sun_m0', title: 'PRESIDENTE DOMINGO MANHÃ', icon: User, isRole: true },
            { id: 'sun_m1', time: '9:20', title: 'Vídeo musical', icon: Music, noSpeaker: true },
            { id: 'sun_m2', time: '9:30', title: 'Cântico 107 e oração', icon: Music },
            { id: 'sun_m3', time: '9:40', title: 'Apeguem-se às boas novas — Por quê?', icon: BookOpen },
            { id: 'sun_m4', time: '10:00', label: 'SÉRIE DE DISCURSOS:', title: 'Imite as mulheres que declararam as boas novas', icon: BookOpen, noSpeaker: true, subitems: [{ id: 'sun_m4_1', title: 'Sara' }, { id: 'sun_m4_2', title: 'Abigail' }, { id: 'sun_m4_3', title: 'Maria Madalena' }] },
            { id: 'sun_m5', time: '11:00', title: 'Cântico 108 e anúncios', icon: Info, noSpeaker: true },
            { id: 'sun_m6', time: '11:10', label: 'DISCURSO PARA O PÚBLICO:', title: 'Por que não devemos ter medo das más notícias?', icon: BookOpen },
            { id: 'sun_m7', time: '11:40', title: 'Resumo de A Sentinela', icon: BookOpen },
            { id: 'sun_m8', time: '12:10', title: 'Cântico 109 e intervalo', icon: Clock, noSpeaker: true }
          ]
        },
        {
          period: 'Tarde',
          items: [
            { id: 'sun_t0', title: 'PRESIDENTE DOMINGO TARDE', icon: User, isRole: true },
            { id: 'sun_t1', time: '1:35', title: 'Vídeo musical', icon: Music, noSpeaker: true },
            { id: 'sun_t2', time: '1:45', title: 'Cântico 110', icon: Music, noSpeaker: true },
            { id: 'sun_t3', time: '1:50', label: 'VÍDEO PRINCIPAL:', title: 'A História e o Ministério de Jesus: Episódio 1', subtitle: '‘As Boas Novas Segundo Jesus’ (Parte 2)', icon: Calendar, noSpeaker: true },
            { id: 'sun_t4', time: '2:40', title: 'Cântico 111 e anúncios', icon: Info, noSpeaker: true },
            { id: 'sun_t5', time: '2:50', title: '“Apeguem-se firmemente às boas novas”', icon: BookOpen },
            { id: 'sun_t6', time: '3:30', title: 'Cântico 112 e oração final', icon: Music }
          ]
        }
      ]
    }
  ],
  '2025': [
    {
      day: 'Sexta-feira',
      title: 'SEXTA-FEIRA',
      color: '#e65100', // JW Orange
      subtitle: 'Programa do congresso de 2025 — “A Adoração Pura!”',
      congressTheme: 'A Adoração Pura!',
      theme: '“Adore a Jeová, seu Deus” — Mateus 4:10',
      headerImage: 'https://cms-imgp.jw-cdn.org/img/p/1102025194/univ/art/1102025194_univ_lsr_lg.jpg',
      sessions: [
        {
          period: 'Manhã',
          items: [
            { id: 'm0', title: 'PRESIDENTE DE SESSÃO', icon: User, isRole: true },
            { id: 'm1', time: '9:20', title: 'Vídeo musical', icon: Music, noSpeaker: true },
            { id: 'm2', time: '9:30', title: 'Cântico e oração', icon: Music },
            { id: 'm3', time: '9:40', title: 'A importância da adoração pura hoje', icon: BookOpen },
            { id: 'm4', time: '10:00', label: 'SÉRIE DE DISCURSOS:', title: 'Imite os que apoiaram a adoração pura', icon: BookOpen, noSpeaker: true, subitems: [{ id: 'm4_1', title: 'Abel' }, { id: 'm4_2', title: 'Enoque' }, { id: 'm4_3', title: 'Noé' }, { id: 'm4_4', title: 'Abraão' }] },
            { id: 'm5', time: '11:05', title: 'Cântico e anúncios', icon: Info, noSpeaker: true },
            { id: 'm6', time: '11:15', title: 'Por que a adoração pura deve vir em primeiro lugar?', icon: BookOpen },
            { id: 'm7', time: '12:10', title: 'Cântico e intervalo', icon: Clock, noSpeaker: true }
          ]
        },
        {
          period: 'Tarde',
          items: [
            { id: 't0', title: 'PRESIDENTE DE SESSÃO', icon: User, isRole: true },
            { id: 't1', time: '1:35', title: 'Vídeo musical', icon: Music, noSpeaker: true },
            { id: 't2', time: '1:45', title: 'Cântico', icon: Music, noSpeaker: true },
            { id: 't3', time: '1:50', label: 'VÍDEO PRINCIPAL:', title: 'A História e o Ministério de Jesus: Episódio 2', subtitle: '‘A Minha Hora Ainda Não Chegou’ (Parte 1)', icon: Calendar, noSpeaker: true },
            { id: 't6', time: '3:00', title: 'Jeová quer que você o adore de modo puro', icon: BookOpen },
            { id: 't7', time: '3:30', title: 'Cântico e oração final', icon: Music }
          ]
        }
      ]
    },
    {
      day: 'Sábado',
      title: 'SÁBADO',
      color: '#0069b1', // JW Blue
      subtitle: 'Programa do congresso de 2025 — “A Adoração Pura!”',
      theme: '“O zelo pela tua casa me consumirá” — João 2:17',
      headerImage: 'https://cms-imgp.jw-cdn.org/img/p/1102025195/univ/art/1102025195_univ_lsr_lg.jpg',
      sessions: [
        {
          period: 'Manhã',
          items: [
            { id: 'sat_m0', title: 'PRESIDENTE SÁBADO MANHÃ', icon: User, isRole: true },
            { id: 'sat_m1', time: '9:20', title: 'Vídeo musical', icon: Music, noSpeaker: true },
            { id: 'sat_m2', time: '9:30', title: 'Cântico e oração', icon: Music },
            { id: 'sat_m3', time: '9:40', title: 'Lute para manter a sua adoração pura', icon: BookOpen },
            { id: 'sat_m4', time: '10:00', label: 'SÉRIE DE DISCURSOS:', title: 'Imite os profetas que defenderam a adoração pura', icon: BookOpen, noSpeaker: true, subitems: [{ id: 'sat_m4_1', title: 'Elias' }, { id: 'sat_m4_2', title: 'Eliseu' }, { id: 'sat_m4_3', title: 'Daniel' }, { id: 'sat_m4_4', title: 'Malaquias' }] },
            { id: 'sat_m6', time: '11:15', label: 'BATISMO:', title: 'O que você fará para apoiar a adoração pura?', icon: BookOpen },
            { id: 'sat_m7', time: '12:10', title: 'Cântico e intervalo', icon: Clock, noSpeaker: true }
          ]
        },
        {
          period: 'Tarde',
          items: [
            { id: 'sat_t0', title: 'PRESIDENTE SÁBADO TARDE', icon: User, isRole: true },
            { id: 'sat_t1', time: '1:35', title: 'Vídeo musical', icon: Music, noSpeaker: true },
            { id: 'sat_t2', time: '1:45', title: 'Cântico', icon: Music, noSpeaker: true },
            { id: 'sat_t3', time: '1:50', label: 'SÉRIE DE DISCURSOS:', title: 'Adore a Jeová de modo aceitável', icon: BookOpen, noSpeaker: true, subitems: [{ id: 'sat_t3_1', title: 'Com alegria' }, { id: 'sat_t3_2', title: 'Com verdade' }, { id: 'sat_t3_3', title: 'Com união' }] },
            { id: 'sat_t7', time: '4:30', title: 'Cântico e oração final', icon: Music }
          ]
        }
      ]
    },
    {
      day: 'Domingo',
      title: 'DOMINGO',
      color: '#c01111', // JW Red
      subtitle: 'Programa do congresso de 2025 — “A Adoração Pura!”',
      theme: '“Adorarão o Pai com espírito e verdade” — João 4:23',
      headerImage: 'https://cms-imgp.jw-cdn.org/img/p/1102025196/univ/art/1102025196_univ_lsr_lg.jpg',
      sessions: [
        {
          period: 'Manhã',
          items: [
            { id: 'sun_m0', title: 'PRESIDENTE DOMINGO MANHÃ', icon: User, isRole: true },
            { id: 'sun_m1', time: '9:20', title: 'Vídeo musical', icon: Music, noSpeaker: true },
            { id: 'sun_m2', time: '9:30', title: 'Cântico e oração', icon: Music },
            { id: 'sun_m3', time: '9:40', title: 'O futuro da adoração pura', icon: BookOpen },
            { id: 'sun_m4', time: '10:00', label: 'SÉRIE DE DISCURSOS:', title: 'Lições das cartas às sete congregações', icon: BookOpen, noSpeaker: true, subitems: [{ id: 'sun_m4_1', title: 'Éfeso' }, { id: 'sun_m4_2', title: 'Esmirna' }, { id: 'sun_m4_3', title: 'Pérgamo' }, { id: 'sun_m4_4', title: 'Tiatira' }, { id: 'sun_m4_5', title: 'Sardes' }, { id: 'sun_m4_6', title: 'Filadélfia' }, { id: 'sun_m4_7', title: 'Laodiceia' }] },
            { id: 'sun_m6', time: '11:10', label: 'DISCURSO PARA O PÚBLICO:', title: 'O que é adoração pura?', icon: BookOpen },
            { id: 'sun_m7', time: '11:40', title: 'Resumo de A Sentinela', icon: BookOpen },
            { id: 'sun_m8', time: '12:10', title: 'Cântico e intervalo', icon: Clock, noSpeaker: true }
          ]
        },
        {
          period: 'Tarde',
          items: [
            { id: 'sun_t0', title: 'PRESIDENTE DOMINGO TARDE', icon: User, isRole: true },
            { id: 'sun_t1', time: '1:35', title: 'Vídeo musical', icon: Music, noSpeaker: true },
            { id: 'sun_t2', time: '1:45', title: 'Cântico', icon: Music, noSpeaker: true },
            { id: 'sun_t3', time: '1:50', label: 'VÍDEO PRINCIPAL:', title: 'A História e o Ministério de Jesus: Episódio 2', subtitle: '‘A Minha Hora Ainda Não Chegou’ (Parte 2)', icon: Calendar, noSpeaker: true },
            { id: 'sun_t7', time: '3:45', title: 'Cântico e oração final', icon: Music }
          ]
        }
      ]
    }
  ],
  '2026': [
    {
      day: 'Sexta-feira',
      title: 'SEXTA-FEIRA',
      color: '#0069b1', // JW Blue
      subtitle: 'Programa do congresso de 2026 — “Felicidade Eterna!”',
      congressTheme: 'Felicidade Eterna!',
      theme: '“Felizes os que têm consciência de sua necessidade espiritual” — Mateus 5:3',
      headerImage: 'https://cms-imgp.jw-cdn.org/img/p/1102026194/univ/art/1102026194_univ_lsr_lg.jpg',
      sessions: [
        {
          period: 'Manhã',
          items: [
            { id: 'm0', title: 'PRESIDENTE DE SESSÃO', icon: User, isRole: true },
            { id: 'm1', time: '9:20', title: 'Vídeo musical', icon: Music, noSpeaker: true },
            { id: 'm2', time: '9:30', title: 'Cântico e oração', icon: Music },
            { id: 'm3', time: '9:40', label: 'DISCURSO DE ABERTURA:', title: 'Felicidade sem fim — Sonho ou realidade?', icon: BookOpen },
            { id: 'm4', time: '10:10', title: 'Como encontrar a verdadeira felicidade em um mundo infeliz?', icon: BookOpen },
            { id: 'm5', time: '11:05', title: 'Cântico e anúncios', icon: Info, noSpeaker: true },
            { id: 'm6', time: '11:15', label: 'SÉRIE DE DISCURSOS:', title: 'A felicidade que vem de servir a Jeová', icon: BookOpen, noSpeaker: true, subitems: [{ id: 'm6_1', title: 'Pioneiros' }, { id: 'm6_2', title: 'Missionários' }, { id: 'm6_3', title: 'Betelitas' }] },
            { id: 'm7', time: '12:10', title: 'Cântico e intervalo', icon: Clock, noSpeaker: true }
          ]
        },
        {
          period: 'Tarde',
          items: [
            { id: 't0', title: 'PRESIDENTE DE SESSÃO', icon: User, isRole: true },
            { id: 't1', time: '1:35', title: 'Vídeo musical', icon: Music, noSpeaker: true },
            { id: 't2', time: '1:45', title: 'Cântico', icon: Music, noSpeaker: true },
            { id: 't3', time: '1:50', label: 'VÍDEO PRINCIPAL:', title: 'A História e o Ministério de Jesus: Episódio 3', subtitle: '‘A Minha Hora Ainda Não Chegou’ (Parte 1)', icon: Calendar, noSpeaker: true },
            { id: 't6', time: '3:00', title: 'A felicidade eterna está ao seu alcance!', icon: BookOpen },
            { id: 't7', time: '3:30', title: 'Cântico e oração final', icon: Music }
          ]
        }
      ]
    },
    {
      day: 'Sábado',
      title: 'SÁBADO',
      color: '#00845a', // JW Green
      subtitle: 'Programa do congresso de 2026 — “Felicidade Eterna!”',
      theme: '“Há mais felicidade em dar do que em receber” — Atos 20:35',
      headerImage: 'https://cms-imgp.jw-cdn.org/img/p/1102026195/univ/art/1102026195_univ_lsr_lg.jpg',
      sessions: [
        {
          period: 'Manhã',
          items: [
            { id: 'sat_m0', title: 'PRESIDENTE SÁBADO MANHÃ', icon: User, isRole: true },
            { id: 'sat_m1', time: '9:20', title: 'Vídeo musical', icon: Music, noSpeaker: true },
            { id: 'sat_m2', time: '9:30', title: 'Cântico e oração', icon: Music },
            { id: 'sat_m3', time: '9:40', title: 'Dê generosamente e seja feliz', icon: BookOpen },
            { id: 'sat_m4', time: '10:00', label: 'SÉRIE DE DISCURSOS:', title: 'Imite os que deram de coração', icon: BookOpen, noSpeaker: true, subitems: [{ id: 'sat_m4_1', title: 'A viúva pobre' }, { id: 'sat_m4_2', title: 'Barnabé' }, { id: 'sat_m4_3', title: 'Tabita' }] },
            { id: 'sat_m6', time: '11:15', label: 'BATISMO:', title: 'A felicidade de se dedicar a Jeová', icon: BookOpen },
            { id: 'sat_m7', time: '12:10', title: 'Cântico e intervalo', icon: Clock, noSpeaker: true }
          ]
        },
        {
          period: 'Tarde',
          items: [
            { id: 'sat_t0', title: 'PRESIDENTE SÁBADO TARDE', icon: User, isRole: true },
            { id: 'sat_t1', time: '1:35', title: 'Vídeo musical', icon: Music, noSpeaker: true },
            { id: 'sat_t2', time: '1:45', title: 'Cântico', icon: Music, noSpeaker: true },
            { id: 'sat_t3', time: '1:50', label: 'SÉRIE DE DISCURSOS:', title: '“Felizes . . . ”', icon: BookOpen, noSpeaker: true, subitems: [{ id: 'sat_t3_1', title: 'Os misericordiosos' }, { id: 'sat_t3_2', title: 'Os puros de coração' }, { id: 'sat_t3_3', title: 'Os pacificadores' }] },
            { id: 'sat_t7', time: '4:30', title: 'Cântico e oração final', icon: Music }
          ]
        }
      ]
    },
    {
      day: 'Domingo',
      title: 'DOMINGO',
      color: '#c01111', // JW Red
      subtitle: 'Programa do congresso de 2026 — “Felicidade Eterna!”',
      theme: '“Felizes são os olhos de vocês porque veem e os seus ouvidos porque ouvem” — Mateus 13:16',
      headerImage: 'https://cms-imgp.jw-cdn.org/img/p/1102026196/univ/art/1102026196_univ_lsr_lg.jpg',
      sessions: [
        {
          period: 'Manhã',
          items: [
            { id: 'sun_m0', title: 'PRESIDENTE DOMINGO MANHÃ', icon: User, isRole: true },
            { id: 'sun_m1', time: '9:20', title: 'Vídeo musical', icon: Music, noSpeaker: true },
            { id: 'sun_m2', time: '9:30', title: 'Cântico e oração', icon: Music },
            { id: 'sun_m3', time: '9:40', title: 'O segredo da felicidade na família', icon: BookOpen },
            { id: 'sun_m6', time: '11:10', label: 'DISCURSO PARA O PÚBLICO:', title: 'Você pode ser feliz para sempre!', icon: BookOpen },
            { id: 'sun_m7', time: '11:40', title: 'Resumo de A Sentinela', icon: BookOpen },
            { id: 'sun_m8', time: '12:10', title: 'Cântico e intervalo', icon: Clock, noSpeaker: true }
          ]
        },
        {
          period: 'Tarde',
          items: [
            { id: 'sun_t0', title: 'PRESIDENTE DOMINGO TARDE', icon: User, isRole: true },
            { id: 'sun_t1', time: '1:35', title: 'Vídeo musical', icon: Music, noSpeaker: true },
            { id: 'sun_t2', time: '1:45', title: 'Cântico', icon: Music, noSpeaker: true },
            { id: 'sun_t3', time: '1:50', label: 'VÍDEO PRINCIPAL:', title: 'A História e o Ministério de Jesus: Episódio 3', subtitle: '‘A Minha Hora Ainda Não Chegou’ (Parte 2)', icon: Calendar, noSpeaker: true },
            { id: 'sun_t7', time: '3:45', title: 'Cântico e oração final', icon: Music }
          ]
        }
      ]
    }
  ]
};

export default function RegionalConventionView({ userId, isGuest = false, onBack }: RegionalConventionViewProps) {
  const { showAlert } = useDialog();
  const [selectedYear, setSelectedYear] = useState<'2024' | '2025' | '2026'>('2025');
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
    registerAssistant: '',
    congressAssistant: '',
    congressAssistants: [],
  });
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  const currentProgram = programsByYear[selectedYear];
  const currentDay = currentProgram[selectedDayIndex];
  const hasChanges = JSON.stringify(speakers) !== JSON.stringify(initialSpeakers) || 
                     JSON.stringify(confirmedSpeakers) !== JSON.stringify(initialConfirmedSpeakers) ||
                     JSON.stringify(details) !== JSON.stringify(initialDetails);

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
        }

        // Fetch templates
        const templatesSnapshot = await getDocs(collection(db, 'document_templates'));
        const fetchedTemplates: Record<string, any> = {};
        templatesSnapshot.forEach((doc) => {
          fetchedTemplates[doc.id] = doc.data();
        });
        setTemplates(fetchedTemplates);

        // Load year-specific data
        const docId = selectedYear === '2025' ? userId : `${userId}_${selectedYear}`;
        const docRef = doc(db, 'regional_convention_speakers', docId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          const loadedSpeakers = data.speakers || {};
          const loadedConfirmations = data.confirmations || {};
          const loadedDetails = {
            eventDate: data.details?.eventDate || '',
            eventLocation: data.details?.eventLocation || '',
            conventionTheme: data.details?.conventionTheme || (currentDay as any).congressTheme || currentDay.theme.split(' — ')[0].replace(/[“”]/g, ''),
            trainingDate: data.details?.trainingDate || '',
            trainingLocation: data.details?.trainingLocation || '',
            congressAssistant: data.details?.congressAssistant || '',
            congressAssistants: data.details?.congressAssistants || (data.details?.congressAssistant ? [data.details.congressAssistant] : []),
          };

          setSpeakers(loadedSpeakers);
          setInitialSpeakers(loadedSpeakers);
          setConfirmedSpeakers(loadedConfirmations);
          setInitialConfirmedSpeakers(loadedConfirmations);
          setDetails(loadedDetails);
          setInitialDetails(loadedDetails);
        } else {
          // Reset for new year
          setSpeakers({});
          setInitialSpeakers({});
          setConfirmedSpeakers({});
          setInitialConfirmedSpeakers({});
          const defaultDetails = {
            eventDate: '',
            eventLocation: '',
            conventionTheme: (currentDay as any).congressTheme || currentDay.theme.split(' — ')[0].replace(/[“”]/g, ''),
            trainingDate: '',
            trainingLocation: '',
            congressAssistant: '',
            congressAssistants: [],
          };
          setDetails(defaultDetails);
          setInitialDetails(defaultDetails);
        }
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [userId, selectedYear, currentDay.theme]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const docId = selectedYear === '2025' ? userId : `${userId}_${selectedYear}`;
      const docRef = doc(db, 'regional_convention_speakers', docId);
      await setDoc(docRef, { 
        speakers,
        confirmations: confirmedSpeakers,
        details,
        updatedAt: new Date().toISOString(),
        year: selectedYear
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

  const handleYearChange = (year: '2024' | '2025' | '2026') => {
    if (hasChanges) {
      setPendingAction(() => () => setSelectedYear(year));
      setShowConfirmModal(true);
    } else {
      setSelectedYear(year);
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
      
      const zip = new PizZip(bytes.buffer);
      
      // Pre-process all XML files in the zip to handle Word-specific tag splitting and @TAG replacement
      const xmlFiles = zip.file(/word\/(document|header\d+|footer\d+)\.xml/);
      xmlFiles.forEach(file => {
        let xmlContent = file.asText();
        // Remove spell check tags that often split @TAGS
        xmlContent = xmlContent.replace(/<w:proofErr w:type="(?:spell|gram)(?:Start|End)"\/>/g, "");
        xmlContent = xmlContent.replace(/<w:noProof\/>/g, "");
        
        // Join split tags
        for (let i = 0; i < 6; i++) {
          xmlContent = xmlContent.replace(/(@[A-Za-z0-9À-ÿ\u00C0-\u00FF\_\s]*)(<\/w:t>(?:<(?!w:p|w:tr|w:tbl|w:br|w:tc|w:tr)[^>]+>)*?<w:t[^>]*>)([A-Za-z0-9À-ÿ\u00C0-\u00FF\_\s]+)/g, "$1$3$2");
        }
        
        // Final cleaning of common split patterns
        xmlContent = xmlContent.replace(/(@[A-Za-z0-9À-ÿ\_]*)(<\/w:t><\/w:r><w:r><w:t>)/g, "$1");

        xmlContent = xmlContent.replace(/(<w:t[^>]*>)(.*?)(<\/w:t>)/g, (match, opening, text, closing) => {
          let newText = text;
          // Handle @Assinatura specially as an image tag
          newText = newText.replace(/@Assinatura([A-Za-z0-9À-ÿ\_]*\s*Global|_Global)?/gi, '[%ASSINATURA]');
          // Generic @TAG replacement
          newText = newText.replace(/(^|[^A-Za-z0-9À-ÿ\u00C0-\u00FF])@([A-Za-z0-9À-ÿ\_]+)/g, (m, p1, p2) => {
            return `${p1}[${p2.toUpperCase()}]`;
          });
          return `${opening}${newText}${closing}`;
        });
        zip.file(file.name, xmlContent);
      });

      const signatureImage = personalData?.signatureImage || '';
      const signatureName = personalData?.nome || '________________';
      const circuito = personalData?.circuito || '________________';
      const telefoneCircuito = personalData?.telefoneCircuito || personalData?.telefone || '________________';

      const replacements = {
        'ANO': selectedYear,
        'TEMA': details.conventionTheme || '________________',
        'DATA': details.eventDate || '________________',
        'LOCAL': details.eventLocation || '________________',
        'DESIGNAÇÃO': designation,
        'DESIGNACAO': designation,
        'DIA': currentDay.day.split('-')[0],
        'ORADOR': speakerName,
        'ASSINATURA': signatureImage,
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
        <Loader2 size={40} className="text-[#512da8] animate-spin" />
        <p className="text-gray-500 font-medium">Carregando programação...</p>
      </div>
    );
  }

  return (
    <div id="regional-convention-print-content" className="space-y-8 pb-12 print:p-0 print:space-y-4">
      {/* Print Styles */}
      <style jsx global>{`
        @media screen {
          .print-hero, .print-day-title, .print-theme-text, .print-session-header, .print-item-row, .print-subitem-row, .print-day-title-container {
            display: none !important;
          }
        }

        @media print {
          @page {
            size: A4 portrait;
            margin: 15mm;
          }
          body * {
            visibility: hidden;
          }
          #regional-convention-print-content, #regional-convention-print-content * {
            visibility: visible !important;
          }
          #regional-convention-print-content {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            display: block !important;
          }
          .no-print, .no-print * {
            display: none !important;
            visibility: hidden !important;
          }
          
          body {
            background: white !important;
            color: black !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          
          .print-hero {
            display: block !important;
            width: 100% !important;
            height: 180px !important;
            object-fit: cover !important;
            object-position: center 33% !important;
            margin-bottom: 2rem !important;
            border-radius: 8px !important;
          }

          .print-day-title-container {
            display: block !important;
            margin-bottom: 1.5rem !important;
          }

          .print-day-title {
            display: block !important;
            font-size: 28pt !important;
            font-weight: 800 !important;
            margin-bottom: 0.5rem !important;
            line-height: 1 !important;
            text-transform: uppercase !important;
            letter-spacing: -0.02em !important;
          }

          .print-theme-text {
            display: block !important;
            font-size: 12pt !important;
            font-style: italic !important;
            color: #374151 !important;
            line-height: 1.4 !important;
          }

          .print-session-header {
            display: block !important;
            font-size: 16pt !important;
            font-weight: 800 !important;
            margin-top: 2rem !important;
            margin-bottom: 1rem !important;
            text-transform: uppercase !important;
            border-bottom: 2px solid !important;
            padding-bottom: 4pt !important;
            letter-spacing: 0.05em !important;
          }

          .print-table {
            width: 100% !important;
            border: 1pt solid #e5e7eb !important;
          }

          .print-row {
            display: flex !important;
            border-bottom: 0.5pt solid #e5e7eb !important;
            break-inside: avoid !important;
            min-height: 32pt !important;
            align-items: center !important;
          }

          .print-cell-time {
            width: 50pt !important;
            padding: 6pt !important;
            font-size: 10pt !important;
            font-weight: 600 !important;
            border-right: 0.5pt solid #e5e7eb !important;
            flex-shrink: 0 !important;
            text-align: center !important;
            color: #4b5563 !important;
          }

          .print-cell-content {
            flex-grow: 1 !important;
            padding: 6pt 12pt !important;
            font-size: 10pt !important;
            line-height: 1.3 !important;
          }

          .print-cell-speaker {
            width: 180pt !important;
            padding: 6pt 12pt !important;
            font-size: 10pt !important;
            font-weight: 700 !important;
            text-align: left !important;
            flex-shrink: 0 !important;
            border-right: 0.5pt solid #e5e7eb !important;
            background-color: #f9fafb !important;
          }

          .print-title-bold {
            font-weight: 700 !important;
          }

          .print-label-small {
            font-size: 8pt !important;
            font-weight: 800 !important;
            text-transform: uppercase !important;
            margin-right: 6pt !important;
            letter-spacing: 0.025em !important;
          }

          .print-subitem-row {
            background-color: #fafafa !important;
            padding-left: 20pt !important;
          }
          
          .print-container {
            display: block !important;
            width: 100% !important;
            opacity: 1 !important;
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
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
              Congresso Regional {selectedYear}
              <div className="flex items-center bg-gray-100 rounded-lg p-0.5 no-print">
                {(['2024', '2025', '2026'] as const).map((year) => (
                  <button
                    key={year}
                    onClick={() => handleYearChange(year)}
                    className={`px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-md transition-all ${
                      selectedYear === year
                        ? 'bg-white text-violet-700 shadow-sm'
                        : 'text-gray-400 hover:text-gray-600'
                    }`}
                  >
                    {year}
                  </button>
                ))}
              </div>
              {isGuest && <span className="text-violet-500 text-sm font-black ml-2 bg-violet-50 px-3 py-1 rounded-full uppercase">Modo Assistente</span>}
            </h2>
            <div className="flex items-center gap-4 mt-1 overflow-x-auto scrollbar-hide pb-1">
              {currentProgram.map((day, idx) => (
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
          {hasChanges && !isGuest && (
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="group flex items-center h-10 w-10 hover:w-32 transition-all duration-500 ease-in-out rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 overflow-hidden whitespace-nowrap pl-[7px] hover:pl-4 disabled:opacity-50"
              title="Salvar Alterações"
            >
              {isSaving ? <Loader2 size={24} className="animate-spin shrink-0" /> : <Save size={24} className="shrink-0" />}
              <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 ml-2 font-black text-[10px] uppercase tracking-widest">Salvar</span>
            </button>
          )}
          {hasChanges && isGuest && (
            <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-amber-100 shadow-sm">
              <AlertTriangle size={14} />
              Apenas Visualização
            </div>
          )}
          <button
            onClick={handlePrint}
            className="group flex items-center h-10 w-10 hover:w-32 transition-all duration-500 ease-in-out rounded-full bg-white text-gray-600 shadow-md border border-gray-200 overflow-hidden whitespace-nowrap pl-[7px] hover:pl-4"
            title="Imprimir"
          >
            <Printer size={24} className="shrink-0" />
            <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 ml-2 font-black text-[10px] uppercase tracking-widest">Imprimir</span>
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
        
        {/* Overlay with some convention info if it exists */}
        {(details.eventDate || details.eventLocation || details.conventionTheme) && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6 text-white pt-10">
            {details.conventionTheme && (
              <div className="text-xl font-black uppercase tracking-tight mb-2 text-violet-300 drop-shadow-sm">
                {details.conventionTheme}
              </div>
            )}
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {details.eventDate && (
                <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider">
                  <CalendarDays size={18} className="text-white/70" />
                  {details.eventDate}
                </div>
              )}
              {details.eventLocation && (
                <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider">
                  <MapPin size={18} className="text-white/70" />
                  {details.eventLocation}
                </div>
              )}
            </div>
          </div>
        )}
      </motion.div>

      {/* Toggle Convention Details */}
      <div className="flex justify-center no-print">
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="flex items-center gap-2 px-6 py-2 bg-violet-100 hover:bg-violet-200 text-violet-700 rounded-full text-[10px] font-black uppercase tracking-widest transition-all border border-violet-200 shadow-sm hover:scale-105 active:scale-95"
        >
          {showDetails ? (
            <>
              <ChevronUp size={14} />
              Ocultar Informações Gerais
            </>
          ) : (
            <>
              <ChevronDown size={14} />
              Exibir Dados do Evento e Treinamento
            </>
          )}
        </button>
      </div>

      {/* Convention General Info Inputs */}
      <AnimatePresence>
        {showDetails && (
          <motion.div 
            initial={{ opacity: 0, height: 0, marginTop: 0 }}
            animate={{ opacity: 1, height: 'auto', marginTop: 0 }}
            exit={{ opacity: 0, height: 0, marginTop: 0 }}
            className="overflow-hidden no-print"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4">
              <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
                <h3 className="text-sm font-black text-[#512da8] uppercase tracking-widest flex items-center gap-2">
                  <Landmark size={18} />
                  Dados do Congresso
                </h3>
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Data do Evento</label>
                    <input 
                      type="text" 
                      placeholder="Ex: 12-14 de Junho, 2026"
                      value={details.eventDate}
                      disabled={isGuest}
                      onChange={(e) => setDetails(prev => ({ ...prev, eventDate: e.target.value }))}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold focus:bg-white outline-none transition-all placeholder:text-gray-300 disabled:opacity-60"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Local (Endereço)</label>
                    <input 
                      type="text" 
                      placeholder="Ex: Ginásio do Ibirapuera, São Paulo"
                      value={details.eventLocation}
                      disabled={isGuest}
                      onChange={(e) => setDetails(prev => ({ ...prev, eventLocation: e.target.value }))}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold focus:bg-white outline-none transition-all placeholder:text-gray-300 disabled:opacity-60"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Assistente(s) do Presidente do congresso</label>
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
                            className="flex-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold focus:bg-white outline-none transition-all placeholder:text-gray-300 disabled:opacity-60"
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
                              className="p-3 bg-red-50 text-red-500 hover:bg-red-100 rounded-2xl transition-all"
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
                          className="w-full py-2.5 bg-[#512da8]/5 text-[#512da8] hover:bg-[#512da8]/10 text-xs font-black uppercase tracking-wider rounded-2xl transition-all flex items-center justify-center gap-2 border border-dashed border-[#512da8]/20"
                        >
                          <Plus size={14} />
                          Adicionar Novo Assistente
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-violet-50 p-6 rounded-3xl border border-violet-100 shadow-sm space-y-4">
                <h3 className="text-sm font-black text-violet-600 uppercase tracking-widest flex items-center gap-2">
                  <BookOpen size={18} />
                  Treinamento
                </h3>
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-violet-400 uppercase tracking-widest ml-1">Data do Treinamento</label>
                    <input 
                      type="text" 
                      placeholder="Ex: 15 de Maio, 2026"
                      value={details.trainingDate}
                      disabled={isGuest}
                      onChange={(e) => setDetails(prev => ({ ...prev, trainingDate: e.target.value }))}
                      className="w-full px-4 py-3 bg-white border border-violet-100 rounded-2xl text-sm font-bold focus:bg-violet-50 outline-none transition-all placeholder:text-violet-200 disabled:opacity-60"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-violet-400 uppercase tracking-widest ml-1">Local do Treinamento</label>
                    <input 
                      type="text" 
                      placeholder="Ex: Salão do Reino Central"
                      value={details.trainingLocation}
                      disabled={isGuest}
                      onChange={(e) => setDetails(prev => ({ ...prev, trainingLocation: e.target.value }))}
                      className="w-full px-4 py-3 bg-white border border-violet-100 rounded-2xl text-sm font-bold focus:bg-violet-50 outline-none transition-all placeholder:text-violet-200 disabled:opacity-60"
                    />
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
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
                          <div className="flex items-center gap-2">
                            {confirmedSpeakers[item.id] && <CheckCircle2 size={12} className="shrink-0" />}
                            <span>{!item.noSpeaker && (speakers[item.id] || '')}</span>
                          </div>
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
                        <div className="w-64 shrink-0 flex flex-col gap-2">
                          {!item.noSpeaker && (
                            <>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => !isGuest && handleConfirmationToggle(item.id)}
                                  disabled={isGuest}
                                  className={`shrink-0 transition-all ${confirmedSpeakers[item.id] ? 'text-emerald-500 scale-110' : 'text-gray-300 hover:text-gray-400'} disabled:opacity-60 disabled:cursor-not-allowed`}
                                  title={confirmedSpeakers[item.id] ? "Confirmado" : "Confirmar designação"}
                                >
                                  {confirmedSpeakers[item.id] ? (
                                    <CheckCircle2 size={24} className="fill-emerald-50" />
                                  ) : (
                                    <Circle size={24} />
                                  )}
                                </button>
                                <div className="relative group flex-1">
                                  <input 
                                    type="text"
                                    placeholder="Orador..."
                                    value={speakers[item.id] || ''}
                                    disabled={isGuest}
                                    onChange={(e) => handleSpeakerChange(item.id, e.target.value)}
                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-xs font-medium focus:bg-white outline-none transition-all placeholder:text-gray-300 text-right disabled:opacity-60"
                                    style={{ 
                                      borderColor: speakers[item.id] ? (confirmedSpeakers[item.id] ? '#10b981' : currentDay.color) : undefined,
                                      borderWidth: speakers[item.id] ? '2px' : '1px'
                                    }}
                                  />
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => generateDocument(item, 'docx')}
                                  title="Baixar Word"
                                  className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-violet-50 hover:bg-violet-100 text-violet-700 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border border-violet-100 shadow-sm"
                                >
                                  <FileDown size={12} />
                                  Word
                                </button>
                              </div>
                            </>
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
                                  <div className="flex items-center gap-2">
                                    {confirmedSpeakers[sub.id] && <CheckCircle2 size={12} className="shrink-0" />}
                                    <span>{speakers[sub.id] || ''}</span>
                                  </div>
                                </div>
                                <div className="print-cell-time"></div>
                                <div className="print-cell-content">
                                  <div className="italic font-semibold text-gray-700">
                                    • {sub.title}
                                  </div>
                                </div>
                              </div>

                              {/* Speaker Input - Left Side (Hidden in Print) */}
                              <div className="w-64 shrink-0 no-print flex flex-col gap-2">
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => handleConfirmationToggle(sub.id)}
                                    className={`shrink-0 transition-all ${confirmedSpeakers[sub.id] ? 'text-emerald-500 scale-110' : 'text-gray-300 hover:text-gray-400'}`}
                                    title={confirmedSpeakers[sub.id] ? "Confirmado" : "Confirmar designação"}
                                  >
                                    {confirmedSpeakers[sub.id] ? (
                                      <CheckCircle2 size={24} className="fill-emerald-50" />
                                    ) : (
                                      <Circle size={24} />
                                    )}
                                  </button>
                                  <div className="relative group flex-1">
                                    <input 
                                      type="text"
                                      placeholder="Orador..."
                                      value={speakers[sub.id] || ''}
                                      onChange={(e) => handleSpeakerChange(sub.id, e.target.value)}
                                      className="w-full px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-xs font-medium focus:bg-white outline-none transition-all placeholder:text-gray-300 text-right"
                                      style={{ 
                                        borderColor: speakers[sub.id] ? (confirmedSpeakers[sub.id] ? '#10b981' : currentDay.color) : undefined,
                                        borderWidth: speakers[sub.id] ? '2px' : '1px'
                                      }}
                                    />
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => generateDocument(sub, 'docx')}
                                    title="Baixar Word"
                                    className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-violet-50 hover:bg-violet-100 text-violet-700 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border border-violet-100 shadow-sm"
                                  >
                                    <FileDown size={12} />
                                    Word
                                  </button>
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
