'use client';

import React, { useState, useEffect, useRef } from 'react';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { 
  FileText, 
  Download, 
  RefreshCw, 
  CheckCircle2, 
  List,
  Mail,
  AlertCircle,
  FileDown,
  Loader2,
  PenTool,
  Sparkles,
  Trash2,
  Settings2,
  X,
  FileUp,
  Save,
  Printer
} from 'lucide-react';
import { extractTagsFromDocx, getMissingTags, cleanPSSMetadata } from '@/lib/docxUtils';
import { db } from '@/lib/firebase';
import { 
  collection, 
  getDocs, 
  doc, 
  getDoc,
  setDoc,
  deleteDoc,
  query,
  where,
  limit,
  onSnapshot
} from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '@/utils/firestore';
import { AnimatePresence, motion } from 'motion/react';
import { useDialog } from '@/hooks/useDialog';

interface PSSAssignmentLettersProps {
  userId: string;
  isAdmin?: boolean;
  canManage?: boolean;
  initialMode?: 'geracao' | 'manager';
  selectedTurma: '1' | '2' | '3';
  schoolInfo: {
    dataTurma: string;
    instrutorA: string;
    instrutorB: string;
    confirmacaoEmail: string;
    confirmacaoWhatsapp: string;
    confirmacaoEmailB: string;
    confirmacaoWhatsappB: string;
    entregaLivroEndereco?: string;
    entregaLivroDataHora?: string;
  };
  workshopAssignments: Record<number, { id: string, participants: string }>;
}

const TEMPLATE_NAMES = Array.from({ length: 18 }, (_, i) => `PSS assignment letter_T_${(i + 1).toString().padStart(2, '0')}`);

