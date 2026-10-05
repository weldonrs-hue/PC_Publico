'use client';

import CustomSelect from '@/components/CustomSelect';
import { useDialog } from '@/hooks/useDialog';
import { cleanPSSMetadata, formatDocxError } from '@/lib/docxUtils';
import { db } from '@/lib/firebase';
import { handleFirestoreError, OperationType } from '@/utils/firestore';
import Docxtemplater from 'docxtemplater';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  setDoc,
  where
} from 'firebase/firestore';
import {
  Check,
  CheckCircle2,
  Copy,
  FileDown,
  FileUp,
  HelpCircle,
  Loader2,
  Mail,
  Printer,
  RefreshCw,
  Settings2,
  Trash2,
  User,
  X
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import PizZip from 'pizzip';
import React, { useEffect, useRef, useState } from 'react';

export const EMR_TEMPLATES = [
  { id: 'emr_anfitria', name: 'Carta às congregações Anfitriãs' },
  { id: 'emr_convite', name: 'Carta convite' },
  { id: 'emr_instrutor', name: 'Carta ao Instrutor' },
];

const AVAILABLE_TAGS = [
  { tag: '[TURMA]', desc: 'Turma selecionada (ex: Turma 1)' },
  { tag: '[MODALIDADE]', desc: 'Anciãos ou Servos Ministeriais' },
  { tag: '[ESCOLA]', desc: 'Nome completo: Escola do Ministério do Reino de 2027 — ...' },
  { tag: '[DATA]', desc: 'Data da turma selecionada' },
  { tag: '[LOCAL]', desc: 'Local da Turma (Salão do Reino)' },
  { tag: '[ENDERECO]', desc: 'Endereço completo do local escolhido' },
  { tag: '[ANFITRIA]', desc: 'Congregação anfitriã da turma' },
  { tag: '[HORARIO_INICIO]', desc: 'Horário de início da escola' },
  { tag: '[HORARIO_FIM]', desc: 'Horário previsto para o término' },
  { tag: '[HORARIO_ESPOSAS]', desc: 'Horário especial para esposas' },
  { tag: '[INSTRUTORES]', desc: 'Nomes dos instrutores designados' },
  { tag: '[VIAJANTE]', desc: 'Nome do superintendente de circuito' },
  { tag: '[CIRCUITO]', desc: 'Identificação do circuito' },
  { tag: '[TELEFONE]', desc: 'Telefone de contato do circuito' },
  { tag: '[EMAIL]', desc: 'E-mail do circuito' },
  { tag: '[@ASSINATURA]', desc: 'Assinatura digitalizada em imagem ou texto' },
  { tag: '[HOJE]', desc: 'Data atual por extenso' },
  { tag: '[ANO]', desc: 'Ano da escola (ex: 2027)' },
  { tag: '[INSTRUTOR]', desc: 'Nome do instrutor (somente na Carta ao Instrutor)' },
  { tag: '[TITULO]', desc: 'Tema do discurso/parte designada' },
  { tag: '[N]', desc: 'Número do discurso/parte (ex: 1, 2, 3...)' },
  { tag: '[TEMA]', desc: 'Tema do discurso/parte designada' },
  { tag: '[NUMERO]', desc: 'Número do discurso/parte (ex: 1, 2, 3...)' },
  { tag: '[HORA]', desc: 'Horário de início da parte designada' },
  { tag: '[DURACAO]', desc: 'Duração da parte designada (ex: 25 min)' },
];

const EMR_ANCIANS_PROGRAM = {
  sessions: [
    { period: 'Parte 1', items: [
      { id: 'p1_1', time: '8:00', title: 'Cântico 101 e oração' },
      { id: 'p1_2', num: '1', time: '8:05', title: 'Bem-vindos à Escola do Ministério do Reino de 2027', duration: '15 min' },
      { id: 'p1_3', num: '2', time: '8:20', title: 'Vocês são “dignos de dupla honra”', duration: '25 min' },
      { id: 'p1_4_1', num: '3', time: '8:45', title: 'Jeová', duration: '25 min' },
      { id: 'p1_4_2', num: '4', time: '9:10', title: 'Jesus', duration: '25 min' },
      { id: 'p1_4_3', num: '5', time: '9:35', title: 'Outros anciãos e servos ministeriais', duration: '25 min' },
      { id: 'p1_4_4', num: '6', time: '10:00', title: 'Seus irmãos e irmãs', duration: '25 min' },
      { id: 'p1_6', num: '7', time: '10:40', title: 'Necessidades do território da nossa filial', duration: '20 min' },
      { id: 'p1_7', num: '8', time: '11:00', title: 'Faça bom uso do Pastoreiem o Rebanho de Deus', duration: '20 min' },
      { id: 'p1_8', num: '9', time: '11:20', title: '‘Lance toda a sua ansiedade’ sobre Jeová', duration: '25 min' },
    ]},
    { period: 'Parte 2', items: [
      { id: 'p2_2_1', num: '10', time: '1:05', title: 'Tire mais proveito do seu estudo pessoal', duration: '20 min' },
      { id: 'p2_2_2', num: '11', time: '1:25', title: 'Faça discursos motivadores', duration: '20 min' },
      { id: 'p2_2_3', num: '12', time: '1:45', title: 'Ensine com entusiasmo', duration: '20 min' },
      { id: 'p2_2_4', num: '13', time: '2:05', title: 'Peça e aceite conselhos práticos', duration: '20 min' },
      { id: 'p2_4', num: '14', time: '2:45', title: 'Mulheres de grande fé', duration: '35 min' },
      { id: 'p2_5', num: '15', time: '3:20', title: 'O que Jesus vê em você?', duration: '35 min' },
      { id: 'p2_6', time: '3:55', title: 'Cântico 107 e oração' },
    ]}
  ]
};

const EMR_SERVANTS_PROGRAM = {
  sessions: [
    { period: 'Parte 1', items: [
      { id: 's1_1', time: '8:00', title: 'Cântico 101 e oração' },
      { id: 's1_2', num: '1', time: '8:05', title: 'Bem-vindos à Escola do Ministério do Reino de 2027', duration: '15 min' },
      { id: 's1_3', num: '2', time: '8:20', title: 'Vocês são homens “cheios de espírito e de sabedoria”', duration: '25 min' },
      { id: 's1_4_1', num: '3', time: '8:45', title: 'Jeová', duration: '25 min' },
      { id: 's1_4_2', num: '4', time: '9:10', title: 'Jesus', duration: '25 min' },
      { id: 's1_4_3', num: '5', time: '9:35', title: 'Outros anciãos e servos ministeriais', duration: '25 min' },
      { id: 's1_4_4', num: '6', time: '10:00', title: 'Seus irmãos e irmãs', duration: '25 min' },
      { id: 's1_6', num: '7', time: '10:40', title: 'Cumpram suas responsabilidades como servos ministeriais', duration: '20 min' },
      { id: 's1_7', num: '8', time: '11:00', title: 'Continuem progredindo como homens espirituais', duration: '20 min' },
      { id: 's1_8', num: '9', time: '11:20', title: '‘Lance toda a sua ansiedade’ sobre Jeová', duration: '25 min' },
    ]},
    { period: 'Parte 2', items: [
      { id: 's2_2_1', num: '10', time: '1:05', title: 'Tire mais proveito do seu estudo pessoal', duration: '20 min' },
      { id: 's2_2_2', num: '11', time: '1:25', title: 'Faça discursos motivadores', duration: '20 min' },
      { id: 's2_2_3', num: '12', time: '1:45', title: 'Ensine com entusiasmo', duration: '20 min' },
      { id: 's2_2_4', num: '13', time: '2:05', title: 'Peça e aceite conselhos práticos', duration: '20 min' },
      { id: 's2_4', num: '14', time: '2:45', title: 'Mulheres de grande fé', duration: '35 min' },
      { id: 's2_5', num: '15', time: '3:20', title: 'O que Jesus vê em você?', duration: '35 min' },
      { id: 's2_6', time: '3:55', title: 'Cântico 107 e oração' },
    ]}
  ]
};

interface EMRLettersProps {
  userId: string;
  isAdmin?: boolean;
  canManage?: boolean;
  initialMode?: 'geracao' | 'manager';
  initialSchoolType?: 'ancians' | 'servants';
  initialTurma?: '1' | '2' | '3';
  initialPartId?: string;
}

export default function EMRLetters({
  userId,
  isAdmin,
  canManage,
  initialMode = 'geracao',
  initialSchoolType,
  initialTurma,
  initialPartId
}: EMRLettersProps) {
  const { showAlert, showConfirm } = useDialog();
  const [selectedTemplate, setSelectedTemplate] = useState<string>(initialPartId ? 'emr_carta_orador' : EMR_TEMPLATES[0].id);
  const [selectedSchoolType, setSelectedSchoolType] = useState<'ancians' | 'servants'>(initialSchoolType || 'ancians');
  const [selectedTurma, setSelectedTurma] = useState<'1' | '2' | '3'>(initialTurma || '1');
  const [selectedPartId, setSelectedPartId] = useState<string>(initialPartId || '');

  const [templates, setTemplates] = useState<Record<string, { name?: string; content: string; updatedAt: string; isPrivate?: boolean }>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [processedDocBuffer, setProcessedDocBuffer] = useState<ArrayBuffer | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  // Data states
  const [personalData, setPersonalData] = useState<any>(null);
  const [emrAnciansData, setEmrAnciansData] = useState<any>(null);
  const [emrServantsData, setEmrServantsData] = useState<any>(null);

  // Management state
  const [isManaging, setIsManaging] = useState(initialMode === 'manager' && (isAdmin || canManage));
  const [file, setFile] = useState<File | null>(null);
  const [localFileBuffer, setLocalFileBuffer] = useState<ArrayBuffer | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveAsGlobal, setSaveAsGlobal] = useState(false);
  const [showTagsHelp, setShowTagsHelp] = useState(false);
  const [copiedTag, setCopiedTag] = useState<string | null>(null);

  const [isViewerReady, setIsViewerReady] = useState(false);
  const viewerRef = useRef<any>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize UDoc Viewer
  useEffect(() => {
    let destroyed = false;

    const initViewer = async () => {
      for (let i = 0; i < 20; i++) {
        if (previewRef.current) break;
        await new Promise(r => setTimeout(r, 75));
      }

      if (!previewRef.current || destroyed) return;

      try {
        const { getUDocClient } = await import('@/lib/udoc');
        const client = await getUDocClient();

        if (destroyed) return;

        const viewer = await client.createViewer({
          container: previewRef.current,
          theme: 'light',
          hideToolbar: false,
          disableLeftPanel: false,
          disableRightPanel: true,
          scrollMode: 'continuous',
          layoutMode: 'single-page',
          zoomMode: 'fit-page-width',
          dpi: 96,
          // @ts-ignore
          renderMode: 'paged'
        });

        if (!destroyed) {
          viewerRef.current = viewer;

          try {
            await (viewer as any).setViewMode('paged');
            await (viewer as any).setZoomMode('fit-page-width');
            await (viewer as any).setScrollMode('continuous');
          } catch (e) {}

          setTimeout(() => {
            if (!destroyed && viewerRef.current) {
              setIsViewerReady(true);
            }
          }, 600);
        }
      } catch (err: any) {
        console.error('UDoc Viewer Init Error EMR:', err);
      }
    };

    if (!viewerRef.current) {
      initViewer();
    }

    // Observe container size changes so UDoc re-layouts on mobile / orientation changes
    let resizeObserver: ResizeObserver | null = null;
    if (previewRef.current && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        if (viewerRef.current) {
          try {
            (viewerRef.current as any).setZoomMode('fit-page-width');
          } catch (e) {}
        }
      });
      resizeObserver.observe(previewRef.current);
    }

    return () => {
      destroyed = true;
      setIsViewerReady(false);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (viewerRef.current) {
        try {
          const v = viewerRef.current;
          viewerRef.current = null;
          v.destroy();
        } catch (e) {
          console.warn('Error destroying viewer:', e);
        }
      }
    };
  }, []);

  // Update document in viewer
  useEffect(() => {
    let active = true;
    const updateDoc = async () => {
      if (isViewerReady && viewerRef.current && processedDocBuffer) {
        const buffer = processedDocBuffer instanceof ArrayBuffer 
          ? processedDocBuffer 
          : (processedDocBuffer as any).buffer instanceof ArrayBuffer 
            ? (processedDocBuffer as any).buffer 
            : null;

        if (!buffer || buffer.byteLength === 0 || !active) return;

        setIsProcessing(true);
        try {
          if (!viewerRef.current || typeof viewerRef.current.load !== 'function') {
            throw new Error('Viewer not ready');
          }
          const loadData = new Uint8Array(buffer);
          await viewerRef.current.load(loadData);
          try {
            await (viewerRef.current as any).setZoomMode('fit-page-width');
          } catch (e) {}
        } catch (err: any) {
          if (!active) return;
          console.error('UDoc Viewer Load Error (EMR):', err);
        } finally {
          if (active) setIsProcessing(false);
        }
      }
    };

    updateDoc();
    return () => { active = false; };
  }, [processedDocBuffer, isViewerReady]);

  // Real-time templates listener for EMR category
  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, 'document_templates'), where('category', '==', 'emr'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedTemplates: Record<string, any> = {};
      snapshot.forEach((docSnap) => {
        fetchedTemplates[docSnap.id] = docSnap.data();
      });

      const consolidated: Record<string, any> = {};
      EMR_TEMPLATES.forEach(t => {
        const privateId = `${userId}_${t.id}`;
        const globalId = t.id;

        if (fetchedTemplates[privateId]) {
          consolidated[t.id] = { ...fetchedTemplates[privateId], isPrivate: true };
        } else if (fetchedTemplates[globalId]) {
          consolidated[t.id] = { ...fetchedTemplates[globalId], isPrivate: false };
        }
      });

      setTemplates(consolidated);
      setLoading(false);
    }, (error) => {
      console.error('Error listening to EMR templates:', error);
      handleFirestoreError(error, OperationType.GET, 'document_templates');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userId]);

  // Load personal data and EMR data (both Anciãos and Servos)
  useEffect(() => {
    if (!userId) return;

    const unsubPersonal = onSnapshot(doc(db, 'personal_data', userId), (snap) => {
      if (snap.exists()) setPersonalData(snap.data());
    });

    const unsubAncians = onSnapshot(doc(db, 'emr_ancians_data', userId), (snap) => {
      if (snap.exists()) setEmrAnciansData(snap.data());
    });

    const unsubServants = onSnapshot(doc(db, 'emr_servants_data', userId), (snap) => {
      if (snap.exists()) setEmrServantsData(snap.data());
    });

    return () => {
      unsubPersonal();
      unsubAncians();
      unsubServants();
    };
  }, [userId]);

  // Re-generate preview when dependencies change
  useEffect(() => {
    if (localFileBuffer) {
      processAndPreview(localFileBuffer);
    } else if (templates[selectedTemplate]) {
      processAndPreview();
    } else {
      setProcessedDocBuffer(null);
      setStatus('idle');
    }
  }, [
    selectedTemplate, 
    templates, 
    localFileBuffer, 
    selectedSchoolType, 
    selectedTurma, 
    selectedPartId,
    personalData, 
    emrAnciansData, 
    emrServantsData
  ]);

  // Print modal choice interceptor
  useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof HTMLElement) {
            const modal = node.classList.contains('udoc-modal') ? node : node.querySelector('.udoc-modal');
            if (modal) {
              const titleNode = modal.querySelector('.udoc-modal-title');
              if (titleNode && (titleNode.textContent?.toLowerCase().includes('imprimir') || titleNode.textContent?.toLowerCase().includes('print'))) {
                const body = modal.querySelector('.udoc-modal-body') || modal.querySelector('[class*="body"]');
                if (body && !body.querySelector('.custom-printer-selector')) {
                  const selectorDiv = document.createElement('div');
                  selectorDiv.className = 'custom-printer-selector mt-4 pt-4 border-t border-gray-100';
                  selectorDiv.innerHTML = `
                    <label class="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Destino / Impressora</label>
                    <div class="relative group">
                      <select id="modal-printer-choice" class="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-[11px] font-bold text-gray-700 outline-none focus:border-blue-500 transition-all appearance-none cursor-pointer">
                        <option value="system">Impressora Física (Sistema)</option>
                        <option value="pdf">Salvar como PDF (Alta Definição)</option>
                      </select>
                      <div class="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 group-hover:text-blue-500 transition-colors">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                      </div>
                    </div>
                    <p class="text-[9px] text-gray-400 font-medium mt-2 leading-tight">
                      * A escolha da impressora física específica será confirmada no próximo passo.
                    </p>
                  `;
                  body.appendChild(selectorDiv);

                  const footer = modal.querySelector('.udoc-modal-footer') || modal.querySelector('[class*="footer"]');
                  if (footer) {
                    const buttons = footer.querySelectorAll('button');
                    buttons.forEach(btn => {
                      const btnText = btn.textContent?.toLowerCase() || '';
                      if (btnText.includes('imprimir') || btnText.includes('print')) {
                        if (!btn.hasAttribute('data-enhanced-print-v2')) {
                          btn.setAttribute('data-enhanced-print-v2', 'true');
                          btn.addEventListener('click', (e) => {
                            const choice = (document.getElementById('modal-printer-choice') as HTMLSelectElement)?.value;
                            if (choice === 'pdf') {
                              e.preventDefault();
                              e.stopPropagation();
                              const closeBtn = modal.querySelector('.udoc-modal-close') as HTMLElement;
                              if (closeBtn) closeBtn.click();
                              downloadAsPdf();
                            }
                          }, true);
                        }
                      }
                    });
                  }
                }
              }
            }
          }
        });
      });
    });

    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  const getReplacements = (signatureImage: string) => {
    const now = new Date();
    const hoje = new Intl.DateTimeFormat('pt-BR', { 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    }).format(now);

    const turmaIdx = parseInt(selectedTurma) - 1;
    const currentSchoolData = selectedSchoolType === 'ancians' ? emrAnciansData : emrServantsData;
    const turmaData = currentSchoolData?.parts?.[turmaIdx] || {};
    const details = turmaData.details || {};
    const speakers = turmaData.speakers || {};

    const travelerName = personalData?.nome || '________________';
    const circuit = personalData?.circuito || '________________';
    const telefoneCircuito = personalData?.telefoneCircuito || personalData?.telefone || '________________';
    const emailCircuito = personalData?.email || '________________';

    const hasImage = Boolean(signatureImage && typeof signatureImage === 'string' && signatureImage.startsWith('data:image'));
    const signatureText = `${travelerName} (${circuit})`;
    const signatureValue = hasImage ? signatureImage : signatureText;

    const dataEscola = details.data || hoje;
    const localEscola = details.local || '________________';
    const enderecoEscola = details.endereco || '________________';
    const anfitria = details.anfitria || '________________';
    const horarioInicio = details.horarioInicio || '________________';
    const horarioFim = details.horarioFim || '________________';
    const horarioEsposas = details.horarioEsposas || '________________';
    const modalidade = selectedSchoolType === 'ancians' ? 'Anciãos' : 'Servos Ministeriais';
    const modalidadeCompleta = selectedSchoolType === 'ancians' 
      ? 'Escola do Ministério do Reino de 2027 — Anciãos' 
      : 'Escola do Ministério do Reino de 2027 — Servos Ministeriais';

    const instrutor1 = selectedSchoolType === 'ancians' ? (speakers['p1_2'] || '') : (speakers['s1_2'] || '');
    const instrutor2 = selectedSchoolType === 'ancians' ? (speakers['p1_3'] || '') : (speakers['s1_3'] || '');
    const cong1 = selectedSchoolType === 'ancians' ? (turmaData.congregations?.['p1_2'] || '') : (turmaData.congregations?.['s1_2'] || '');
    const cong2 = selectedSchoolType === 'ancians' ? (turmaData.congregations?.['p1_3'] || '') : (turmaData.congregations?.['s1_3'] || '');

    const allSpeakersList = Object.values(speakers).filter(Boolean) as string[];
    const uniqueSpeakersWithCong = Array.from(new Set(Object.keys(speakers).filter(k => speakers[k]).map(k => {
      const s = speakers[k];
      const c = turmaData.congregations?.[k];
      return c ? `${s} — ${c}` : s;
    })));

    const uniqueSpeakers = Array.from(new Set(allSpeakersList));
    const instrutoresLista = uniqueSpeakersWithCong.length > 0
      ? uniqueSpeakersWithCong.join(', ')
      : (instrutor1 && instrutor2 ? `${instrutor1}${cong1 ? ` — ${cong1}` : ''} e ${instrutor2}${cong2 ? ` — ${cong2}` : ''}` : (instrutor1 || instrutor2 || '________________'));

    // Speaker specific data
    let speakerName = '________________';
    let speakerCongregation = '________________';
    let partTheme = '________________';
    let partNum = '________________';
    let partTime = '________________';
    let partDuration = '________________';

    if (selectedPartId) {
      speakerName = speakers[selectedPartId] || '________________';
      speakerCongregation = (turmaData.congregations?.[selectedPartId]) || '________________';
      const program = selectedSchoolType === 'ancians' ? EMR_ANCIANS_PROGRAM : EMR_SERVANTS_PROGRAM;
      
      program.sessions.forEach(s => {
        s.items.forEach(item => {
          if (item.id === selectedPartId) {
            partTheme = item.title;
            partNum = item.num || '';
            partTime = item.time;
            partDuration = item.duration || '';
          }
          if ((item as any).subitems) {
            (item as any).subitems.forEach((sub: any) => {
              if (sub.id === selectedPartId) {
                partTheme = `${(item as any).label || 'Série de discursos:'} ${item.title} — ${sub.title}`;
                partNum = sub.num || '';
                partTime = sub.time;
                partDuration = sub.duration || '';
              }
            });
          }
        });
      });
    }

    return {
      'TURMA': `Turma ${selectedTurma}`,
      'MODALIDADE': modalidade,
      'ESCOLA': modalidadeCompleta,
      'TIPO_ESCOLA': modalidade,
      'TEMA': selectedPartId ? partTheme : modalidadeCompleta,
      'TITULO': selectedPartId ? partTheme : modalidadeCompleta,
      'DESIGNACAO': selectedPartId ? partTheme : modalidadeCompleta,
      'DESIGNAÇÃO': selectedPartId ? partTheme : modalidadeCompleta,
      'ANO': '2027',
      'DATA': dataEscola,
      'DATA_TURMA': dataEscola,
      'DATATURMA': dataEscola,
      'TURMA_DATA': dataEscola,
      'LOCAL': localEscola,
      'LOCAL_ESCOLA': localEscola,
      'LOCALESCOLA': localEscola,
      'ENDERECO': enderecoEscola,
      'ENDEREÇO': enderecoEscola,
      'ANFITRIA': anfitria,
      'CONGREGACAO_ANFITRIA': anfitria,
      'HORARIO_INICIO': horarioInicio,
      'HORARIO_FIM': horarioFim,
      'HORARIO_FINAL': horarioFim,
      'HORARIO_ESPOSAS': horarioEsposas,
      'HORARIO': `${horarioInicio} às ${horarioFim}`,
      'INSTRUTORES': instrutoresLista,
      'ORADOR': speakerCongregation && speakerCongregation !== '________________' ? `${speakerName} — ${speakerCongregation}` : speakerName,
      'INSTRUTOR': speakerCongregation && speakerCongregation !== '________________' ? `${speakerName} — ${speakerCongregation}` : speakerName,
      'CONGREGACAO': speakerCongregation,
      'CONGREGAÇÃO': speakerCongregation,
      'CONGREGACAO_INSTRUTOR': speakerCongregation,
      'NUMERO': partNum,
      'N': partNum,
      'HORA': partTime,
      'DURACAO': partDuration,
      'TEMPO': partDuration,
      'TEMA_DISCURSO': partTheme,
      'NUMERO_DISCURSO': partNum,
      'HORARIO_DISCURSO': partTime,
      'DURACAO_DISCURSO': partDuration,
      'INSTRUTOR1': instrutor1 ? (cong1 ? `${instrutor1} — ${cong1}` : instrutor1) : '________________',
      'INSTRUTOR2': instrutor2 ? (cong2 ? `${instrutor2} — ${cong2}` : instrutor2) : '________________',
      'INSTRUTORA': instrutor1 ? (cong1 ? `${instrutor1} — ${cong1}` : instrutor1) : '________________',
      'INSTRUTORB': instrutor2 ? (cong2 ? `${instrutor2} — ${cong2}` : instrutor2) : '________________',
      'VIAJANTE': travelerName,
      'viajante': travelerName,
      'NOME': travelerName,
      'nome': travelerName,
      'CIRCUITO': circuit,
      'circuito': circuit,
      'TELEFONE': telefoneCircuito,
      'FONE': telefoneCircuito,
      'TELEFONE_CIRCUITO': telefoneCircuito,
      'EMAIL': emailCircuito,
      'HOJE': hoje,
      'DATA_ATUAL': hoje,
      'ASSINATURA': signatureValue,
      'assinatura': signatureValue,
      'ASSINATURA_GLOBAL': signatureValue,
      'assinatura_global': signatureValue,
      '%ASSINATURA': hasImage ? signatureValue : '',
      '%assinatura': hasImage ? signatureValue : '',
      '%ASSINATURA_GLOBAL': hasImage ? signatureValue : '',
      '%assinatura_global': hasImage ? signatureValue : '',
    };
  };

  const processAndPreview = async (overrideBuffer?: ArrayBuffer) => {
    let sourceBuffer: ArrayBuffer;

    if (overrideBuffer) {
      sourceBuffer = overrideBuffer;
    } else {
      const template = templates[selectedTemplate];
      if (!template || !template.content) return;

      const binaryString = window.atob(template.content);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      sourceBuffer = bytes.buffer;
    }

    setIsProcessing(true);
    setStatus('idle');

    try {
      const ImageModule = (await import('docxtemplater-image-module-free')).default;
      const signatureImage = personalData?.signatureImage || '';
      const hasImage = Boolean(signatureImage && typeof signatureImage === 'string' && signatureImage.startsWith('data:image'));

      const signatureScale = personalData?.signatureSize || 60;
      let sigHeight = signatureScale;
      let sigWidth = sigHeight * 2.5; // Default aspect ratio

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
            const binaryString = window.atob(base64Data);
            const len = binaryString.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            return bytes;
          } catch (e) {
            console.error('Error decoding signature image in EMR:', e);
            return null;
          }
        },
        getSize: () => [sigWidth, sigHeight],
      };

      const cleanedBuffer = cleanPSSMetadata(sourceBuffer);
      const zip = new PizZip(cleanedBuffer);

      // Pre-process Word XML files
      const xmlFiles = zip.file(/word\/(document|header\d+|footer\d+)\.xml/);
      xmlFiles.forEach(xmlResource => {
        let xmlContent = xmlResource.asText();

        // Safely inject required namespaces for images without duplication
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

        // Join split tags: [TA + G] or @TA + G
        for (let i = 0; i < 6; i++) {
          xmlContent = xmlContent.replace(/(@|\[[#\/^>?]?)([A-Za-z0-9À-ÿ\u00C0-\u00FF\_]*)(<\/w:t>(?:<(?!w:p|w:tr|w:tbl|w:br|w:tc|w:tr)[^>]+>)*?<w:t[^>]*>)([A-Za-z0-9À-ÿ\u00C0-\u00FF\_]+|\])/g, "$1$2$4$3");
        }

        xmlContent = xmlContent.replace(/(<w:t[^>]*>)(.*?)(<\/w:t>)/g, (match: string, opening: string, text: string, closing: string) => {
          let newText = text;
          
          // Unified Signature Handling
          const sigRegex = /@Assinatura(?:[\s\_]Global)?|\[%?ASSINATURA(?:[\s\_]Global)?\]/gi;
          if (hasImage) {
            newText = newText.replace(sigRegex, '[%ASSINATURA]');
          } else {
            newText = newText.replace(sigRegex, '[ASSINATURA]');
          }
          
          // Replace other @TAGs
          newText = newText.replace(/(^|[\s\W])@([A-Za-z0-9À-ÿ\_]+)/g, (m: string, p1: string, p2: string) => {
            const tagName = p2.toUpperCase();
            if (tagName === 'ASSINATURA') return m; // Already handled
            return `${p1}[${tagName}]`;
          });
          
          return `${opening}${newText}${closing}`;
        });
        zip.file(xmlResource.name, xmlContent);
      });

      const replacements = getReplacements(signatureImage);

      const docReal = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
        delimiters: { start: '[', end: ']' },
        modules: ImageModule ? [new ImageModule(imgOpts)] : [],
        nullGetter: () => ''
      });

      docReal.render(replacements);
      const outReal = docReal.getZip().generate({
        type: 'arraybuffer'
      });

      setProcessedDocBuffer(outReal);
      setStatus('success');
    } catch (err: any) {
      console.error('Error processing EMR DOCX:', formatDocxError(err), err);
      setStatus('error');
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadAsDocx = () => {
    if (!processedDocBuffer) return;
    const blob = new Blob([processedDocBuffer], { 
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const templateName = EMR_TEMPLATES.find(t => t.id === selectedTemplate)?.name || selectedTemplate;
    const modalidadeSufixo = selectedSchoolType === 'ancians' ? 'Anciaos' : 'Servos';
    
    let filename = `${templateName}_${modalidadeSufixo}.docx`;
    if (selectedTemplate === 'emr_carta_orador' && selectedPartId) {
      const part = partsWithSpeakers.find(p => p.id === selectedPartId);
      if (part) {
        filename = `Carta_${part.speaker.replace(/\s+/g, '_')}_EMR.docx`;
      }
    }
    
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadAsPdf = async () => {
    if (!viewerRef.current || status !== 'success') return;

    setGenerating(true);
    try {
      const templateName = EMR_TEMPLATES.find(t => t.id === selectedTemplate)?.name || selectedTemplate;
      const modalidadeSufixo = selectedSchoolType === 'ancians' ? 'Anciaos' : 'Servos';
      const filename = `${templateName}_${modalidadeSufixo}.pdf`;

      const viewer = viewerRef.current;
      if (viewer && typeof viewer.renderPage === 'function') {
        const { jsPDF } = await import('jspdf');
        const pageCount = viewer.pageCount;

        if (pageCount > 0) {
          const firstPage = await viewer.getPageInfo(0);
          const pdf = new jsPDF({
            orientation: firstPage.width > firstPage.height ? 'landscape' : 'portrait',
            unit: 'pt',
            format: [firstPage.width, firstPage.height]
          });

          for (let i = 0; i < pageCount; i++) {
            const pageInfo = await viewer.getPageInfo(i);
            if (i > 0) {
              pdf.addPage([pageInfo.width, pageInfo.height], pageInfo.width > pageInfo.height ? 'landscape' : 'portrait');
            }

            const dataUrl = await viewer.renderPage(i, {
              scale: 3,
              format: 'data-url',
              imageType: 'image/png'
            });

            pdf.addImage(dataUrl, 'PNG', 0, 0, pageInfo.width, pageInfo.height, undefined, 'FAST');
          }

          pdf.save(filename);
          return;
        }
      }
    } catch (err) {
      console.error('Error generating PDF:', err);
      await showAlert('Erro ao gerar PDF.', 'Erro');
    } finally {
      setGenerating(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.name.endsWith('.docx')) {
      const rawBuffer = await selectedFile.arrayBuffer();
      const cleanedBuffer = cleanPSSMetadata(rawBuffer);
      setLocalFileBuffer(cleanedBuffer);
      setFile(selectedFile);
    }
  };

  const saveTemplate = async () => {
    if (!file || !localFileBuffer) return;
    setIsSaving(true);
    try {
      const isGlobal = isAdmin && saveAsGlobal;
      const base64 = window.btoa(
        new Uint8Array(localFileBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
      );

      const templateInfo = EMR_TEMPLATES.find(t => t.id === selectedTemplate);
      const docId = isGlobal ? selectedTemplate : `${userId}_${selectedTemplate}`;

      await setDoc(doc(db, 'document_templates', docId), {
        name: templateInfo?.name || selectedTemplate,
        content: base64,
        updatedAt: new Date().toISOString(),
        category: 'emr',
        isGlobal: isGlobal,
        ownerId: isGlobal ? 'admin' : userId
      });

      // Cleanup user private version if saving global
      if (isGlobal) {
        const privateId = `${userId}_${selectedTemplate}`;
        try {
          const privateSnap = await getDoc(doc(db, 'document_templates', privateId));
          if (privateSnap.exists()) {
            await deleteDoc(doc(db, 'document_templates', privateId));
          }
        } catch (e) {
          console.warn('Silent error removing private version during global save:', e);
        }
      }

      setFile(null);
      setLocalFileBuffer(null);
      await showAlert(isGlobal ? 'Modelo substituído com sucesso para TODOS os usuários.' : 'Seu modelo personalizado foi salvo com sucesso!', 'Sucesso');
    } catch (error: any) {
      console.error('Error saving EMR template:', error);
      await showAlert('Erro ao salvar template: ' + error.message, 'Erro');
    } finally {
      setIsSaving(false);
    }
  };

  const deletePrivateTemplate = async () => {
    const templateData = templates[selectedTemplate];
    if (!templateData?.isPrivate) return;
    if (!(await showConfirm('Deseja excluir sua versão personalizada deste modelo? O sistema voltará a usar o modelo padrão.', 'Excluir Versão Personalizada'))) return;

    setIsSaving(true);
    try {
      const docId = `${userId}_${selectedTemplate}`;
      await deleteDoc(doc(db, 'document_templates', docId));
      await showAlert('Sua versão personalizada foi excluída. O sistema voltará a usar o modelo padrão.', 'Sucesso');
    } catch (error: any) {
      console.error('Error deleting private template:', error);
      await showAlert('Erro ao excluir versão personalizada: ' + error.message, 'Erro');
    } finally {
      setIsSaving(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTag(text);
    setTimeout(() => setCopiedTag(null), 2000);
  };

  // Compute parts with speakers
  const partsWithSpeakers = React.useMemo(() => {
    const currentSchoolData = selectedSchoolType === 'ancians' ? emrAnciansData : emrServantsData;
    const turmaIdx = parseInt(selectedTurma) - 1;
    const speakers = currentSchoolData?.parts?.[turmaIdx]?.speakers || {};
    
    const program = selectedSchoolType === 'ancians' ? EMR_ANCIANS_PROGRAM : EMR_SERVANTS_PROGRAM;
    const allParts: any[] = [];
    program.sessions.forEach(s => {
      s.items.forEach(item => {
        allParts.push(item);
        if ((item as any).subitems) {
          (item as any).subitems.forEach((sub: any) => allParts.push(sub));
        }
      });
    });
    
    return allParts.filter(p => !p.noSpeaker && speakers[p.id]).map(p => ({
      id: p.id,
      num: p.num,
      title: p.title,
      speaker: speakers[p.id]
    }));
  }, [selectedSchoolType, emrAnciansData, emrServantsData, selectedTurma]);

  // Update selectedPartId when template changes
  useEffect(() => {
    if (selectedTemplate === 'emr_instrutor' && partsWithSpeakers.length > 0 && !selectedPartId) {
      setSelectedPartId(partsWithSpeakers[0].id);
    } else if (selectedTemplate !== 'emr_instrutor') {
      setSelectedPartId('');
    }
  }, [selectedTemplate, partsWithSpeakers, selectedPartId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 space-y-4">
        <RefreshCw size={32} className="text-blue-500 animate-spin" />
        <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">Carregando Cartas da EMR...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-auto lg:h-[calc(100vh-140px)] min-h-[500px]">
      {/* Mobile Top Controls: Compact School, Turma, Template & Actions Bar */}
      <div className="lg:hidden flex flex-col gap-2.5 bg-surface-100 p-3 sm:p-4 rounded-3xl border border-surface-300 shadow-xs shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-transparent border border-blue-500/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <Mail size={12} strokeWidth={1.8} />
            </div>
            <span className="font-black text-typography-900 text-[10px] uppercase tracking-wider">Cartas EMR</span>
          </div>

          {canManage && (
            <button
              onClick={() => setIsManaging(!isManaging)}
              className={`p-1.5 rounded-xl border transition-all ${
                isManaging 
                  ? 'bg-primary-200 text-white border-primary-200 shadow-2xs' 
                  : 'text-typography-400 hover:text-typography-900 hover:bg-surface-200 border-surface-300'
              }`}
              title="Configurar Templates"
            >
              <Settings2 size={15} />
            </button>
          )}
        </div>

        {!isManaging && (
          <div className="grid grid-cols-2 gap-2">
            <div className="flex p-0.5 bg-surface-200 rounded-xl border border-surface-300">
              <button
                onClick={() => setSelectedSchoolType('ancians')}
                className={`flex-1 py-1 px-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${
                  selectedSchoolType === 'ancians'
                    ? 'bg-primary-200 text-white shadow-2xs'
                    : 'text-typography-500 hover:text-typography-900'
                }`}
              >
                Anciãos
              </button>
              <button
                onClick={() => setSelectedSchoolType('servants')}
                className={`flex-1 py-1 px-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${
                  selectedSchoolType === 'servants'
                    ? 'bg-primary-200 text-white shadow-2xs'
                    : 'text-typography-500 hover:text-typography-900'
                }`}
              >
                Servos
              </button>
            </div>

            <div className="flex p-0.5 bg-surface-200 rounded-xl border border-surface-300">
              {(['1', '2', '3'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setSelectedTurma(t)}
                  className={`flex-1 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${
                    selectedTurma === t
                      ? 'bg-primary-200 text-white shadow-2xs'
                      : 'text-typography-500 hover:text-typography-900'
                  }`}
                >
                  T{t}
                </button>
              ))}
            </div>
          </div>
        )}

        <CustomSelect
          label="Modelo"
          value={selectedTemplate}
          onChange={(val) => setSelectedTemplate(val)}
          options={EMR_TEMPLATES.map(t => ({
            value: t.id,
            label: t.name
          }))}
          className="w-full"
          dropdownClassName="w-full max-w-full"
          size="sm"
        />

        {selectedTemplate === 'emr_instrutor' && (
          <CustomSelect
            label="Instrutor"
            value={selectedPartId}
            onChange={(val) => setSelectedPartId(val)}
            options={partsWithSpeakers.length > 0 ? partsWithSpeakers.map(p => ({
              value: p.id,
              label: `${p.num ? `${p.num}. ` : ''}${p.speaker}`,
              description: p.title
            })) : [
              { value: '', label: 'Nenhum orador preenchido' }
            ]}
            placeholder="Selecione o orador"
            className="w-full"
            dropdownClassName="w-full max-w-full"
            size="sm"
          />
        )}

        <div className="flex items-center gap-2 pt-1">
          {status === 'success' && !isProcessing ? (
            <div className="flex items-center gap-1.5 flex-1">
              <button
                onClick={downloadAsDocx}
                className="flex-1 flex items-center justify-center gap-1 py-2 px-2 bg-surface-200 text-typography-800 rounded-xl border border-surface-300 hover:bg-surface-300 font-black text-[9px] uppercase tracking-wider"
              >
                <FileDown size={13} />
                <span>DOCX</span>
              </button>
              <button
                onClick={downloadAsPdf}
                disabled={generating}
                className="flex-1 flex items-center justify-center gap-1 py-2 px-2 bg-surface-200 text-typography-800 rounded-xl border border-surface-300 hover:bg-surface-300 font-black text-[9px] uppercase tracking-wider disabled:opacity-50"
              >
                {generating ? <Loader2 size={13} className="animate-spin" /> : <FileDown size={13} />}
                <span>PDF</span>
              </button>
              <button
                onClick={() => viewerRef.current?.print()}
                className="flex-1 flex items-center justify-center gap-1 py-2 px-2 bg-primary-200 text-white rounded-xl shadow-xs hover:bg-primary-300 font-black text-[9px] uppercase tracking-wider"
              >
                <Printer size={13} />
                <span>Imprimir</span>
              </button>
            </div>
          ) : (
            <button
              onClick={() => processAndPreview()}
              disabled={isProcessing}
              className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-primary-200 text-white rounded-xl shadow-xs hover:bg-primary-300 disabled:opacity-50 font-black text-[9px] uppercase tracking-wider"
            >
              <RefreshCw size={12} className={isProcessing ? 'animate-spin' : ''} />
              <span>{isProcessing ? 'Gerando...' : 'Atualizar'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Sidebar: Selection & Settings (Desktop Only) */}
      <div className="hidden lg:flex w-80 flex-col gap-4 shrink-0 overflow-y-auto pr-1 custom-scrollbar">
        {/* School & Turma Selectors Card - Only show when NOT managing */}
        {!isManaging && (
          <div className="bg-surface-100 p-4 rounded-3xl border border-surface-300 shadow-xs space-y-3">
            <div>
              <span className="block text-[9px] font-black uppercase tracking-widest text-typography-400 mb-1.5 px-1">
                Modalidade da Escola
              </span>
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-surface-200 rounded-2xl border border-surface-300">
                <button
                  onClick={() => setSelectedSchoolType('ancians')}
                  className={`py-2 px-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                    selectedSchoolType === 'ancians'
                      ? 'bg-primary-200 text-white shadow-2xs'
                      : 'text-typography-500 hover:text-typography-900'
                  }`}
                >
                  Anciãos
                </button>
                <button
                  onClick={() => setSelectedSchoolType('servants')}
                  className={`py-2 px-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                    selectedSchoolType === 'servants'
                      ? 'bg-primary-200 text-white shadow-2xs'
                      : 'text-typography-500 hover:text-typography-900'
                  }`}
                >
                  Servos
                </button>
              </div>
            </div>

            <div>
              <span className="block text-[9px] font-black uppercase tracking-widest text-typography-400 mb-1.5 px-1">
                Turma Selecionada
              </span>
              <div className="grid grid-cols-3 gap-1.5 p-1 bg-surface-200 rounded-2xl border border-surface-300">
                {(['1', '2', '3'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setSelectedTurma(t)}
                    className={`py-2 px-1 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                      selectedTurma === t
                        ? 'bg-primary-200 text-white shadow-2xs'
                        : 'text-typography-500 hover:text-typography-900'
                    }`}
                  >
                    Turma {t}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Templates Selection Card */}
        <div className="bg-surface-100 p-4 rounded-3xl border border-surface-300 shadow-xs space-y-4">
          <div className="flex items-center justify-between px-1">
            <h3 className="font-black text-typography-900 text-[10px] uppercase tracking-[0.2em] flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-transparent border border-blue-500/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <Mail size={12} strokeWidth={1.8} />
              </div>
              Modelos EMR
            </h3>

            {canManage && (
              <button
                onClick={() => setIsManaging(!isManaging)}
                className={`p-1.5 rounded-xl border transition-all ${
                  isManaging 
                    ? 'bg-primary-200 text-white border-primary-200 shadow-2xs' 
                    : 'text-typography-400 hover:text-typography-900 hover:bg-surface-200 border-surface-300'
                }`}
                title="Configurar Templates"
              >
                <Settings2 size={16} />
              </button>
            )}
          </div>

          <div className="flex flex-col gap-2">
            {EMR_TEMPLATES.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedTemplate(t.id)}
                className={`flex items-center gap-3 px-3 py-2.5 transition-all border rounded-2xl text-left group relative overflow-hidden ${
                  selectedTemplate === t.id
                    ? 'bg-surface-200 text-typography-900 border-primary-200/60 shadow-2xs ring-1 ring-primary-200/30'
                    : 'bg-surface-200/40 text-typography-600 border-surface-300/80 hover:border-surface-300 hover:bg-surface-200 hover:text-typography-900'
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors shrink-0 border ${
                  selectedTemplate === t.id 
                    ? 'border-primary-200/60 text-primary-200 bg-transparent' 
                    : 'border-surface-300 text-typography-400 bg-transparent'
                }`}>
                  <Mail size={16} strokeWidth={1.8} />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="block font-black uppercase tracking-tight text-[10px] leading-tight truncate">{t.name}</span>
                  {templates[t.id] && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <CheckCircle2 size={8} className="text-emerald-500" />
                      <span className="text-[6px] font-black uppercase tracking-widest text-typography-400">
                        {templates[t.id].isPrivate ? 'PRIVADO' : 'GLOBAL'}
                      </span>
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* Speaker Selection (Conditional) */}
          {selectedTemplate === 'emr_instrutor' && (
            <div className="pt-2 border-t border-surface-300/60 space-y-2.5">
              <label className="text-[9px] font-black text-typography-400 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                <User size={10} />
                Selecionar Instrutor
              </label>
              
              <CustomSelect
                value={selectedPartId}
                onChange={(val) => setSelectedPartId(val)}
                options={partsWithSpeakers.length > 0 ? partsWithSpeakers.map(p => ({
                  value: p.id,
                  label: `${p.num ? `${p.num}. ` : ''}${p.speaker}`,
                  description: p.title
                })) : [
                  { value: '', label: 'Nenhum orador preenchido' }
                ]}
                placeholder="Selecione o orador"
                className="w-full"
                dropdownClassName="w-full max-w-full"
                size="sm"
              />
              
              {partsWithSpeakers.length === 0 && (
                <p className="text-[8px] text-rose-500 font-bold px-1 italic">
                  * Preencha os nomes dos instrutores na programação para gerar esta carta.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Quick Actions Panel */}
        {status === 'success' && !isProcessing && (
          <div className="bg-surface-100 p-4 rounded-3xl border border-surface-300 shadow-xs space-y-4">
            <h4 className="text-[9px] font-black text-typography-400 uppercase tracking-widest px-1">Ações do Documento</h4>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={downloadAsDocx}
                className="flex flex-col items-center justify-center gap-2 p-3 bg-surface-200 text-typography-800 rounded-2xl border border-surface-300 hover:bg-surface-300 hover:border-primary-200/40 transition-all group"
              >
                <FileDown size={18} className="group-hover:scale-110 transition-transform text-typography-600" />
                <span className="text-[8px] font-black uppercase tracking-tighter">DOCX</span>
              </button>

              <button
                onClick={downloadAsPdf}
                disabled={generating}
                className="flex flex-col items-center justify-center gap-2 p-3 bg-surface-200 text-typography-800 rounded-2xl border border-surface-300 hover:bg-surface-300 hover:border-primary-200/40 transition-all group disabled:opacity-50"
              >
                {generating ? <Loader2 size={18} className="animate-spin" /> : <FileDown size={18} className="group-hover:scale-110 transition-transform text-typography-600" />}
                <span className="text-[8px] font-black uppercase tracking-tighter">PDF</span>
              </button>

              <button
                onClick={() => viewerRef.current?.print()}
                className="col-span-2 flex items-center justify-center gap-2 p-3 bg-primary-200 text-white rounded-2xl shadow-xs hover:bg-primary-300 transition-all font-black text-[10px] uppercase tracking-widest"
              >
                <Printer size={16} />
                Imprimir Agora
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main Content: Management & Viewer */}
      <div className="flex-1 flex flex-col gap-4 min-w-0 h-auto lg:h-full min-h-[550px] lg:min-h-0 overflow-hidden">
        <AnimatePresence mode="wait">
          {isManaging ? (
            <motion.div
              key="management"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-surface-200/50 p-5 rounded-3xl border border-surface-300 shadow-xs shrink-0"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-transparent border border-blue-500/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                    <FileUp size={20} strokeWidth={1.8} />
                  </div>
                  <div>
                    <h4 className="text-[11px] font-black text-typography-900 uppercase tracking-widest">
                      Configurar Template EMR
                    </h4>
                    <p className="text-[8px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest">
                      {EMR_TEMPLATES.find(t => t.id === selectedTemplate)?.name}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowTagsHelp(!showTagsHelp)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-100 border border-surface-300 text-typography-700 rounded-xl text-[9px] font-bold hover:bg-surface-200 transition-all"
                  >
                    <HelpCircle size={14} />
                    Tags Disponíveis
                  </button>
                  <button 
                    onClick={() => setIsManaging(false)} 
                    className="w-8 h-8 flex items-center justify-center bg-surface-100 rounded-full text-typography-400 hover:text-rose-500 border border-surface-300 transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* Tags Help Drawer */}
              {showTagsHelp && (
                <div className="mb-4 p-4 bg-surface-100 rounded-2xl border border-surface-300 shadow-2xs">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-typography-800">Tags para usar no Word (.docx)</span>
                    <span className="text-[8px] text-typography-400 font-bold">Clique em uma tag para copiar</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                    {AVAILABLE_TAGS.map((item) => (
                      <button
                        key={item.tag}
                        onClick={() => copyToClipboard(item.tag)}
                        className="flex items-center justify-between p-2 bg-surface-200 hover:bg-surface-300 rounded-xl border border-surface-300 text-left transition-all group"
                      >
                        <div className="overflow-hidden">
                          <code className="text-[10px] font-black text-primary-200 block">{item.tag}</code>
                          <span className="text-[8px] text-typography-400 block truncate">{item.desc}</span>
                        </div>
                        {copiedTag === item.tag ? (
                          <Check size={12} className="text-emerald-500 shrink-0 ml-1" />
                        ) : (
                          <Copy size={12} className="text-typography-300 group-hover:text-typography-600 shrink-0 ml-1" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2 relative">
                  <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".docx" className="hidden" />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className={`w-full h-24 flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-2xl transition-all ${
                      file ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-600' : 'bg-surface-100 border-surface-300 text-typography-400 hover:border-primary-200/40'
                    }`}
                  >
                    <FileUp size={24} className={file ? 'text-emerald-500' : ''} />
                    <span className="font-black uppercase text-[9px] tracking-[0.2em]">{file ? file.name : 'Selecionar Novo DOCX'}</span>
                  </button>
                </div>

                <div className="flex flex-col justify-between gap-2">
                  {isAdmin && (
                    <label className="flex items-center gap-3 p-3 bg-surface-100 rounded-2xl border border-surface-300 cursor-pointer hover:bg-surface-200 transition-colors">
                      <input 
                        type="checkbox" 
                        checked={saveAsGlobal} 
                        onChange={e => setSaveAsGlobal(e.target.checked)}
                        className="w-4 h-4 accent-primary-200"
                      />
                      <span className="text-[9px] font-black text-typography-700 uppercase tracking-tight">Definir como GLOBAL</span>
                    </label>
                  )}

                  {templates[selectedTemplate]?.isPrivate && (
                    <button
                      onClick={deletePrivateTemplate}
                      className="w-full py-2 bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-xl text-[9px] font-black uppercase tracking-wider hover:bg-rose-500/20 transition-colors flex items-center justify-center gap-1.5 border border-rose-500/20"
                    >
                      <Trash2 size={13} />
                      Voltar ao Modelo Padrão
                    </button>
                  )}

                  <button
                    onClick={saveTemplate}
                    disabled={!file || isSaving}
                    className="w-full h-12 bg-primary-200 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest disabled:opacity-50 hover:bg-primary-300 shadow-xs transition-all flex items-center justify-center gap-2"
                  >
                    {isSaving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                    {isSaving ? 'SALVANDO...' : 'SALVAR MODELO'}
                  </button>
                </div>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* Viewer Section */}
        <div className="flex-1 bg-surface-100 border border-surface-300 rounded-3xl shadow-xs relative overflow-hidden flex flex-col min-h-[550px] sm:min-h-[620px] lg:min-h-0">
          <div className="absolute top-4 left-4 z-10 flex items-center gap-2 bg-surface-100/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-surface-300 shadow-2xs">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-[8px] font-black text-typography-500 uppercase tracking-widest">
              {isManaging 
                ? `Visualizando Modelo: ${EMR_TEMPLATES.find(t => t.id === selectedTemplate)?.name}`
                : `Prévia em Tempo Real — ${selectedSchoolType === 'ancians' ? 'Anciãos' : 'Servos'}`
              }
            </span>
          </div>

          <div 
            ref={previewRef} 
            className="w-full h-[550px] sm:h-[620px] lg:h-full lg:flex-1 overflow-hidden"
          />
        </div>
      </div>

      <style jsx global>{`
        .udoc-viewer-container {
          border-radius: 0 !important;
          height: 100% !important;
          width: 100% !important;
          min-height: 100% !important;
          background-color: #f8fafc !important;
        }
        .udoc-pages {
          background-color: #f8fafc !important;
          padding: 1.5rem !important;
          height: 100% !important;
          overflow-y: auto !important;
        }
        .udoc-page {
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03) !important;
          margin: 0 auto 1.5rem auto !important;
          max-width: 100% !important;
        }
      `}</style>
    </div>
  );
}
