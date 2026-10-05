'use client';

import { useDialog } from '@/hooks/useDialog';
import { cleanPSSMetadata, extractTagsFromDocx, getMissingTags } from '@/lib/docxUtils';
import { db } from '@/lib/firebase';
import Docxtemplater from 'docxtemplater';
import { collection, deleteDoc, doc, getDoc, getDocs, limit, onSnapshot, query, setDoc, where } from 'firebase/firestore';
import {
  CheckCircle2,
  FileDown,
  FileUp,
  Loader2,
  Mail,
  Printer,
  RefreshCw,
  Save,
  Settings2,
  X
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import PizZip from 'pizzip';
import React, { useEffect, useRef, useState } from 'react';
import CustomSelect from './CustomSelect';

interface Template {
  id: string;
  name: string;
}

interface PioneerSchoolLettersProps {
  userId: string;
  isAdmin?: boolean;
  canManage?: boolean;
  selectedTurma: '1' | '2' | '3';
  schoolInfo: {
    dataTurma: string;
    instrutorA: string;
    instrutorB: string;
    localEscola: string;
    enderecoEscola: string;
    entregaLivroEndereco: string;
    entregaLivroDataHora: string;
    confirmacaoDataLimite: string;
    confirmacaoEmail: string;
    confirmacaoWhatsapp: string;
    confirmacaoEmailB: string;
    confirmacaoWhatsappB: string;
  };
  customTemplates?: Template[];
  category: 'esp' | 'emr';
  color?: string;
  gradient?: string;
  initialMode?: 'geracao' | 'manager';
}

const DEFAULT_TEMPLATES = [
  { id: 'esp_anfitria', name: 'Carta à anfitriã' },
  { id: 'esp_refeicoes', name: 'Carta convites refeições' },
  { id: 'esp_pioneiros', name: 'Carta convite pioneiros' },
];

export default function PioneerSchoolLetters({ 
  userId,
  isAdmin,
  canManage,
  selectedTurma, 
  schoolInfo,
  customTemplates,
  category,
  color = '#10B981',
  gradient = 'from-emerald-500 to-teal-600',
  initialMode = 'geracao'
}: PioneerSchoolLettersProps) {
  const { showAlert, showConfirm } = useDialog();
  const templatesList = customTemplates || DEFAULT_TEMPLATES;
  const [selectedTemplate, setSelectedTemplate] = useState<string>(templatesList[0].id);
  const [templates, setTemplates] = useState<Record<string, { content: string, updatedAt: string, isPrivate?: boolean }>>({});
  const [personalData, setPersonalData] = useState<any>(null);
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [processedDocBuffer, setProcessedDocBuffer] = useState<ArrayBuffer | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  
  // Management state
  const [isManaging, setIsManaging] = useState(initialMode === 'manager' && (isAdmin || canManage));
  const [file, setFile] = useState<File | null>(null);
  const [localFileBuffer, setLocalFileBuffer] = useState<ArrayBuffer | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [missingTags, setMissingTags] = useState<string[]>([]);
  const [saveAsGlobal, setSaveAsGlobal] = useState(false);

  const [needsProcessing, setNeedsProcessing] = useState(true);

  const previewRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const viewerRef = useRef<any>(null);
  const [isViewerReady, setIsViewerReady] = useState(false);

  // Determine current colors based on status/category
  const activeColor = color;
  const activeGradient = gradient;

  // Initialize viewer once
  useEffect(() => {
    let destroyed = false;

    const initViewer = async () => {
      // Small delays to ensure container is fully loaded and attached to DOM
      for (let i = 0; i < 15; i++) {
        if (previewRef.current) break;
        await new Promise(r => setTimeout(r, 50));
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
          
          // Add a delay before marking as ready to ensure internal setup is complete
          setTimeout(() => {
            if (!destroyed && viewerRef.current) {
               setIsViewerReady(true);
            }
          }, 600);
        }
      } catch (err: any) {
        console.error('UDoc Viewer Init Error inside PioneerSchoolLetters:', err);
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
        } catch (e) {}
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
            throw new Error('Viewer not ready');
          }
          const loadData = new Uint8Array(buffer);
          await viewerRef.current.load(loadData);
          try {
            await (viewerRef.current as any).setZoomMode('fit-page-width');
          } catch (e) {}
        } catch (err: any) {
          if (!active) return;
          console.error('UDoc Viewer Load Error (ESP):', err);
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
    const q = query(collection(db, 'document_templates'), where('category', '==', category));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedTemplates: Record<string, any> = {};
      snapshot.forEach((doc) => {
        fetchedTemplates[doc.id] = doc.data();
      });

      const consolidated: Record<string, any> = {};
      templatesList.forEach(t => {
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
      console.error('Error listening to templates:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userId]);

  useEffect(() => {
    fetchPersonalData();
  }, [userId]);

  const fetchPersonalData = async () => {
    try {
      const docRef = doc(db, 'personal_data', userId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setPersonalData(docSnap.data());
      } else {
        const q = query(collection(db, 'personal_data'), where('userId', '==', userId), limit(1));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          setPersonalData(querySnapshot.docs[0].data());
        }
      }
    } catch (error) {
      console.error('Error fetching personal data:', error);
    }
  };

  // Prevent infinite loops by stringifying objects for dependency array
  const schoolInfoKey = JSON.stringify(schoolInfo);
  const personalDataKey = JSON.stringify(personalData);

  // Automatically process when template or data changes
  useEffect(() => {
    if (localFileBuffer) {
      console.log('Using local file buffer for preview (ESP)');
      processAndPreview(localFileBuffer);
    } else if (templates[selectedTemplate]) {
      setNeedsProcessing(true);
      processAndPreview();
    } else {
      setPreviewHtml('<div class="h-full flex flex-col items-center justify-center text-red-400 py-20 px-10 text-center text-xs uppercase font-black tracking-widest leading-relaxed">Template não encontrado no banco de dados.<br/>Carregue o arquivo .docx no Gerenciador de Uploads primeiro.</div>');
      setProcessedDocBuffer(null);
      setStatus('idle');
    }
  }, [selectedTemplate, templates, schoolInfoKey, personalDataKey]);

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

  const getReplacements = () => {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('pt-BR', { 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    });
    const hoje = formatter.format(now);

    const turma = `Turma ${selectedTurma}`;
    const dataValue = schoolInfo.dataTurma || '________________';
    const instrutores = `${schoolInfo.instrutorA || '________________'} e ${schoolInfo.instrutorB || '________________'}`;
    const local = schoolInfo.localEscola || '________________';
    const endereco = schoolInfo.enderecoEscola || '________________';
    const enderecoEntrega = schoolInfo.entregaLivroEndereco || '________________';
    const dataEntrega = schoolInfo.entregaLivroDataHora || '________________';
    const dataConfirmacao = schoolInfo.confirmacaoDataLimite || '________________';
    const email = schoolInfo.confirmacaoEmail || '________________';
    const contato = schoolInfo.confirmacaoWhatsapp || '________________';
    
    // Contatos Instructor A e B
    const emailA = schoolInfo.confirmacaoEmail || '________________';
    const contatoA = schoolInfo.confirmacaoWhatsapp || '________________';
    const emailB = schoolInfo.confirmacaoEmailB || emailA; 
    const contatoB = schoolInfo.confirmacaoWhatsappB || contatoA;

      const signatureName = personalData?.nome || '________________';
      const circuito = personalData?.circuito || '________________';
      const signatureText = `${signatureName} (${circuito})`;
      const signatureImage = personalData?.signatureImage || null;
      const hasImage = signatureImage && signatureImage.startsWith('data:image');
      const signatureValue = hasImage ? signatureImage : signatureText;
      const telefoneCircuito = personalData?.telefoneCircuito || '________________';

      return {
        'TURMA': turma,
        'DATA': schoolInfo.dataTurma || hoje,
        'TURMA_DATA': schoolInfo.dataTurma || hoje,
        'DATA_TURMA': schoolInfo.dataTurma || hoje,
        'DATATURMA': schoolInfo.dataTurma || hoje,
        'INSTRUTORES': instrutores,
        'INSTRUTOR1': schoolInfo.instrutorA || '________________',
        'INSTRUTOR2': schoolInfo.instrutorB || '________________',
        'INSTRUTORA': schoolInfo.instrutorA || '________________',
        'INSTRUTORB': schoolInfo.instrutorB || '________________',
        'LOCAL': local,
        'LOCALESCOLA': local,
        'LOCAL_ESCOLA': local,
        'ENDEREÇO': endereco,
        'ENDERECO': endereco,
        'ENDEREÇOESCOLA': endereco,
        'ENDERECOESCOLA': endereco,
        'ENDEREÇO_ESCOLA': endereco,
        'ENDERECOENTREGA': enderecoEntrega,
        'ENDEREÇOENTREGA': enderecoEntrega,
        'DATAENTREGA': dataEntrega,
        'DATACONFIRMAÇÃO': dataConfirmacao,
        'DATACONFIRMACAO': dataConfirmacao,
        'EMAIL': email,
        'CONTATO': contato,
        'WHATSAPP': contato,
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
        'nome do instrutor': signatureText,
        'NOME DO INSTRUTOR': signatureText,
        'instrutor': signatureText,
        'INSTRUTOR': signatureText,
        'ASSINATURA': signatureValue,
        'assinatura': signatureValue,
        'ASSINATURA_GLOBAL': signatureValue,
        'assinatura_global': signatureValue,
        'ASSINATURA GLOBAL': signatureValue,
        '%ASSINATURA': hasImage ? signatureValue : '',
        '%assinatura': hasImage ? signatureValue : '',
        '%ASSINATURA_GLOBAL': hasImage ? signatureValue : '',
        '%assinatura_global': hasImage ? signatureValue : '',
        'VIAJANTE': signatureName,
        'viajante': signatureName,
        'NOME_VIAJANTE': signatureName,
        'NOME': signatureName,
        'nome': signatureName,
        'CIRCUITO': circuito,
        'NOME_CIRCUITO': circuito,
        'TELEFONE': telefoneCircuito,
        'FONE': telefoneCircuito,
        'TELEFONE_CIRCUITO': telefoneCircuito,
        'TELEFONECIRCUITO': telefoneCircuito,
        'HOJE': hoje,
        'DATA_ATUAL': hoje
      };
  };

  const processAndPreview = async (overrideBuffer?: ArrayBuffer) => {
    const template = templates[selectedTemplate];
    if (!template && !overrideBuffer) return;

    setIsProcessing(true);
    setStatus('idle');

    try {
      let sourceBuffer: ArrayBuffer;
      if (overrideBuffer) {
        sourceBuffer = overrideBuffer;
      } else {
        const binaryString = window.atob(template.content);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        sourceBuffer = bytes.buffer;
      }
      
      // Clean metadata
      const cleanedBuffer = cleanPSSMetadata(sourceBuffer);
      const zip = new PizZip(cleanedBuffer);
      
      const replacements = getReplacements();
      
      // Pre-process all XML files in the zip (document, headers, footers)
      const xmlFiles = zip.file(/word\/(document|header\d+|footer\d+)\.xml/);
      
      xmlFiles.forEach(xmlResource => {
        let xmlContent = xmlResource.asText();
        
        // 1. Clean up common Word junk
        xmlContent = xmlContent.replace(/<w:proofErr w:type="(?:spell|gram)(?:Start|End)"\/>/g, "");
        xmlContent = xmlContent.replace(/<w:noProof\/>/g, "");
        
        // Join split tags
        for (let i = 0; i < 6; i++) {
          xmlContent = xmlContent.replace(/(@|\[[#\/^>?]?)([A-Za-z0-9À-ÿ\u00C0-\u00FF\_]*)(<\/w:t>(?:<(?!w:p|w:tr|w:tbl|w:br|w:tc|w:tr)[^>]+>)*?<w:t[^>]*>)([A-Za-z0-9À-ÿ\u00C0-\u00FF\_]+|\])/g, "$1$2$4$3");
        }
        
        // Final cleaning of common split patterns
        xmlContent = xmlContent.replace(/(@[A-Za-z0-9À-ÿ\_]*)(<\/w:t><\/w:r><w:r><w:t>)/g, "$1");

        // Forceful layout fix for tables containing our form labels
        const labelCheck = /Dia:|Assinatura:|Unidade:|Instruções:|Cena:|Tempo:|Designação:|Participante\(s\):|Participan-te\(s\):/;
        
        if (labelCheck.test(xmlContent)) {
          xmlContent = xmlContent.replace(/<w:tbl>([\s\S]*?)<\/w:tbl>/g, (tblMatch, tblInner) => {
            if (!labelCheck.test(tblInner)) return tblMatch;
            // Avoid nested tables for simplicity
            if (tblInner.indexOf('<w:tbl>') !== -1) return tblMatch;

            // Count max columns in any row to fix the grid correctly
            let maxCols = 0;
            const rows = tblInner.match(/<w:tr(?: [^>]*)?>([\s\S]*?)<\/w:tr>/g) || [];
            rows.forEach((row: string) => {
              const cells = row.match(/<w:tc(?: [^>]*)?>([\s\S]*?)<\/w:tc>/g) || [];
              if (cells.length > maxCols) maxCols = cells.length;
            });

            if (maxCols < 2) return tblMatch; // Only fix if it's meant to be a multi-column table

            let fixedTbl = tblInner;
            
            // 1. Fix Table Grid (Columns)
            fixedTbl = fixedTbl.replace(/<w:tblGrid>[\s\S]*?<\/w:tblGrid>/, () => {
              let grid = '<w:tblGrid>';
              grid += '<w:gridCol w:w="3000"/>'; // First column (Label)
              grid += '<w:gridCol w:w="6638"/>'; // Second column (Value)
              for (let i = 2; i < maxCols; i++) {
                grid += '<w:gridCol w:w="1000"/>';
              }
              grid += '</w:tblGrid>';
              return grid;
            });
            
            // 2. Fix Table Properties
            fixedTbl = fixedTbl.replace(/<w:tblPr>([\s\S]*?)<\/w:tblPr>/, (match: string, prInner: string) => {
              let pr = prInner;
              const tblW = '<w:tblW w:w="9638" w:type="dxa"/>';
              const tblInd = '<w:tblInd w:w="0" w:type="dxa"/>';
              const tblLayout = '<w:tblLayout w:type="fixed"/>';
              
              pr = pr.replace(/<w:tblW [^>]*\/>/g, "").replace(/<w:tblInd [^>]*\/>/g, "").replace(/<w:tblLayout [^>]*\/>/g, "");
              return `<w:tblPr>${tblW}${tblInd}${tblLayout}${pr}</w:tblPr>`;
            });
            
            // 3. Fix Rows and Cells
            fixedTbl = fixedTbl.replace(/<w:tr(?: [^>]*)?>([\s\S]*?)<\/w:tr>/g, (trMatch: string, trInner: string) => {
              let cCount = 0;
              const fixedTrInner = trInner.replace(/<w:tc(?: [^>]*)?>([\s\S]*?)<\/w:tc>/g, (tcMatch: string, tcInner: string) => {
                cCount++;
                if (cCount > maxCols) return tcMatch;
                
                const width = cCount === 1 ? "3000" : (cCount === 2 ? "6638" : "1000");
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
                
                tcPr = tcPr.replace(/<w:tcW [^>]*\/>/g, "").replace(/<w:noWrap\/>/g, "").replace(/<w:tcMar>[\s\S]*?<\/w:tcMar>/g, "");
                const newProps = `<w:tcW w:w="${width}" w:type="dxa"/>${isLabelCell ? '<w:noWrap/>' : ''}<w:tcMar><w:left w:w="40" w:type="dxa"/><w:right w:w="120" w:type="dxa"/></w:tcMar>`;
                tcPr = tcPr.replace(/<\/w:tcPr>/, `${newProps}</w:tcPr>`);
                
                return `<w:tc>${tcPr}${tcRest}</w:tc>`;
              });
              return `<w:tr>${fixedTrInner}</w:tr>`;
            });
            
            return `<w:tbl>${fixedTbl}</w:tbl>`;
          });
        }

        
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

        // 1. Clean up common Word junk
        xmlContent = xmlContent.replace(/<w:proofErr w:type="(?:spell|gram)(?:Start|End)"\/>/g, "");
        xmlContent = xmlContent.replace(/<w:noProof\/>/g, "");

        // 2. Join split tags
        for (let i = 0; i < 6; i++) {
          xmlContent = xmlContent.replace(/(@|\[[#\/^>?]?)([A-Za-z0-9À-ÿ\u00C0-\u00FF\_]*)(<\/w:t>(?:<(?!w:p|w:tr|w:tbl|w:br|w:tc|w:tr)[^>]+>)*?<w:t[^>]*>)([A-Za-z0-9À-ÿ\u00C0-\u00FF\_]+|\])/g, "$1$2$4$3");
        }
        
        // 3. Surgical replacement of @TAG to [TAG] and handle signature tags
        const sigVal = replacements.ASSINATURA;
        const hasImageInLoop = Boolean(sigVal && typeof sigVal === 'string' && sigVal.startsWith('data:image'));
        
        xmlContent = xmlContent.replace(/(<w:t[^>]*>)(.*?)(<\/w:t>)/g, (match: string, opening: string, text: string, closing: string) => {
          let newText = text;
          
          // Unified Signature Handling
          const sigRegex = /@Assinatura(?:[\s\_]Global)?|\[%?ASSINATURA(?:[\s\_]Global)?\]/gi;
          if (hasImageInLoop) {
            newText = newText.replace(sigRegex, '[%ASSINATURA]');
          } else {
            newText = newText.replace(sigRegex, '[ASSINATURA]');
          }
          
          // Replace other @TAGs
          newText = newText.replace(/(^|[^A-Za-z0-9À-ÿ\u00C0-\u00FF])@([A-Za-z0-9À-ÿ\_]+)/g, (m: string, p1: string, p2: string) => {
            const tagName = p2.toUpperCase();
            if (tagName === 'ASSINATURA') return m; // Already handled
            return `${p1}[${tagName}]`;
          });
          
          return `${opening}${newText}${closing}`;
        });

        zip.file(xmlResource.name, xmlContent);
      });
      
      // For preview, we want to show the signature text as well
      const previewReplacements = { ...replacements };

      // Setup Image Module
      const ImageModule = (await import('docxtemplater-image-module-free')).default;
      
      // Calculate signature dimensions to avoid "squeezing"
      const signatureScale = personalData?.signatureSize || 60;
      let sigHeight = signatureScale;
      let sigWidth = sigHeight * 2.5; // Default aspect ratio
      
      if (replacements.ASSINATURA && replacements.ASSINATURA.startsWith('data:image')) {
        try {
          const img = new window.Image();
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = replacements.ASSINATURA;
          });
          
          const aspectRatio = img.width / img.height;
          sigHeight = signatureScale;
          sigWidth = sigHeight * aspectRatio;
          
          // Maximum width constraint
          if (sigWidth > 350) {
            sigWidth = 350;
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
            console.error('Error decoding signature image in ESP:', e);
            return null;
          }
        },
        getSize: () => [sigWidth, sigHeight],
      };

      // Also generate the "real" buffer with signed content for download & preview
      const docReal = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
        delimiters: { start: '[', end: ']' },
        modules: ImageModule ? [new ImageModule(opts)] : []
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
      setPreviewHtml(`<div class="text-red-500 p-8 font-black bg-red-50 rounded-xl border border-red-100 uppercase text-xs">Erro ao processar: ${err.message}</div>`);
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
    const templateName = templatesList.find(t => t.id === selectedTemplate)?.name || selectedTemplate;
    link.download = `${templateName}_Turma${selectedTurma}.docx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadAsPdf = async () => {
    if (!previewRef.current || status !== 'success') return;
    
    setGenerating(true);
    try {
      const templateName = templatesList.find(t => t.id === selectedTemplate)?.name || selectedTemplate;
      const filename = `${templateName}_Turma${selectedTurma}.pdf`;

      const viewer = viewerRef.current;
      // Optimized: Use internal viewer render engine if available for higher fidelity
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
        for (let i = 0; i < pageElements.length; i++) {
          const originalPage = pageElements[i];
          if (originalPage.classList.contains('udoc-viewer-toolbar') || originalPage.tagName === 'NAV') continue;

          if (i > 0) pdf.addPage();
          
          originalPage.scrollIntoView();
          await new Promise(resolve => setTimeout(resolve, 100));

          const dataUrl = await toPng(originalPage, {
            pixelRatio: 4,
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
        console.log('File selected (ESP):', selectedFile.name);
        setFile(selectedFile);
        try {
          const rawBuffer = await selectedFile.arrayBuffer();
          const cleanedBuffer = cleanPSSMetadata(rawBuffer);
          setLocalFileBuffer(cleanedBuffer);

          // Validate tags
          const tags = await extractTagsFromDocx(cleanedBuffer);
          const required = [
            ['DATA', 'TURMA_DATA', 'DATATURMA'],
            ['ASSINATURA', '%ASSINATURA', 'ASSINATURA_GLOBAL'],
            ['VIAJANTE', 'NOME_VIAJANTE'],
            ['CIRCUITO', 'NOME_CIRCUITO']
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
    if (!file || !localFileBuffer) return;
    setIsSaving(true);
    setSaveStatus('idle');
    try {
      const blob = new Blob([localFileBuffer]);
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      const isGlobal = isAdmin && saveAsGlobal;
      const docId = isGlobal ? selectedTemplate : `${userId}_${selectedTemplate}`;
      await setDoc(doc(db, 'document_templates', docId), {
        name: selectedTemplate,
        content: base64,
        updatedAt: new Date().toISOString(),
        category: category,
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

      await showAlert(isGlobal ? 'Modelo substituído com sucesso para TODOS os usuários.' : 'Seu modelo personalizado foi atualizado com sucesso!', 'Sucesso');
      setSaveStatus('success');
      setFile(null);
      setLocalFileBuffer(null);
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (error: any) {
      console.error('Error saving template:', error);
      setErrorMessage(error.message || 'Erro ao salvar');
      setSaveStatus('error');
      await showAlert('Erro ao salvar template: ' + error.message, 'Erro');
    } finally {
      setIsSaving(false);
    }
  };

  const deletePrivateTemplate = async () => {
    const templateData = templates[selectedTemplate];
    if (!templateData?.isPrivate) return;
    if (!(await showConfirm('Tem certeza que deseja excluir sua versão personalizada deste modelo? O sistema voltará a usar o modelo padrão.', 'Excluir Versão Personalizada'))) return;
    
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
        <RefreshCw size={32} className="text-emerald-500 animate-spin" />
        <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">Carregando Uploads...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-auto lg:h-[calc(100vh-140px)] min-h-[500px]">
      {/* Mobile Top Controls: Compact template selector & immediate action buttons */}
      <div className="lg:hidden flex flex-col gap-3 p-4 bg-surface-100 rounded-3xl border border-surface-300 shadow-2xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-transparent border border-emerald-500/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Mail size={16} strokeWidth={1.8} />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-typography-400">Modelo</span>
              <h4 className="text-xs font-bold text-typography-900 leading-tight">
                {templatesList.find(t => t.id === selectedTemplate)?.name || selectedTemplate}
              </h4>
            </div>
          </div>
          
          {canManage && (
            <button
              onClick={() => setIsManaging(!isManaging)}
              className={`p-2 rounded-xl transition-all border ${
                isManaging 
                  ? 'bg-primary-200 text-white border-primary-200' 
                  : 'bg-surface-200 text-typography-700 border-surface-300 hover:bg-surface-300'
              }`}
              title="Configurar Templates"
            >
              <Settings2 size={16} />
            </button>
          )}
        </div>

        <CustomSelect
          value={selectedTemplate}
          onChange={(val) => setSelectedTemplate(val)}
          options={templatesList.map(t => ({
            value: t.id,
            label: t.name,
            badge: templates[t.id]?.isPrivate ? 'Privado' : templates[t.id] ? 'Global' : undefined
          }))}
          className="w-full"
          dropdownClassName="w-full max-w-full"
          size="sm"
        />

        {/* Action Buttons for Mobile */}
        <div className="flex items-center gap-2 pt-1">
          {needsProcessing ? (
            <button
              onClick={() => processAndPreview()}
              disabled={isProcessing}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-primary-200 text-white rounded-xl shadow-xs hover:bg-primary-300 active:scale-[0.98] transition-all disabled:opacity-50 font-bold text-xs"
            >
              {isProcessing ? <RefreshCw size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              Gerar Carta Agora
            </button>
          ) : (
            <>
              <button
                onClick={downloadAsDocx}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-surface-200 text-typography-800 rounded-xl border border-surface-300 hover:bg-surface-300 transition-all font-bold text-xs"
              >
                <FileDown size={14} className="text-primary-200" />
                DOCX
              </button>
              <button
                onClick={downloadAsPdf}
                disabled={generating}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-surface-200 text-typography-800 rounded-xl border border-surface-300 hover:bg-surface-300 transition-all font-bold text-xs disabled:opacity-50"
              >
                {generating ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} className="text-primary-200" />}
                PDF
              </button>
              <button
                onClick={() => viewerRef.current?.print()}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-primary-200 text-white rounded-xl shadow-xs hover:bg-primary-300 transition-all font-bold text-xs"
              >
                <Printer size={14} />
                Imprimir
              </button>
            </>
          )}
        </div>
      </div>

      {/* Desktop Sidebar: Selection & Settings Toggle */}
      <div className="hidden lg:flex w-72 flex-col gap-4 shrink-0 overflow-y-auto pr-1 custom-scrollbar">
        <div className="bg-surface-100 p-4 rounded-3xl border border-surface-300 shadow-xs space-y-4">
          <div className="flex items-center justify-between px-1">
            <h3 className="font-black text-typography-900 text-[10px] uppercase tracking-[0.2em] flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-transparent border border-emerald-500/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <Mail size={12} strokeWidth={1.8} />
              </div>
              Modelos
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
            {templatesList.map(template => (
              <button
                key={template.id}
                onClick={() => setSelectedTemplate(template.id)}
                className={`flex items-center gap-3 px-3 py-2.5 transition-all border rounded-2xl text-left group relative overflow-hidden ${
                   selectedTemplate === template.id
                    ? 'bg-surface-200 text-typography-900 border-primary-200/60 shadow-2xs ring-1 ring-primary-200/30'
                    : 'bg-surface-200/40 text-typography-600 border-surface-300/80 hover:border-surface-300 hover:bg-surface-200 hover:text-typography-900'
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors shrink-0 border ${
                  selectedTemplate === template.id 
                    ? 'border-primary-200/60 text-primary-200 bg-transparent' 
                    : 'border-surface-300 text-typography-400 bg-transparent'
                }`}>
                  <Mail size={16} strokeWidth={1.8} />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="block font-black uppercase tracking-tight text-[10px] leading-tight truncate">{template.name}</span>
                  {templates[template.id] ? (
                    <div className="flex items-center gap-1 mt-0.5">
                      <CheckCircle2 size={8} className="text-emerald-500" />
                      <span className="text-[6px] font-black uppercase tracking-widest text-typography-400">
                        {templates[template.id].isPrivate ? 'PRIVADO' : 'GLOBAL'}
                      </span>
                    </div>
                  ) : (
                    <span className="text-[6px] font-black uppercase tracking-widest text-rose-500 leading-none mt-1 block">
                      Não configurado
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
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
                  <div className="w-10 h-10 rounded-xl bg-transparent border border-emerald-500/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <FileUp size={20} strokeWidth={1.8} />
                  </div>
                  <div>
                    <h4 className="text-[11px] font-black text-typography-900 uppercase tracking-widest">
                      Configurar Template
                    </h4>
                    <p className="text-[8px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">
                      {templatesList.find(t => t.id === selectedTemplate)?.name}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsManaging(false)} 
                  className="w-8 h-8 flex items-center justify-center bg-surface-100 rounded-full text-typography-400 hover:text-rose-500 border border-surface-300 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

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
                    <span className="font-black uppercase text-[9px] tracking-[0.2em] px-4 truncate w-full text-center">{file ? file.name : 'Selecionar Novo DOCX'}</span>
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
                  <button
                    onClick={saveTemplate}
                    disabled={!file || isSaving}
                    className="w-full h-12 bg-primary-200 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest disabled:opacity-50 hover:bg-primary-300 shadow-xs transition-all flex items-center justify-center gap-2"
                  >
                    {isSaving ? <RefreshCw className="animate-spin" size={16} /> : <Save size={16} />}
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
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[8px] font-black text-typography-500 uppercase tracking-widest">Prévia em Tempo Real</span>
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
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #cbd5e1;
        }
      `}</style>
    </div>
  );
}