export default function PSSAssignmentLetters({ 
  userId, 
  isAdmin,
  canManage,
  initialMode = 'geracao',
  selectedTurma, 
  schoolInfo, 
  workshopAssignments 
}: PSSAssignmentLettersProps) {
  const { showAlert, showConfirm } = useDialog();
  const [selectedTemplate, setSelectedTemplate] = useState<string>(TEMPLATE_NAMES[0]);
  const [templates, setTemplates] = useState<Record<string, { content: string, updatedAt: string, isPrivate?: boolean }>>({});
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [processedDocBuffer, setProcessedDocBuffer] = useState<ArrayBuffer | null>(null);
  const [loading, setLoading] = useState(true);
  const [personalData, setPersonalData] = useState<any>(null);
  const [generating, setGenerating] = useState(false);
  
  // Management state
  const [isManaging, setIsManaging] = useState(initialMode === 'manager' && isAdmin);
  const [file, setFile] = useState<File | null>(null);
  const [localFileBuffer, setLocalFileBuffer] = useState<ArrayBuffer | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [missingTags, setMissingTags] = useState<string[]>([]);
  const [saveAsGlobal, setSaveAsGlobal] = useState(false);
  const [needsProcessing, setNeedsProcessing] = useState(true);

  const schoolInfoKey = JSON.stringify(schoolInfo);
  const personalDataKey = JSON.stringify(personalData);
  const workshopAssignmentsKey = JSON.stringify(workshopAssignments);

  const previewRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const viewerRef = useRef<any>(null);
  const [isViewerReady, setIsViewerReady] = useState(false);

  // Initialize viewer once
  useEffect(() => {
    let destroyed = false;

    const initViewer = async () => {
      // Small delays to ensure container is fully loaded and attached to DOM
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
          
          // Force view state to ensure paged layout for Word
          try {
            await (viewer as any).setViewMode('paged');
            await (viewer as any).setZoomMode('fit-page-width');
            await (viewer as any).setScrollMode('continuous');
          } catch (e) {}

          // Add a delay before marking as ready
          setTimeout(() => {
            if (!destroyed && viewerRef.current) {
              setIsViewerReady(true);
            }
          }, 1000);
        }
      } catch (err: any) {
        console.error('UDoc Viewer Init Error inside PSSAssignmentLetters:', err);
      }
    };

    if (!viewerRef.current) {
      initViewer();
    }

    return () => {
      destroyed = true;
      setIsViewerReady(false);
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

  // Handle document updates
  useEffect(() => {
    let active = true;
    const updateDoc = async () => {
      if (isViewerReady && viewerRef.current && processedDocBuffer) {
        // Ensure processedDocBuffer is an ArrayBuffer and has content
        const buffer = processedDocBuffer instanceof ArrayBuffer ? processedDocBuffer : 
                      (processedDocBuffer as any).buffer instanceof ArrayBuffer ? (processedDocBuffer as any).buffer : null;
        
        if (!buffer || buffer.byteLength === 0 || !active) return;

        setIsProcessing(true);
        try {
          if (!viewerRef.current || typeof viewerRef.current.load !== 'function') {
             throw new Error('Viewer not ready for load');
          }
          const loadData = new Uint8Array(buffer);
          await viewerRef.current.load(loadData);
        } catch (err) {
          if (!active) return;
          console.error('UDoc Viewer Load Error:', err);
          // Retry logic if it's the "length" error which might mean internal state wasn't ready
          if (String(err).includes('length') || String(err).includes('null')) {
            console.log('UDoc load failed, retrying in 2000ms...');
            setTimeout(async () => {
              if (active && viewerRef.current && processedDocBuffer) {
                try {
                   const retryBuffer = processedDocBuffer instanceof ArrayBuffer ? processedDocBuffer : 
                                      (processedDocBuffer as any).buffer instanceof ArrayBuffer ? (processedDocBuffer as any).buffer : null;
                   if (retryBuffer && viewerRef.current?.load) {
                     await viewerRef.current.load(new Uint8Array(retryBuffer));
                   }
                } catch (e) {
                   console.error('Retry load failed:', e);
                }
              }
            }, 2000);
          }
        } finally {
          if (active) setIsProcessing(false);
        }
      }
    };

    updateDoc();
    return () => { active = false; };
  }, [processedDocBuffer, isViewerReady]);

  // Real-time templates listener
  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, 'document_templates'), where('category', '==', 'pss'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedTemplates: Record<string, any> = {};
      snapshot.forEach((doc) => {
        fetchedTemplates[doc.id] = doc.data();
      });

      const consolidated: Record<string, any> = {};
      TEMPLATE_NAMES.forEach(name => {
        const privateId = `${userId}_${name}`;
        const globalId = name;
        
        if (fetchedTemplates[privateId]) {
          consolidated[name] = { ...fetchedTemplates[privateId], isPrivate: true };
        } else if (fetchedTemplates[globalId]) {
          consolidated[name] = { ...fetchedTemplates[globalId], isPrivate: false };
        }
      });

      setTemplates(consolidated);
      setLoading(false);
    }, (error) => {
      console.error('Error listening to templates:', error);
      handleFirestoreError(error, OperationType.GET, 'document_templates');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userId]);

  useEffect(() => {
    const fetchPersonalData = async () => {
      if (!userId) return;
      try {
        const docRef = doc(db, 'personal_data', userId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setPersonalData(docSnap.data());
        } else {
          // Fallback: search by userId field
          const querySnapshot = await getDocs(query(
            collection(db, 'personal_data'), 
            where('userId', '==', userId), 
            limit(1)
          ));
          if (!querySnapshot.empty) {
            setPersonalData(querySnapshot.docs[0].data());
          }
        }
      } catch (error) {
        console.error('Error fetching personal data:', error);
      }
    };

    fetchPersonalData();
  }, [userId]);

  // Auto-load template when selectedTemplate or templates changes
  useEffect(() => {
    if (localFileBuffer) {
      // If we have a local file buffered (from upload), show its preview
      console.log('Using local file buffer for preview');
      processAndPreview(localFileBuffer);
    } else if (templates[selectedTemplate]) {
      setNeedsProcessing(true);
      processAndPreview();
    } else {
      setPreviewHtml('<div class="h-full flex flex-col items-center justify-center text-gray-300 italic py-20 px-10 text-center text-sm uppercase font-bold tracking-widest">Template não encontrado no banco de dados. Carregue-o na aba Gerador de Documentos primeiro.</div>');
      setProcessedDocBuffer(null);
      setStatus('idle');
    }
  }, [selectedTemplate, templates, localFileBuffer, schoolInfoKey, workshopAssignmentsKey, personalDataKey]);

  // Fix DocMentis printer choice in Modal
  useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof HTMLElement) {
            const modal = node.classList.contains('udoc-modal') ? node : node.querySelector('.udoc-modal');
            if (modal) {
              const titleNode = modal.querySelector('.udoc-modal-title');
              if (titleNode && (titleNode.textContent?.toLowerCase().includes('imprimir') || titleNode.textContent?.toLowerCase().includes('print'))) {
                // We found the print modal. Now inject the printer selection field.
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

                  // Now intercept the final "Imprimir" button in the footer
                  const footer = modal.querySelector('.udoc-modal-footer') || modal.querySelector('[class*="footer"]');
                  if (footer) {
                    const buttons = footer.querySelectorAll('button');
                    buttons.forEach(btn => {
                      const btnText = btn.textContent?.toLowerCase() || '';
                      if (btnText.includes('imprimir') || btnText.includes('print')) {
                        if (!btn.hasAttribute('data-enhanced-print-v2')) {
                          btn.setAttribute('data-enhanced-print-v2', 'true');
                          
                          // Attach high-priority click listener to check selector value
                          btn.addEventListener('click', (e) => {
                            const choice = (document.getElementById('modal-printer-choice') as HTMLSelectElement)?.value;
                            if (choice === 'pdf') {
                              e.preventDefault();
                              e.stopPropagation();
                              // Close modal
                              const closeBtn = modal.querySelector('.udoc-modal-close') as HTMLElement;
                              if (closeBtn) closeBtn.click();
                              // Trigger our PDF download
                              downloadAsPdf();
                            }
                            // If 'system', let it continue to DocMentis's print handler
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

  const getParticipantLabel = (scenarioId: number, index: number) => {
    if (scenarioId === 1) {
      return index === 0 ? 'Marido' : 'Esposa';
    }
    if ([2, 3, 4, 6, 7, 8, 10, 11, 12, 13, 14, 15].includes(scenarioId)) {
      return index === 0 ? 'Publicador' : 'Morador';
    }
    if (scenarioId === 5) {
      if (index === 0) return 'Publicador 1';
      if (index === 1) return 'Publicador 2';
      if (index === 2) return 'Morador 1';
      if (index === 3) return 'Morador 2';
    }
    if (scenarioId === 9) {
      return index === 0 ? 'Publicador 1' : 'Publicador 2';
    }
    if (scenarioId === 16 || scenarioId === 17 || scenarioId === 18) {
      return index === 0 ? 'Instrutor' : 'Estudante';
    }
    return '';
  };

  const getReplacements = (templateName: string, signatureImage: string) => {
    // Extract number from "PSS assignment letter_T_XX"
    const match = templateName.match(/_T_(\d+)/);
    const scenarioId = match ? parseInt(match[1]) : 0;
    
    const assignment = workshopAssignments[scenarioId];
    const rawParticipants = assignment?.participants ? assignment.participants.split('|') : [];
    
    let nomes = '________________';
    if (rawParticipants.some(p => p.trim())) {
      const parts: string[] = [];
      rawParticipants.forEach((p, idx) => {
        if (p.trim()) {
          const label = getParticipantLabel(scenarioId, idx);
          if (label) {
            parts.push(`${label} - ${p.trim()}`);
          } else {
            parts.push(p.trim());
          }
        }
      });
      if (parts.length > 0) {
        nomes = parts.join('\n');
      }
    }

    const now = new Date();
    const hoje = new Intl.DateTimeFormat('pt-BR', { 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    }).format(now);

    const dataValue = schoolInfo.dataTurma || hoje;
    
    // Contatos Instructor A e B
    const emailA = schoolInfo.confirmacaoEmail || '________________';
    const contatoA = schoolInfo.confirmacaoWhatsapp || '________________';
    const emailB = schoolInfo.confirmacaoEmailB || emailA; 
    const contatoB = schoolInfo.confirmacaoWhatsappB || contatoA;

    const hasInstructorBData = !!(schoolInfo.confirmacaoEmailB?.trim() || schoolInfo.confirmacaoWhatsappB?.trim());

    let finalEmail = emailA;
    let finalTelefone = contatoA;
    let instructorName = schoolInfo.instrutorA || '________________';

    if (hasInstructorBData) {
      if ((scenarioId >= 1 && scenarioId <= 3) || (scenarioId >= 15 && scenarioId <= 18)) {
        instructorName = schoolInfo.instrutorB || '________________';
        finalEmail = emailB;
        finalTelefone = contatoB;
      } else if (scenarioId >= 4 && scenarioId <= 14) {
        instructorName = schoolInfo.instrutorA || '________________';
        finalEmail = emailA;
        finalTelefone = contatoA;
      }
    }

    const travelerName = personalData?.nome || '________________';
    const circuit = personalData?.circuito || '________________';
    const signatureText = `${travelerName} (${circuit})`;
    
    const res: any = {
      'data': dataValue,
      'DATA': dataValue,
      'nomes': nomes,
      'NOMES': nomes,
      'e mail': finalEmail,
      'E MAIL': finalEmail,
      'e-mail': finalEmail,
      'E-mail': finalEmail,
      'E-MAIL': finalEmail,
      'email': finalEmail,
      'EMAIL': finalEmail,
      'telefone': finalTelefone,
      'TELEFONE': finalTelefone,
      'whatsapp': finalTelefone,
      'WHATSAPP': finalTelefone,
      'EMAIL_A': emailA,
      'EMAILA': emailA,
      'CONTATO_A': contatoA,
      'CONTATOA': contatoA,
      'EMAIL_B': emailB,
      'EMAILB': emailB,
      'CONTATO_B': contatoB,
      'CONTATOB': contatoB,
      'DATAHORA': schoolInfo.entregaLivroDataHora || '________________',
      'DATATREINO': schoolInfo.entregaLivroDataHora || '________________',
      'LOCALTREINO': schoolInfo.entregaLivroEndereco || '________________',
      'LOCAL_TREINO': schoolInfo.entregaLivroEndereco || '________________',
      'nome do instrutor': instructorName,
      'NOME DO INSTRUTOR': instructorName,
      'instrutor': instructorName,
      'INSTRUTOR': instructorName,
      'assinatura': signatureText,
      'ASSINATURA': signatureText,
      'VIAJANTE': travelerName,
      'viajante': travelerName,
      'NOME': travelerName,
      'nome': travelerName,
      '%ASSINATURA': signatureImage && signatureImage.startsWith('data:image') ? signatureImage : '',
      'ASSINATURA_GLOBAL': signatureText,
    };

    // Add individual names with identification
    for (let i = 0; i < 4; i++) {
      const p = rawParticipants[i] || '';
      const label = getParticipantLabel(scenarioId, i);
      const name = p.trim();
      const identifiedName = name ? (label ? `${label} - ${name}` : name) : (i < rawParticipants.length ? '________________' : '');
      res[`NOME${i + 1}`] = identifiedName;
    }

    return res;
  };

  const processAndPreview = async (overrideBuffer?: ArrayBuffer) => {
    let sourceBuffer: ArrayBuffer;
    
    if (overrideBuffer) {
      sourceBuffer = overrideBuffer;
    } else {
      const template = templates[selectedTemplate];
      if (!template || !template.content) {
        console.error('Template not found or has no content:', selectedTemplate);
        return;
      }
      
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
      let sigWidth = 150;
      let sigHeight = 60;
      
      if (signatureImage && signatureImage.startsWith('data:image')) {
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
          if (!tagValue || !tagValue.startsWith('data:image')) return null;
          const base64Data = tagValue.split(',')[1];
          const binaryStringArray = window.atob(base64Data);
          const len = binaryStringArray.length;
          const bytesArray = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            bytesArray[i] = binaryStringArray.charCodeAt(i);
          }
          return bytesArray.buffer;
        },
        getSize: () => [sigWidth, sigHeight],
      };

      const cleanedBuffer = cleanPSSMetadata(sourceBuffer);
      const zip = new PizZip(cleanedBuffer);
      
      const replacements = getReplacements(selectedTemplate, signatureImage);
      
      // Pre-process all XML files in the zip (document, headers, footers)
      const xmlFiles = zip.file(/word\/(document|header\d*|footer\d*)\.xml/);
      
      xmlFiles.forEach(file => {
        let xmlContent = file.asText();
        xmlContent = xmlContent.replace(/<w:proofErr w:type="(?:spell|gram)(?:Start|End)"\/>/g, "");
        xmlContent = xmlContent.replace(/<w:noProof\/>/g, "");
                // Safer joined split tag logic - reduces structural risk
        for (let i = 0; i < 5; i++) {
          const prevContent = xmlContent;
          // Only join text nodes if they are within the same text block, to avoid breaking XML
          xmlContent = xmlContent.replace(/(<w:t[^>]*>[^<]*?)<\/w:t>(?:<w:[^>]+>)*?<w:t[^>]*>/g, "$1");
          if (prevContent === xmlContent) break;
        }

        // Forceful layout fix for tables containing our form labels
        const labelCheck = /Dia:|Assinatura:|Unidade:|Instruções:|Cena:|Tempo:|Designação:|Designaçao:|Participante\(s\):|Participan-te\(s\):|Local:/;
        
        if (labelCheck.test(xmlContent)) {
          xmlContent = xmlContent.replace(/<w:tbl>([\s\S]*?)<\/w:tbl>/g, (tblMatch, tblInner) => {
            if (!labelCheck.test(tblInner)) return tblMatch;
            // Avoid nested tables for simplicity
            if (tblInner.indexOf('<w:tbl>') !== -1) return tblMatch;

            // Count max columns in any row to fix the grid correctly
            let maxCols = 0;
            const rows = tblInner.match(/<w:tr(?: [^>]*)?>([\s\S]*?)<\/w:tr>/g) || [];
            rows.forEach(row => {
              const cells = row.match(/<w:tc(?: [^>]*)?>([\s\S]*?)<\/w:tc>/g) || [];
              if (cells.length > maxCols) maxCols = cells.length;
            });

            if (maxCols < 2) return tblMatch; // Only fix if it's meant to be a multi-column table

            let fixedTbl = tblInner;
            
            // 1. Fix Table Grid (Columns)
            fixedTbl = fixedTbl.replace(/<w:tblGrid>[\s\S]*?<\/w:tblGrid>/, () => {
              let grid = '<w:tblGrid>';
              grid += '<w:gridCol w:w="2600"/>'; // First column (Label) - approx 4.6cm
              grid += '<w:gridCol w:w="6400"/>'; // Second column (Value) - approx 11.3cm
              for (let i = 2; i < maxCols; i++) {
                grid += '<w:gridCol w:w="500"/>';
              }
              grid += '</w:tblGrid>';
              return grid;
            });
            
            // 2. Fix Table Properties
            fixedTbl = fixedTbl.replace(/<w:tblPr>([\s\S]*?)<\/w:tblPr>/, (match, prInner) => {
              let pr = prInner;
              const tblW = '<w:tblW w:w="9000" w:type="dxa"/>'; // Total width approx 15.8cm
              const tblInd = '<w:tblInd w:w="0" w:type="dxa"/>';
              const tblLayout = '<w:tblLayout w:type="fixed"/>';
              
              pr = pr.replace(/<w:tblW [^>]*\/>/g, "").replace(/<w:tblInd [^>]*\/>/g, "").replace(/<w:tblLayout [^>]*\/>/g, "");
              return `<w:tblPr>${tblW}${tblInd}${tblLayout}${pr}</w:tblPr>`;
            });
            
            // 3. Fix Rows and Cells
            fixedTbl = fixedTbl.replace(/<w:tr(?: [^>]*)?>([\s\S]*?)<\/w:tr>/g, (trMatch, trInner) => {
              let cCount = 0;
              const fixedTrInner = trInner.replace(/<w:tc(?: [^>]*)?>([\s\S]*?)<\/w:tc>/g, (tcMatch, tcInner) => {
                cCount++;
                if (cCount > maxCols) return tcMatch;
                
                const width = cCount === 1 ? "2600" : (cCount === 2 ? "6400" : "500");
                const isLabelCell = cCount === 1;
                
                let tcPr = "";
                let tcRest = tcInner;
                
                if (tcInner.includes('<w:tcPr')) {
                  const prMatch = tcInner.match(/<w:tcPr(?: [^>]*)?>(?:[\s\S]*?)<\/w:tcPr>/) || tcInner.match(/<w:tcPr[^>]*\/>/);
                  if (prMatch) {
                    tcPr = prMatch[0];
                    tcRest = tcInner.replace(tcPr, "");
                    if (tcPr.endsWith('/>')) tcPr = tcPr.replace('/>', '></w:tcPr>');
                  }
                }
                if (!tcPr) tcPr = "<w:tcPr></w:tcPr>";
                
                tcPr = tcPr.replace(/<w:tcW [^>]*\/>/g, "").replace(/<w:noWrap\/>/g, "").replace(/<w:tcMar>[\s\S]*?<\/w:tcMar>/g, "").replace(/<w:vAlign [^>]*\/>/g, "");
                
                // For the first column, we force noWrap and left alignment
                // For the second column, we ensure enough left margin to separate from labels
                const newProps = `<w:tcW w:w="${width}" w:type="dxa"/>${isLabelCell ? '<w:noWrap/>' : ''}<w:vAlign w:val="top"/><w:tcMar><w:left w:w="${isLabelCell ? '40' : '200'}" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tcMar>`;
                tcPr = tcPr.replace(/<\/w:tcPr>/, `${newProps}</w:tcPr>`);
                
                return `<w:tc>${tcPr}${tcRest}</w:tc>`;
              });
              return `<w:tr>${fixedTrInner}</w:tr>`;
            });
            
            return `<w:tbl>${fixedTbl}</w:tbl>`;
          });
        }

        
        // Ensure namespaces are present for images (required for docxtemplater-image-module)
        if (!xmlContent.includes('xmlns:wp=')) {
          xmlContent = xmlContent.replace(/(<w:(?:document|hdr|ftr)[^>]*)/, (match) => {
            if (match.includes('xmlns:wp=')) return match;
            return `${match} xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape" xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas" xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"`;
          });
        }
        
        // Convert @TAG to [TAG] or [%TAG]
        const hasImage = signatureImage && signatureImage.startsWith('data:image');
        xmlContent = xmlContent.replace(/(<w:t[^>]*>)(.*?)(<\/w:t>)/g, (match, opening, text, closing) => {
          let newText = text;
          // Handle Signature specifically
          if (hasImage) {
            newText = newText.replace(/@Assinatura([A-Za-z0-9À-ÿ\_]*\s*Global|_Global)?/gi, '[%ASSINATURA]');
          } else {
            newText = newText.replace(/@Assinatura([A-Za-z0-9À-ÿ\_]*\s*Global|_Global)?/gi, '[ASSINATURA]');
          }
          
          newText = newText.replace(/(^|[^A-Za-z0-9À-ÿ\u00C0-\u00FF])@([A-Za-z0-9À-ÿ\_]+)/g, (m, p1, p2) => {
            return `${p1}[${p2.toUpperCase()}]`;
          });
          return `${opening}${newText}${closing}`;
        });

        zip.file(file.name, xmlContent);
      });

      // Also generate the "real" buffer with signed content for download & preview
      const docReal = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
        delimiters: { start: '[', end: ']' },
        modules: ImageModule ? [new ImageModule(imgOpts)] : []
      });
      docReal.render(replacements);
      const outReal = docReal.getZip().generate({
        type: 'arraybuffer'
      });
      setProcessedDocBuffer(outReal);
      
      setStatus('success');
      setNeedsProcessing(false);
    } catch (err: any) {
      console.error('Error processing DOCX:', err);
      setStatus('error');
      setPreviewHtml(`<div class="text-red-500 p-4 font-bold">Erro ao processar template: ${err.message}</div>`);
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
    link.download = `${selectedTemplate}_Turma${selectedTurma}.docx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadAsPdf = async () => {
    if (!previewRef.current || status !== 'success') return;
    
    setGenerating(true);
    try {
      const filename = `${selectedTemplate.replace('PSS assignment letter_', '')}_Turma${selectedTurma}.pdf`;

      const viewer = viewerRef.current;
      // Optimized: Use internal viewer render engine if available for higher fidelity
      if (viewer && typeof viewer.renderPage === 'function') {
        const { jsPDF } = await import('jspdf');
        const pageCount = viewer.pageCount;
        
        if (pageCount > 0) {
          // Initialize PDF with the size of the first page to minimize white space
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
              scale: 3, // High DPI capture for crisp text
              format: 'data-url',
              imageType: 'image/png'
            });

            pdf.addImage(dataUrl, 'PNG', 0, 0, pageInfo.width, pageInfo.height, undefined, 'FAST');
          }

          pdf.save(filename);
          return;
        }
      }

      // Fallback: html-to-image (original method improved)
      const { toPng } = await import('html-to-image');
      const { jsPDF } = await import('jspdf');

      const container = previewRef.current;
      
      // Try to find the document pages specifically for higher fidelity
      let pageElements = Array.from(container.querySelectorAll('.udoc-page')) as HTMLElement[];
      
      if (pageElements.length === 0) {
        const pagesContainer = container.querySelector('.udoc-pages') || 
                               container.querySelector('.udoc-viewer-content') || 
                               container.querySelector('.udoc-canvas-container');
        
        if (pagesContainer) {
          const children = Array.from(pagesContainer.children).filter(c => (c as HTMLElement).offsetHeight > 200) as HTMLElement[];
          if (children.length > 0) {
            pageElements = children;
          } else {
            pageElements = [pagesContainer as HTMLElement];
          }
        }
      }

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true
      });

      if (pageElements.length > 0) {
        // IMPROVED: Capture directly from live DOM to preserve styles and canvas state
        // We'll use a temporary class to ensure clean printing styles are applied during capture
        
        for (let i = 0; i < pageElements.length; i++) {
          const originalPage = pageElements[i];
          if (originalPage.classList.contains('udoc-viewer-toolbar') || originalPage.tagName === 'NAV') continue;

          if (i > 0) pdf.addPage();
          
          // Ensure page is visible and scrolled into view if lazy loaded
          originalPage.scrollIntoView();
          await new Promise(resolve => setTimeout(resolve, 100));

          const dataUrl = await toPng(originalPage, {
            pixelRatio: 4, // Higher resolution
            backgroundColor: '#ffffff',
            style: {
              transform: 'none',
              boxShadow: 'none',
              margin: '0',
              padding: '0'
            }
          });

          const pdfWidth = pdf.internal.pageSize.getWidth();
          const pdfHeight = pdf.internal.pageSize.getHeight();
          
          pdf.addImage(dataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
        }
      } else {
        // Fallback for full container capture
        const targetElement = container;
        const dataUrl = await toPng(targetElement as HTMLElement, {
          pixelRatio: 4,
          backgroundColor: '#ffffff',
          filter: (node) => {
            if (node instanceof HTMLElement) {
              const classes = Array.from(node.classList);
              return !classes.some(c => c.includes('toolbar') || c.includes('sidebar') || c.includes('left-panel'));
            }
            return true;
          }
        });

        const imgProps = pdf.getImageProperties(dataUrl);
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
        
        let heightLeft = pdfHeight;
        let position = 0;
        const pageHeight = pdf.internal.pageSize.getHeight();

        pdf.addImage(dataUrl, 'PNG', 0, position, pdfWidth, pdfHeight, undefined, 'FAST');
        heightLeft -= pageHeight;

        while (heightLeft > 0) {
          position = heightLeft - pdfHeight;
          pdf.addPage();
          pdf.addImage(dataUrl, 'JPEG', 0, position, pdfWidth, pdfHeight, undefined, 'FAST');
          heightLeft -= pageHeight;
        }
      }

      pdf.save(filename);
    } catch (err) {
      console.error('Error generating PDF:', err);
      await showAlert('Erro ao gerar PDF. Uma alternativa é utilizar a função "Imprimir" e selecionar "Salvar como PDF".', 'Erro');
    } finally {
      setGenerating(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.name.endsWith('.docx')) {
        console.log('File selected:', selectedFile.name, selectedFile.size);
        setFile(selectedFile);
        try {
          const rawBuffer = await selectedFile.arrayBuffer();
          console.log('Buffer read, cleaning metadata...');
          const cleanedBuffer = cleanPSSMetadata(rawBuffer);
          console.log('Metadata cleaned, buffer size:', cleanedBuffer.byteLength);
          
          setLocalFileBuffer(cleanedBuffer);

          // Validate tags
          const tags = await extractTagsFromDocx(cleanedBuffer);
          console.log('Extracted tags:', tags);
          const required = [
            ['NOME'],
            ['E-MAIL', 'EMAIL'],
            ['TELEFONE', 'CONTATO'],
            ['DATA'],
            ['ASSINATURA', '%ASSINATURA']
          ];
          const missing = getMissingTags(tags, required);
          setMissingTags(missing);
          setErrorMessage('');
          setSaveStatus('idle');
        } catch (err: any) {
          console.error('Error validating uploaded docx:', err);
          setErrorMessage('Erro ao ler arquivo: ' + err.message);
        }
      } else {
        setErrorMessage('Por favor, selecione um arquivo .docx');
        setSaveStatus('error');
      }
    }
  };

  const saveTemplate = async () => {
    if (!file || !localFileBuffer) {
      console.error('Save attempted without file or buffer', { hasFile: !!file, hasBuffer: !!localFileBuffer });
      return;
    }
    setIsSaving(true);
    setSaveStatus('idle');
    try {
      const isGlobal = isAdmin && saveAsGlobal;
      const mode = isGlobal ? 'GLOBAL' : 'PRIVADO';
      console.log(`Starting save: ${selectedTemplate} mode: ${mode}`);
      
      const blob = new Blob([localFileBuffer]);
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]);
        };
        reader.onerror = (e) => {
          console.error('FileReader error:', e);
          reject(new Error('Falha ao processar arquivo para upload'));
        };
        reader.readAsDataURL(blob);
      });

      const docId = isGlobal ? selectedTemplate : `${userId}_${selectedTemplate}`;
      
      console.log(`Sending to Firestore: document_templates/${docId}`);
      
      const saveData = {
        name: selectedTemplate,
        content: base64,
        updatedAt: new Date().toISOString(),
        category: 'pss',
        isGlobal: isGlobal,
        ownerId: isGlobal ? 'admin' : userId
      };

      await setDoc(doc(db, 'document_templates', docId), saveData);
      console.log('Firestore write complete');

      // Se salvou como global, remove a versão privada do usuário atual se existir
      // para que a global passe a ser a ativa imediatamente
      if (isGlobal) {
        const privateId = `${userId}_${selectedTemplate}`;
        try {
          const privateSnap = await getDoc(doc(db, 'document_templates', privateId));
          if (privateSnap.exists()) {
            console.log('Removing outdated private version...');
            await deleteDoc(doc(db, 'document_templates', privateId));
          }
        } catch (e) {
          console.warn('Silent error removing private version during global save:', e);
        }
      }

      console.log('Template replacement finished successfully');
      
      setSaveStatus('success');
      setFile(null);
      setLocalFileBuffer(null);
      
      await showAlert(isGlobal ? 'Modelo substituído com sucesso para TODOS os usuários.' : 'Seu modelo personalizado foi atualizado com sucesso.', 'Sucesso');
      
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (error: any) {
      console.error('CRITICAL: Error saving template:', error);
      setErrorMessage('Falha ao salvar: ' + (error.message || 'Erro desconhecido'));
      setSaveStatus('error');
      await showAlert('Erro ao substituir template: ' + (error.message || 'Verifique sua conexão e tente novamente.'), 'Erro');
    } finally {
      setIsSaving(false);
    }
  };

  const deletePrivateTemplate = async () => {
    if (!templates[selectedTemplate]?.isPrivate) return;
    const confirmed = await showConfirm('Tem certeza que deseja excluir sua versão personalizada deste modelo? O sistema voltará a usar o modelo padrão.', 'Confirmar Exclusão');
    if (!confirmed) return;
    
    setIsSaving(true);
    try {
      const docId = `${userId}_${selectedTemplate}`;
      await deleteDoc(doc(db, 'document_templates', docId));
      
      console.log('Template private version deleted:', docId);
      
      setSaveStatus('success');
      
      await showAlert('Sua versão personalizada foi excluída. O sistema voltará a usar o modelo padrão.', 'Sucesso');
      
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (error: any) {
      console.error('Error deleting template:', error);
      setErrorMessage(error.message || 'Erro ao excluir');
      setSaveStatus('error');
      await showAlert('Erro ao excluir versão personalizada: ' + error.message, 'Erro');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 space-y-4">
        <RefreshCw size={32} className="text-blue-500 animate-spin" />
        <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">Carregando Templates...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-6">
        {/* Top: Lista de Templates em Grid */}
        <div className="bg-gray-50 p-4 rounded-none border border-gray-200">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-extrabold text-gray-900 flex items-center gap-3 text-sm uppercase tracking-widest bg-blue-50 text-blue-700 px-4 py-2 rounded-none border border-blue-100">
              <Mail size={20} />
              Selecione o Modelo de Carta PSS
            </h3>
            
            {canManage && isAdmin && initialMode !== 'manager' && (
              <button
                onClick={() => setIsManaging(!isManaging)}
                className={`flex items-center gap-2 px-4 py-2 rounded-none text-[10px] font-black uppercase tracking-widest transition-all border shadow-sm ${
                  isManaging 
                    ? 'bg-amber-500 text-white border-amber-400' 
                    : 'bg-white text-blue-600 border-blue-100 hover:bg-blue-50'
                }`}
              >
                <Settings2 size={14} />
                {isManaging ? 'Fechar Gerenciador' : 'Gerenciar Templates'}
              </button>
            )}
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {TEMPLATE_NAMES.map(name => (
              <div key={name} className="relative group/card">
                <button
                  onClick={() => setSelectedTemplate(name)}
                  className={`w-full text-left p-4 rounded-none h-20 transition-all border-2 flex items-center gap-3 ${
                    selectedTemplate === name 
                      ? 'bg-blue-600 text-white border-blue-600 shadow-md' 
                      : 'bg-white text-gray-600 border-gray-100 hover:border-blue-200 hover:bg-blue-50'
                  }`}
                >
                  <div className={`p-2 rounded-none transition-colors shrink-0 ${selectedTemplate === name ? 'bg-white/20' : 'bg-blue-50'}`}>
                    <Mail size={20} className={selectedTemplate === name ? 'text-white' : 'text-blue-600'} />
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between gap-1 w-full">
                      <span className="truncate font-black uppercase tracking-tighter text-[13px]">{name.replace('PSS assignment letter_T_', 'WS ')}</span>
                      {templates[name] && <CheckCircle2 size={12} className={selectedTemplate === name ? 'text-white' : 'text-green-500'} />}
                    </div>
                    {templates[name] && (
                      <span className={`text-[7px] px-1.5 py-0.5 rounded-none font-black uppercase tracking-widest leading-none ${
                        templates[name].isPrivate 
                          ? (selectedTemplate === name ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-700')
                          : (selectedTemplate === name ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-700')
                      }`}>
                        {templates[name].isPrivate ? 'SEU MODELO' : 'GLOBAL'}
                      </span>
                    )}
                  </div>
                </button>

                {canManage && isAdmin && (
                  <button
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      if (selectedTemplate === name) {
                        setIsManaging(!isManaging);
                      } else {
                        setSelectedTemplate(name); 
                        setIsManaging(true);
                      }
                    }}
                    className={`absolute -top-1.5 -right-1.5 p-1.5 rounded-full shadow-lg border transition-all z-20 ${
                      isManaging && selectedTemplate === name
                        ? 'bg-amber-500 text-white border-amber-400 rotate-90'
                        : 'bg-white text-gray-400 border-gray-100 hover:text-amber-600'
                    }`}
                  >
                    <Settings2 size={10} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {isManaging && canManage && (
          <div className="bg-amber-50 p-6 rounded-2xl border border-amber-100 space-y-4 animate-in slide-in-from-top-2 duration-300">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black text-amber-700 uppercase tracking-widest flex items-center gap-2">
                <FileUp size={16} />
                Gerenciar Modelo: {selectedTemplate.replace('PSS assignment letter_', '')}
              </h4>
              <button onClick={() => setIsManaging(false)} className="text-amber-400 hover:text-amber-600 transition-colors">
                <Trash2 size={16} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                {isAdmin && (
                  <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-amber-100">
                    <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Salvar para todos?</span>
                    <button
                      onClick={() => setSaveAsGlobal(!saveAsGlobal)}
                      className={`w-10 h-5 rounded-full transition-all relative ${saveAsGlobal ? 'bg-emerald-500' : 'bg-gray-300'}`}
                    >
                      <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${saveAsGlobal ? 'left-6' : 'left-1'}`} />
                    </button>
                  </div>
                )}

                <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".docx" className="hidden" />
                <div className="relative group">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className={`w-full flex flex-col items-center justify-center p-6 rounded-xl text-[10px] font-black uppercase tracking-tighter border-2 border-dashed transition-all ${
                      file ? 'bg-white text-emerald-700 border-emerald-300 shadow-inner' : 'bg-white text-gray-400 border-gray-200 hover:border-amber-300 hover:text-amber-600'
                    }`}
                  >
                    <FileUp size={24} className={file ? 'text-emerald-500' : 'text-gray-300'} />
                    <span className="mt-2 truncate max-w-full">{file ? file.name : 'CARREGAR NOVO MODELO DOCX'}</span>
                  </button>
                  {file && (
                    <button 
                      onClick={() => setFile(null)} 
                      className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full shadow-md hover:bg-red-600 transition-colors"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                {file && (
                  <div className="space-y-3">
                    {missingTags.length > 0 ? (
                      <div className="p-3 bg-red-50 border border-red-100 rounded-xl space-y-1">
                        <p className="text-[9px] font-black text-red-600 uppercase tracking-widest flex items-center gap-1">
                          <AlertCircle size={12} /> Marcadores Faltantes
                        </p>
                        <p className="text-[8px] font-bold text-red-500 leading-tight">
                          Recomendado: {missingTags.join(', ')}
                        </p>
                      </div>
                    ) : (
                      <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl space-y-1">
                        <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-1">
                          <CheckCircle2 size={12} /> Status: OK
                        </p>
                        <p className="text-[8px] font-bold text-emerald-500 leading-tight">Documento validado!</p>
                      </div>
                    )}

                    <button
                      onClick={saveTemplate}
                      disabled={isSaving}
                      className={`w-full py-3 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-lg ${
                        saveStatus === 'success' ? 'bg-green-600 text-white' : saveStatus === 'error' ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white hover:bg-emerald-700'
                      } disabled:opacity-50`}
                    >
                      {isSaving ? <RefreshCw className="animate-spin" size={14} /> : saveStatus === 'success' ? <CheckCircle2 size={14} /> : <Save size={14} />}
                      {isSaving ? 'SALVANDO...' : saveStatus === 'success' ? 'SALVO!' : 'SALVAR MODELO'}
                    </button>
                  </div>
                )}
                {!file && templates[selectedTemplate]?.isPrivate && (
                   <button
                    onClick={deletePrivateTemplate}
                    disabled={isSaving}
                    className="w-full py-3 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all border border-red-100 bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50"
                  >
                    {isSaving ? <RefreshCw className="animate-spin" size={14} /> : <Trash2 size={14} />}
                    {isSaving ? 'EXCLUINDO...' : 'EXCLUIR MINHA VERSÃO'}
                  </button>
                )}
                {!file && !templates[selectedTemplate]?.isPrivate && (
                  <div className="h-full flex flex-col items-center justify-center p-4 bg-white/50 rounded-xl border border-amber-50">
                    <p className="text-[9px] text-amber-600 font-black text-center uppercase tracking-widest leading-relaxed">
                      Selecione um arquivo .docx para atualizar o modelo <br/> deste documento no servidor.
                    </p>
                  </div>
                )}
                {saveStatus === 'error' && (
                  <p className="text-[9px] text-red-500 font-bold text-center uppercase mt-2">{errorMessage || 'Erro ao salvar'}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Lado Direito: Preview e Ações */}
        <div className="w-full space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gray-50 p-4 rounded-2xl border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="bg-blue-100 p-2 rounded-lg">
                <FileText className="text-blue-600" size={20} />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between w-full">
                  <h3 className="font-black text-gray-800 text-sm uppercase tracking-widest">Visualização</h3>
                </div>
                <p className="text-[14px] text-gray-500 font-bold uppercase truncate max-w-[200px]">
                  {selectedTemplate.replace('PSS assignment letter_', '')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {status === 'success' && !isProcessing && (
                <>
                  <button
                    onClick={downloadAsDocx}
                    className="flex items-center gap-2 px-4 py-2 bg-white text-gray-600 rounded-none text-[10px] font-black uppercase tracking-widest shadow-sm hover:text-blue-600 hover:border-blue-100 border border-transparent transition-all"
                    title="Baixar Original (.docx)"
                  >
                    <FileDown size={14} />
                    BAIXAR DOCX
                  </button>

                  <button
                    onClick={downloadAsPdf}
                    disabled={generating}
                    className="flex items-center gap-2 px-4 py-2 bg-[#3e5e66] text-white rounded-none text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-[#2c4d55] transition-all disabled:opacity-50 border-r-4 border-[#facc15]"
                    title="Baixar PDF"
                  >
                    {generating ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} className="text-[#facc15]" />}
                    BAIXAR PDF
                  </button>
                </>
              )}
              {needsProcessing && (
                <button
                  onClick={processAndPreview}
                  disabled={isProcessing}
                  className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-none text-[11px] font-black uppercase tracking-widest shadow-xl shadow-blue-600/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
                  title="Gerar PDF/Prévia"
                >
                  {isProcessing ? <RefreshCw size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                  GERAR DOCUMENTO
                </button>
              )}
            </div>
          </div>

          <div className="relative group">
            <div 
              className="w-full h-[750px] bg-[#1A1B1E] border border-[#2c2e33] rounded-none shadow-inner-lg overflow-hidden relative"
            >
              <div 
                ref={previewRef} 
                className="w-full h-full" 
                style={{ display: processedDocBuffer ? 'block' : 'block', visibility: processedDocBuffer ? 'visible' : 'hidden', position: processedDocBuffer ? 'relative' : 'absolute' }}
              />

              {!processedDocBuffer && !isProcessing && (
                <div 
                  className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex flex-col items-center justify-center text-center p-8 text-gray-500 font-bold uppercase tracking-widest text-xs"
                  dangerouslySetInnerHTML={{ __html: previewHtml || 'Selecione um template para visualizar' }}
                />
              )}
            </div>
            {isProcessing && (
              <div className="absolute inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center rounded-none pointer-events-none">
                <RefreshCw className="w-10 h-10 text-emerald-500 animate-spin" />
              </div>
            )}
            {status === 'error' && (
              <div className="absolute top-4 right-4 bg-red-50 p-3 rounded-none border border-red-100 flex items-center space-x-2 text-red-700 shadow-lg">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span className="text-[10px] font-bold uppercase">Erro no documento</span>
              </div>
            )}
          </div>

          <p className="text-[9px] text-gray-400 text-center italic">
            * As substituições são automáticas. Use marcadores no formato [TAG] nos arquivos Word. Por exemplo: [NOME], [DATA], [ASSINATURA]. Para negrito, formate o marcador como negrito no Word.
          </p>
        </div>
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
          height: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f1f1;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #d1d5db;
          border-radius: 10px;
        }
        
        /* DocMentis Modal Print Fix */
        .udoc-modal-footer button {
          position: relative;
        }
        .udoc-modal-footer button:after {
          content: attr(title);
          position: absolute;
          bottom: 100%;
          left: 50%;
          transform: translateX(-50%);
          background: #333;
          color: white;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 10px;
          white-space: nowrap;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.2s;
          margin-bottom: 5px;
          z-index: 9999;
        }
        .udoc-modal-footer button:hover:after {
          opacity: 1;
        }
      `}</style>
    </div>
  );
}
