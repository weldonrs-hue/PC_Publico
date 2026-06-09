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
  AlertCircle,
  FileDown,
  Mail,
  PenTool,
  Sparkles,
  Trash2,
  Settings2,
  FileUp,
  Save,
  Printer,
  User,
  ChevronDown,
  Info
} from 'lucide-react';
import { extractTagsFromDocx, getMissingTags, cleanPSSMetadata } from '@/lib/docxUtils';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, getDoc, query, where, limit, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '@/utils/firestore';

interface CongressLettersProps {
  userId: string;
  isAdmin?: boolean;
  canManage?: boolean;
  initialMode?: 'geracao' | 'manager';
}

const CONGRESSO_TEMPLATES = [
  { id: 'cong_convite_oracao', name: 'Convite Oração' },
  { id: 'cong_presidente_sessao', name: 'Presidente Sessão' },
  { id: 'cong_aviso_treinamentos', name: 'Aviso Treinamentos' },
];

export default function CongressLetters({ 
  userId,
  isAdmin,
  canManage,
  initialMode = 'geracao'
}: CongressLettersProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<string>(CONGRESSO_TEMPLATES[0].id);
  const [templates, setTemplates] = useState<Record<string, { content: string, updatedAt: string, isPrivate?: boolean }>>({});
  const [personalData, setPersonalData] = useState<any>(null);
  const [conventionData, setConventionData] = useState<any>(null);
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [processedDocBuffer, setProcessedDocBuffer] = useState<ArrayBuffer | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  
  // Management state
  const [isManaging, setIsManaging] = useState(initialMode === 'manager');
  const [file, setFile] = useState<File | null>(null);
  const [localFileBuffer, setLocalFileBuffer] = useState<ArrayBuffer | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [missingTags, setMissingTags] = useState<string[]>([]);
  const [saveAsGlobal, setSaveAsGlobal] = useState(false);

  // Selector state for preview variations
  const [selectedSpeaker, setSelectedSpeaker] = useState<string>('');

  const [needsProcessing, setNeedsProcessing] = useState(true);

  const previewRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const viewerRef = useRef<any>(null);
  const [isViewerReady, setIsViewerReady] = useState(false);

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
          disableLeftPanel: true,
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

          // Add a generous delay before marking as ready to ensure internal setup is complete
          setTimeout(() => {
            if (!destroyed && viewerRef.current) {
               setIsViewerReady(true);
            }
          }, 1000);
        }
      } catch (err: any) {
        console.error('UDoc Viewer Init Error inside CongressLetters:', err);
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
        } catch (err: any) {
          if (!active) return;
          console.error('UDoc Viewer Load Error (Congress):', err);
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
    const q = query(collection(db, 'document_templates'), where('category', '==', 'congresso'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedTemplates: Record<string, any> = {};
      snapshot.forEach((doc) => {
        fetchedTemplates[doc.id] = doc.data();
      });

      const consolidated: Record<string, any> = {};
      CONGRESSO_TEMPLATES.forEach(t => {
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
    fetchConventionData();
  }, [userId]);

  const fetchPersonalData = async () => {
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

  const fetchConventionData = async () => {
    try {
      const docRef = doc(db, 'regional_convention_speakers', userId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setConventionData(data);
        
        // Auto-select first speaker found for preview
        const speakers = Object.values(data.speakers || {}) as string[];
        if (speakers.length > 0 && !selectedSpeaker) {
          setSelectedSpeaker(speakers[0]);
        }
      }
    } catch (error) {
      console.error('Error fetching convention data:', error);
    }
  };

  // Automatically process when template or data changes
  useEffect(() => {
    if (localFileBuffer) {
      console.log('Using local file buffer for preview (Congress)');
      processAndPreview(localFileBuffer);
    } else if (templates[selectedTemplate]) {
      setNeedsProcessing(true);
      processAndPreview();
    } else {
      setPreviewHtml('<div class="h-full flex flex-col items-center justify-center text-red-400 py-20 px-10 text-center text-xs uppercase font-black tracking-widest leading-relaxed">Template não encontrado no banco de dados.<br/>Carregue o arquivo .docx no Gerenciador de Uploads primeiro.</div>');
      setProcessedDocBuffer(null);
      setStatus('idle');
    }
  }, [selectedTemplate, templates, conventionData, selectedSpeaker, personalData]);

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
    const details = conventionData?.details || {};
    const signatureName = personalData?.nome || '________________';
    const circuito = personalData?.circuito || '________________';
    const signatureText = `${signatureName} (${circuito})`;
    const signatureImage = personalData?.signatureImage || null;
    const hasImage = signatureImage && signatureImage.startsWith('data:image');
    const signatureValue = hasImage ? signatureImage : signatureText;
    const telefoneCircuito = personalData?.telefoneCircuito || personalData?.telefone || '________________';
    
    // Para o preview, se não houver orador selecionado, usamos um placeholder
    const speakerName = selectedSpeaker || 'NOME DO ORADOR';
    
    // Determinar designação fictícia para o preview
    let designation = 'DESIGNAÇÃO';
    if (selectedTemplate === 'cong_convite_oracao') designation = 'Oração Inicial';
    else if (selectedTemplate === 'cong_presidente_sessao') designation = 'Presidente de Sessão';
    else designation = 'Assignment / Discurso';

    return {
      'ANO': '2026',
      'TEMA': details.conventionTheme || '________________',
      'DATA': details.eventDate || '________________',
      'LOCAL': details.eventLocation || '________________',
      'DESIGNAÇÃO': designation,
      'DESIGNACAO': designation,
      'DIA': 'Sexta-feira',
      'ORADOR': speakerName,
      'ASSINATURA': signatureValue,
      'assinatura': signatureValue,
      '%ASSINATURA': hasImage ? signatureValue : '',
      'ASSINATURA_GLOBAL': signatureValue,
      'VIAJANTE': signatureName,
      'viajante': signatureName,
      'NOME_VIAJANTE': signatureName,
      'CIRCUITO': circuito,
      'NOME_CIRCUITO': circuito,
      'FONE': telefoneCircuito,
      'TELEFONE': telefoneCircuito,
      'DATAHORA': details.trainingDate || '________________',
      'LOCALTREINO': details.trainingLocation || '________________',
      'HOJE': new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date()),
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
      
      const cleanedBuffer = cleanPSSMetadata(sourceBuffer);
      const zip = new PizZip(cleanedBuffer);
      
      const xmlFiles = zip.file(/word\/(document|header\d*|footer\d*)\.xml/);
      xmlFiles.forEach(file => {
        let xmlContent = file.asText();
        xmlContent = xmlContent.replace(/<w:proofErr w:type="(?:spell|gram)(?:Start|End)"\/>/g, "");
        xmlContent = xmlContent.replace(/<w:noProof\/>/g, "");
        
        // Join split text nodes to improve tag detection (very common in Word)
        xmlContent = xmlContent.replace(/<\/w:t><w:t[^>]*>/g, "");
        xmlContent = xmlContent.replace(/<\/w:t><\/w:r><w:r[^>]*><w:t[^>]*>/g, "");

        // Forceful layout fix for tables containing our form labels
        const labelCheck = /Dia:|Assinatura:|Unidade:|Instruções:|Cena:|Tempo:|Designação:|Participante\(s\):|Participan-te\(s\):/;
        
        if (labelCheck.test(xmlContent)) {
          xmlContent = xmlContent.replace(/<w:tbl>([\s\S]*?)<\/w:tbl>/g, (tblMatch, tblInner) => {
            if (!labelCheck.test(tblInner)) return tblMatch;
            // Avoid nested tables for simplicity
            if (tblInner.indexOf('<w:tbl>') !== -1) return tblMatch;

            let fixedTbl = tblInner;
            
            // 1. Fix Table Grid (Columns)
            fixedTbl = fixedTbl.replace(/<w:tblGrid>[\s\S]*?<\/w:tblGrid>/, () => {
              return `<w:tblGrid><w:gridCol w:w="3200"/><w:gridCol w:w="6438"/></w:tblGrid>`;
            });
            
            // 2. Fix Table Properties
            fixedTbl = fixedTbl.replace(/<w:tblPr>([\s\S]*?)<\/w:tblPr>/, (match, prInner) => {
              let pr = prInner;
              const tblW = '<w:tblW w:w="9638" w:type="dxa"/>';
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
                if (cCount > 2) return tcMatch;
                
                const width = cCount === 1 ? "3200" : "6438";
                const noWrap = cCount === 1;
                
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
                const newProps = `<w:tcW w:w="${width}" w:type="dxa"/>${noWrap ? '<w:noWrap/>' : ''}<w:tcMar><w:left w:w="40" w:type="dxa"/><w:right w:w="40" w:type="dxa"/></w:tcMar>`;
                tcPr = tcPr.replace(/<\/w:tcPr>/, `${newProps}</w:tcPr>`);
                
                return `<w:tc>${tcPr}${tcRest}</w:tc>`;
              });
              return `<w:tr>${fixedTrInner}</w:tr>`;
            });
            
            return `<w:tbl>${fixedTbl}</w:tbl>`;
          });
        }

        // Ensure namespaces are present for images
        if (!xmlContent.includes('xmlns:wp=')) {
          xmlContent = xmlContent.replace(/(<w:(?:document|hdr|ftr)[^>]*)/, (match) => {
            if (match.includes('xmlns:wp=')) return match;
            return `${match} xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape" xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas" xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"`;
          });
        }
        
        // 3. Surgical replacement of @TAG to [TAG]
        const hasImage = replacements.ASSINATURA && typeof replacements.ASSINATURA === 'string' && replacements.ASSINATURA.startsWith('data:image');
        xmlContent = xmlContent.replace(/(<w:t[^>]*>)(.*?)(<\/w:t>)/g, (match, opening, text, closing) => {
          let newText = text;
          // Handle Signature
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
      
      const replacements = getReplacements();
      const ImageModule = (await import('docxtemplater-image-module-free')).default;
      
    const signatureScale = personalData?.signatureSize || 60;
    let sigHeight = signatureScale;
    let sigWidth = sigHeight * 2.5; // Default aspect ratio
    
    if (replacements.ASSINATURA && replacements.ASSINATURA.startsWith('data:image')) {
      try {
        const img = new Image();
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
          if (!tagValue || !tagValue.startsWith('data:image')) return null;
          const base64Data = tagValue.split(',')[1];
          const binaryStringArray = window.atob(base64Data);
          const bytesArray = new Uint8Array(binaryStringArray.length);
          for (let i = 0; i < binaryStringArray.length; i++) {
            bytesArray[i] = binaryStringArray.charCodeAt(i);
          }
          return bytesArray.buffer;
        },
        getSize: () => [sigWidth, sigHeight],
      };

      const docObj = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
        delimiters: { start: '[', end: ']' },
        modules: ImageModule ? [new ImageModule(opts)] : []
      });

      docObj.render(replacements);

      const out = docObj.getZip().generate({
        type: 'blob',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });

      const arrayBuffer = await out.arrayBuffer();
      setProcessedDocBuffer(arrayBuffer);
      
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
    const templateName = CONGRESSO_TEMPLATES.find(t => t.id === selectedTemplate)?.name || selectedTemplate;
    link.download = `${templateName}_Congress.docx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadAsPdf = async () => {
    if (!previewRef.current || status !== 'success') return;
    
    setGenerating(true);
    try {
      const filename = `${selectedTemplate}.pdf`;

      // Optimized: Use internal viewer render engine if available for higher fidelity
      if (viewerRef.current && typeof viewerRef.current.renderPage === 'function') {
        const { jsPDF } = await import('jspdf');
        const pageCount = viewerRef.current.pageCount;
        
        if (pageCount > 0) {
          const firstPage = await viewerRef.current.getPageInfo(0);
          const pdf = new jsPDF({
            orientation: firstPage.width > firstPage.height ? 'landscape' : 'portrait',
            unit: 'pt',
            format: [firstPage.width, firstPage.height]
          });

          for (let i = 0; i < pageCount; i++) {
            const pageInfo = await viewerRef.current.getPageInfo(i);
            if (i > 0) {
              pdf.addPage([pageInfo.width, pageInfo.height], pageInfo.width > pageInfo.height ? 'landscape' : 'portrait');
            }

            const dataUrl = await viewerRef.current.renderPage(i, {
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
      alert('Erro ao gerar PDF. Uma alternativa é utilizar a função "Imprimir" e selecionar "Salvar como PDF".');
    } finally {
      setGenerating(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile?.name.endsWith('.docx')) {
      console.log('File selected (Congress):', selectedFile.name);
      setFile(selectedFile);
      try {
        const rawBuffer = await selectedFile.arrayBuffer();
        const cleanedBuffer = cleanPSSMetadata(rawBuffer);
        setLocalFileBuffer(cleanedBuffer);
        
        const tags = await extractTagsFromDocx(cleanedBuffer);
        const required = [
          ['TEMA'], ['DATA'], ['LOCAL'], ['DIA'], ['ORADOR'], 
          ['ASSINATURA', '%ASSINATURA'], ['VIAJANTE'], ['CIRCUITO']
        ];
        setMissingTags(getMissingTags(tags, required));
        setErrorMessage('');
        setSaveStatus('idle');
      } catch (err: any) {
        console.error('Error validating:', err);
        setErrorMessage('Erro ao ler arquivo: ' + err.message);
      }
    }
  };

  const saveTemplate = async () => {
    if (!file || !localFileBuffer) return;
    setIsSaving(true);
    setSaveStatus('idle');
    try {
      const isGlobal = isAdmin && saveAsGlobal;
      const docId = isGlobal ? selectedTemplate : `${userId}_${selectedTemplate}`;
      
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

      await setDoc(doc(db, 'document_templates', docId), {
        name: selectedTemplate,
        content: base64,
        updatedAt: new Date().toISOString(),
        category: 'congresso',
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

      alert(isGlobal ? 'Modelo substituído com sucesso para TODOS os usuários.' : 'Seu modelo personalizado foi atualizado com sucesso.');
      setSaveStatus('success');
      setFile(null);
      setLocalFileBuffer(null);
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (error: any) {
      console.error('Error saving:', error);
      setErrorMessage(error.message || 'Erro ao salvar');
      setSaveStatus('error');
      alert('Erro ao salvar template: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const deletePrivateTemplate = async () => {
    const templateData = templates[selectedTemplate];
    if (!templateData?.isPrivate) return;
    if (!confirm('Tem certeza que deseja excluir sua versão personalizada deste modelo? O sistema voltará a usar o modelo padrão.')) return;
    
    setIsSaving(true);
    try {
      const docId = `${userId}_${selectedTemplate}`;
      await deleteDoc(doc(db, 'document_templates', docId));
      
      console.log('Template private version deleted:', docId);
      
      setSaveStatus('success');
      
      alert('Sua versão personalizada foi excluída. O sistema voltará a usar o modelo padrão.');
      
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (error: any) {
      console.error('Error deleting template:', error);
      setErrorMessage(error.message || 'Erro ao excluir');
      setSaveStatus('error');
      alert('Erro ao excluir versão personalizada: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 space-y-4">
        <RefreshCw size={32} className="text-violet-500 animate-spin" />
        <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">Carregando Cartas...</p>
      </div>
    );
  }

  const speakers = conventionData ? Object.values(conventionData.speakers || {}) as string[] : [];

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col gap-6">
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-extrabold text-gray-900 flex items-center gap-3 text-sm uppercase tracking-widest bg-violet-50 text-violet-700 px-4 py-2 rounded-xl border border-violet-100">
              <Mail size={20} />
              Selecione o Modelo de Carta
            </h3>
            
            {canManage && (
              <button
                onClick={() => setIsManaging(!isManaging)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border shadow-sm ${
                  isManaging 
                    ? 'bg-amber-500 text-white border-amber-400' 
                    : 'bg-white text-violet-600 border-violet-100 hover:bg-violet-50'
                }`}
              >
                <Settings2 size={14} />
                {isManaging ? 'Fechar Gerenciador' : 'Gerenciar Templates'}
              </button>
            )}
          </div>
          
          <div className="flex overflow-x-auto md:grid md:grid-cols-3 gap-4 pb-2 md:pb-0 custom-scrollbar">
            {CONGRESSO_TEMPLATES.map(template => (
              <button
                key={template.id}
                onClick={() => setSelectedTemplate(template.id)}
                className={`w-full text-left px-5 py-4 rounded-2xl text-[16px] font-black transition-all uppercase tracking-tight border-2 flex flex-col gap-2 relative group h-full justify-between ${
                  selectedTemplate === template.id 
                    ? 'bg-violet-600 text-white border-violet-600 shadow-xl scale-[1.02]' 
                    : 'bg-white text-gray-600 border-gray-100 hover:border-violet-200 hover:bg-violet-50 hover:shadow-md'
                }`}
              >
                <div className="flex items-center justify-between gap-2 w-full">
                  <span className="truncate">{template.name}</span>
                  {templates[template.id] && (
                    <CheckCircle2 size={18} className={selectedTemplate === template.id ? 'text-white' : 'text-violet-500'} />
                  )}
                </div>
                {templates[template.id] ? (
                  <div className="flex items-center gap-1.5 mt-auto">
                    <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold shadow-sm ${
                      templates[template.id].isPrivate 
                        ? (selectedTemplate === template.id ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-700')
                        : (selectedTemplate === template.id ? 'bg-white/20 text-white' : 'bg-violet-100 text-violet-700')
                    }`}>
                      {templates[template.id].isPrivate ? 'SEU MODELO' : 'GLOBAL PROGCIR'}
                    </span>
                  </div>
                ) : (
                  <span className="text-[10px] font-bold text-red-400 mt-auto flex items-center gap-1">
                    <AlertCircle size={10} /> NÃO CONFIGURADO
                  </span>
                )}
                {selectedTemplate === template.id && (
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1/2 h-1 bg-white/30 rounded-full blur-[1px]"></div>
                )}
              </button>
            ))}
          </div>
        </div>

        {isManaging && canManage && (
          <div className="bg-amber-50 p-6 rounded-2xl border border-amber-100 space-y-4 animate-in slide-in-from-top-2 duration-300">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black text-amber-700 uppercase tracking-widest flex items-center gap-2">
                <FileUp size={16} />
                Gerenciar Modelo: {CONGRESSO_TEMPLATES.find(t => t.id === selectedTemplate)?.name}
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
                      className={`w-10 h-5 rounded-full transition-all relative ${saveAsGlobal ? 'bg-violet-500' : 'bg-gray-300'}`}
                    >
                      <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${saveAsGlobal ? 'left-6' : 'left-1'}`} />
                    </button>
                  </div>
                )}

                <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".docx" className="hidden" />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className={`w-full flex flex-col items-center justify-center p-6 rounded-xl text-[10px] font-black uppercase tracking-tighter border-2 border-dashed transition-all ${
                    file ? 'bg-white text-emerald-700 border-emerald-300 shadow-inner' : 'bg-white text-gray-400 border-gray-200 hover:border-amber-300 hover:text-amber-600'
                  }`}
                >
                  <FileUp size={24} className={file ? 'text-emerald-500' : 'text-gray-300'} />
                  <span className="mt-2 truncate max-w-full">{file ? file.name : 'CARREGAR NOVO MODELO DOCX'}</span>
                </button>
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
                        saveStatus === 'success' ? 'bg-green-600 text-white' : saveStatus === 'error' ? 'bg-red-600 text-white' : 'bg-violet-600 text-white hover:bg-violet-700'
                      } disabled:opacity-50`}
                    >
                      {isSaving ? <RefreshCw className="animate-spin" size={14} /> : saveStatus === 'success' ? <CheckCircle2 size={14} /> : <Save size={14} />}
                      {isSaving ? 'SALVANDO...' : saveStatus === 'success' ? 'SALVO!' : 'SALVAR MODELO'}
                    </button>
                    
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
                    
                    {saveStatus === 'error' && (
                      <p className="text-[9px] text-red-500 font-bold text-center uppercase">{errorMessage || 'Erro ao salvar'}</p>
                    )}
                  </div>
                )}
                {!file && (
                  <div className="h-full flex flex-col items-center justify-center p-4 bg-white/50 rounded-xl border border-amber-50">
                    <p className="text-[9px] text-amber-600 font-black text-center uppercase tracking-widest leading-relaxed">
                      Selecione um arquivo .docx para atualizar o modelo <br/> deste documento no servidor.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="w-full space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="bg-violet-600 p-3 rounded-2xl shadow-lg shadow-violet-200 text-white">
                <FileText size={24} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between w-full pr-1">
                  <h3 className="font-black text-gray-900 text-sm uppercase tracking-widest leading-none mb-1">Carga e Prévia</h3>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] text-violet-600 font-extrabold uppercase tracking-tight bg-violet-50 px-2 py-0.5 rounded-md border border-violet-100">
                    {CONGRESSO_TEMPLATES.find(t => t.id === selectedTemplate)?.name}
                  </span>
                  {speakers.length > 0 && selectedTemplate !== 'cong_aviso_treinamentos' && (
                    <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1 shadow-sm transition-all hover:border-violet-300">
                      <User size={12} className="text-violet-500" />
                      <select 
                        value={selectedSpeaker}
                        onChange={(e) => setSelectedSpeaker(e.target.value)}
                        className="bg-transparent text-[10px] font-black text-gray-700 uppercase tracking-tighter outline-none cursor-pointer"
                      >
                        {Array.from(new Set(speakers)).map((s, i) => (
                          <option key={i} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              {status === 'success' && !isProcessing && (
                <>
                  <button
                    onClick={downloadAsDocx}
                    className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 text-violet-600 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm hover:bg-violet-50 transition-all border border-transparent hover:border-violet-100"
                    title="Baixar Original (.docx)"
                  >
                    <FileDown size={14} />
                    BAIXAR DOCX
                  </button>

                  <button
                    onClick={downloadAsPdf}
                    disabled={generating}
                    className="flex items-center gap-2 px-4 py-2.5 bg-[#3e5e66] text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-[#2c4d55] transition-all disabled:opacity-50 border-r-4 border-[#facc15]"
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
                  className="flex items-center gap-2 bg-violet-600 text-white px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest shadow-xl shadow-violet-600/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
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
              className="w-full h-[750px] bg-[#1A1B1E] border border-[#2c2e33] rounded-3xl shadow-inner-lg overflow-hidden relative"
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
              <div className="absolute inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center rounded-3xl pointer-events-none">
                <RefreshCw className="w-10 h-10 text-emerald-500 animate-spin" />
              </div>
            )}
            {status === 'error' && (
              <div className="absolute top-4 right-4 bg-red-50 p-3 rounded-xl border border-red-100 flex items-center space-x-2 text-red-700 shadow-lg">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span className="text-[10px] font-bold uppercase">Erro no documento</span>
              </div>
            )}
          </div>

          <p className="text-[9px] text-gray-400 text-center italic">
            * As substituições são baseadas na Programação do Congresso e Dados Pessoais. Use marcadores @DATA, @LOCAL, @TEMA, @DIA, @ORADOR, @DESIGNAÇÃO, etc.
          </p>
        </div>
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
          height: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #1A1B1E;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #2c2e33;
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
