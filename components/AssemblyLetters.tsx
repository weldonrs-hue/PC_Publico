'use client';

import React, { useState, useEffect, useRef } from 'react';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { 
  FileText, 
  Download, 
  RefreshCw, 
  CheckCircle2, 
  Mail,
  FileDown,
  Loader2,
  Trash2,
  Settings2,
  X,
  FileUp,
  AlertCircle,
  Printer
} from 'lucide-react';
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
import { useDialog } from '@/hooks/useDialog';
import { AnimatePresence, motion } from 'motion/react';
import { cleanPSSMetadata } from '@/lib/docxUtils';

const ASSEMBLEIA_TEMPLATES = [
  { id: 'ass_carta_anciaos', name: 'Carta aos Anciãos' },
  { id: 'ass_carta_oradores', name: 'Carta aos Oradores' },
  { id: 'ass_convite_presidente', name: 'Convite Presidentes' },
  { id: 'ass_convite_oracao', name: 'Convites Orações' },
  { id: 'ass_carta_pioneiros', name: 'Carta aos Pioneiros' },
];

interface AssemblyLettersProps {
  userId: string;
  isAdmin?: boolean;
  canManage?: boolean;
  initialMode?: 'geracao' | 'manager';
}

export default function AssemblyLetters({ 
  userId, 
  isAdmin,
  canManage,
  initialMode = 'geracao'
}: AssemblyLettersProps) {
  const { showAlert } = useDialog();
  const [selectedTemplate, setSelectedTemplate] = useState<string>(ASSEMBLEIA_TEMPLATES[0].id);
  const [templates, setTemplates] = useState<Record<string, { content: string, updatedAt: string, isPrivate?: boolean }>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [processedDocBuffer, setProcessedDocBuffer] = useState<ArrayBuffer | null>(null);
  const [loading, setLoading] = useState(true);
  const [personalData, setPersonalData] = useState<any>(null);
  const [generating, setGenerating] = useState(false);
  
  // Management state
  const [isManaging, setIsManaging] = useState(initialMode === 'manager' && (isAdmin || canManage));
  const [file, setFile] = useState<File | null>(null);
  const [localFileBuffer, setLocalFileBuffer] = useState<ArrayBuffer | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveAsGlobal, setSaveAsGlobal] = useState(false);
  const [isViewerReady, setIsViewerReady] = useState(false);

  const viewerRef = useRef<any>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
          
          try {
            await (viewer as any).setViewMode('paged');
            await (viewer as any).setZoomMode('fit-page-width');
            await (viewer as any).setScrollMode('continuous');
          } catch (e) {}

          setTimeout(() => {
            if (!destroyed && viewerRef.current) {
              setIsViewerReady(true);
            }
          }, 1000);
        }
      } catch (err: any) {
        console.error('UDoc Viewer Init Error Assembly:', err);
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
    const q = query(collection(db, 'document_templates'), where('category', '==', 'assembleias'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedTemplates: Record<string, any> = {};
      snapshot.forEach((doc) => {
        fetchedTemplates[doc.id] = doc.data();
      });

      const consolidated: Record<string, any> = {};
      ASSEMBLEIA_TEMPLATES.forEach(t => {
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
      handleFirestoreError(error, OperationType.GET, 'document_templates');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userId]);

  // Load personal data
  useEffect(() => {
    const fetchData = async () => {
      if (!userId) return;
      try {
        const personalDocRef = doc(db, 'personal_data', userId);
        const personalSnap = await getDoc(personalDocRef);
        if (personalSnap.exists()) {
          setPersonalData(personalSnap.data());
        }
      } catch (error) {
        console.error('Error fetching personal data:', error);
      }
    };

    fetchData();
  }, [userId]);

  // Auto-load template when selectedTemplate or templates changes
  useEffect(() => {
    if (localFileBuffer) {
      processAndPreview(localFileBuffer);
    } else if (templates[selectedTemplate]) {
      processAndPreview();
    } else {
      setProcessedDocBuffer(null);
      setStatus('idle');
    }
  }, [selectedTemplate, templates, localFileBuffer, personalData]);

  const getReplacements = (signatureImage: string) => {
    const now = new Date();
    const hoje = new Intl.DateTimeFormat('pt-BR', { 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    }).format(now);

    const travelerName = personalData?.nome || '________________';
    const circuit = personalData?.circuito || '________________';
    const telefoneCircuito = personalData?.telefoneCircuito || personalData?.telefone || '________________';

    const replacements = {
      'EVENTO': 'Programa da Assembleia de Circuito de 2027 — com o Superintendente de Circuito',
      'TEMA': '“Feliz É Aquele Que Confia em Jeová” — Provérbios 16:20',
      'DATA': hoje,
      'LOCAL': '________________',
      'ORADOR': '________________',
      'D_ENSAIO': '________________',
      'L_ENSAIO': '________________',
      'HORA': '________________',
      'N': '________________',
      'TITULO': '________________',
      'ANO': '2026',
      'data': hoje,
      'HOJE': hoje,
      'orador': '________________',
      'congregacao': '________________',
      'CONGREGACAO': '________________',
      'viajante': travelerName,
      'VIAJANTE': travelerName,
      'NOME': travelerName,
      'circuito': circuit,
      'CIRCUITO': circuit,
      'FONE': telefoneCircuito,
      'TELEFONE': telefoneCircuito,
      'assinatura': `${travelerName} (${circuit})`,
      'ASSINATURA': signatureImage,
      '%ASSINATURA': signatureImage,
    };

    return replacements;
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
      
      const cleanedBuffer = cleanPSSMetadata(sourceBuffer);
      const zip = new PizZip(cleanedBuffer);

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
          newText = newText.replace(/@Assinatura([A-Za-z0-9À-ÿ\_]*\s*Global|_Global)?/gi, '[%ASSINATURA]');
          newText = newText.replace(/(^|[^A-Za-z0-9À-ÿ\u00C0-\u00FF])@([A-Za-z0-9À-ÿ\_]+)/g, (m, p1, p2) => {
            return `${p1}[${p2.toUpperCase()}]`;
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
      
      const replacements = getReplacements(signatureImage);
      
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
    } catch (err: any) {
      console.error('Error processing DOCX:', err);
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
    link.download = `Carta_${selectedTemplate}.docx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadAsPdf = async () => {
    if (!viewerRef.current || status !== 'success') return;
    
    setGenerating(true);
    try {
      const filename = `Carta_${selectedTemplate}.pdf`;

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

      const templateInfo = ASSEMBLEIA_TEMPLATES.find(t => t.id === selectedTemplate);
      const docId = isGlobal ? selectedTemplate : `${userId}_${selectedTemplate}`;
      
      await setDoc(doc(db, 'document_templates', docId), {
        name: templateInfo?.name || selectedTemplate,
        content: base64,
        updatedAt: new Date().toISOString(),
        category: 'assembleias',
        isGlobal: isGlobal,
        ownerId: isGlobal ? 'admin' : userId
      });

      setFile(null);
      setLocalFileBuffer(null);
      await showAlert('Template salvo com sucesso!', 'Sucesso');
    } catch (error: any) {
      console.error('Error saving template:', error);
      await showAlert('Erro ao salvar template: ' + error.message, 'Erro');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 space-y-4">
        <RefreshCw size={32} className="text-amber-500 animate-spin" />
        <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">Carregando Templates...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-6">
        <div className="bg-gray-50 p-6 rounded-none border border-gray-200">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-extrabold text-gray-900 flex items-center gap-3 text-sm uppercase tracking-widest bg-amber-50 text-amber-700 px-4 py-2 rounded-none border border-amber-100">
              <Mail size={20} />
              Selecione o Modelo de Carta
            </h3>
            
            {canManage && (
              <button
                onClick={() => setIsManaging(!isManaging)}
                className={`flex items-center gap-2 px-4 py-2 rounded-none text-[10px] font-black uppercase tracking-widest transition-all border shadow-sm ${
                  isManaging 
                    ? 'bg-amber-600 text-white border-amber-500' 
                    : 'bg-white text-amber-600 border-amber-100 hover:bg-amber-50'
                }`}
              >
                <Settings2 size={14} />
                {isManaging ? 'Fechar Gerenciador' : 'Gerenciar Templates'}
              </button>
            )}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {ASSEMBLEIA_TEMPLATES.map(t => (
              <button
                key={t.id}
                onClick={() => setSelectedTemplate(t.id)}
                className={`flex items-center gap-4 p-4 transition-all border-2 rounded-none h-24 text-left ${
                   selectedTemplate === t.id
                    ? 'bg-amber-600 text-white border-amber-600 shadow-xl scale-[1.02]'
                    : 'bg-white text-gray-600 border-gray-100 hover:border-amber-200 hover:bg-amber-50'
                }`}
              >
                <div className={`p-3 rounded-none transition-colors shrink-0 ${selectedTemplate === t.id ? 'bg-white/20' : 'bg-amber-50'}`}>
                  <Mail size={24} className={selectedTemplate === t.id ? 'text-white' : 'text-amber-600'} />
                </div>
                <div className="flex-1 space-y-1 overflow-hidden">
                  <span className="block font-black uppercase tracking-tight text-[11px] leading-tight truncate">{t.name}</span>
                  {templates[t.id] && (
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 size={12} className={selectedTemplate === t.id ? 'text-white' : 'text-emerald-500'} />
                      <span className={`text-[8px] font-black uppercase tracking-widest ${selectedTemplate === t.id ? 'text-white/80' : 'text-gray-400'}`}>
                        {templates[t.id].isPrivate ? 'SEU MODELO' : 'GLOBAL'}
                      </span>
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        <AnimatePresence>
          {isManaging && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="bg-amber-50 p-6 rounded-none border border-amber-200 space-y-6">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-amber-700 uppercase tracking-widest flex items-center gap-2">
                    <FileUp size={16} />
                    Gerenciar Modelo: {ASSEMBLEIA_TEMPLATES.find(t => t.id === selectedTemplate)?.name}
                  </h4>
                  <button onClick={() => setIsManaging(false)} className="text-amber-400 hover:text-amber-600">
                    <X size={20} />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    {isAdmin && (
                      <div className="flex items-center justify-between p-4 bg-white border border-amber-100">
                        <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Tornar este modelo GLOBAL?</span>
                        <input 
                          type="checkbox" 
                          checked={saveAsGlobal} 
                          onChange={e => setSaveAsGlobal(e.target.checked)}
                          className="w-5 h-5 accent-emerald-500"
                        />
                      </div>
                    )}

                    <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".docx" className="hidden" />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className={`w-full flex flex-col items-center justify-center p-10 border-2 border-dashed transition-all ${
                        file ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-white border-gray-200 text-gray-400 hover:border-amber-300'
                      }`}
                    >
                      <FileUp size={32} />
                      <span className="mt-4 font-black uppercase text-xs tracking-widest">{file ? file.name : 'CARREGAR NOVO MODELO DOCX'}</span>
                    </button>
                  </div>

                  <div className="flex flex-col justify-center">
                    <button
                      onClick={saveTemplate}
                      disabled={!file || isSaving}
                      className="w-full h-16 bg-amber-600 text-white font-black uppercase tracking-widest disabled:opacity-50 hover:bg-amber-700 shadow-lg"
                    >
                      {isSaving ? 'SALVANDO...' : 'ATUALIZAR MODELO'}
                    </button>
                    <p className="mt-4 text-[9px] text-gray-400 font-bold uppercase tracking-widest leading-loose">
                      * Certifique-se de que o arquivo DOCX contém marcadores como [NOME], [CIRCUITO], [DATA], etc.
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex flex-col space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="bg-amber-600 p-3 rounded-none text-white">
                <FileText size={24} />
              </div>
              <div>
                <h3 className="font-black text-gray-900 text-sm uppercase tracking-widest leading-none mb-1">Carga e Prévia</h3>
                <p className="text-[10px] text-amber-600 font-extrabold uppercase tracking-tight bg-amber-50 px-2 py-0.5 rounded-none border border-amber-100 w-fit">
                  {ASSEMBLEIA_TEMPLATES.find(t => t.id === selectedTemplate)?.name}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {status === 'success' && !isProcessing && (
                <>
                  <button
                    onClick={downloadAsDocx}
                    className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 text-amber-600 rounded-none text-[10px] font-black uppercase tracking-widest border border-amber-100 hover:bg-amber-100 transition-all font-sans"
                  >
                    <FileDown size={14} />
                    BAIXAR DOCX
                  </button>

                  <button
                    onClick={downloadAsPdf}
                    disabled={generating}
                    className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 text-amber-600 rounded-none text-[10px] font-black uppercase tracking-widest border border-amber-100 hover:bg-amber-100 transition-all font-sans"
                  >
                    {generating ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />}
                    BAIXAR PDF
                  </button>

                  <button
                    onClick={() => viewerRef.current?.print()}
                    className="flex items-center gap-2 px-4 py-2.5 bg-amber-600 text-white rounded-none text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-amber-700 transition-all"
                  >
                    <Printer size={14} />
                    IMPRIMIR
                  </button>
                </>
              )}
            </div>
          </div>

          <div 
            ref={previewRef} 
            className="w-full bg-white border border-gray-200 rounded-none overflow-hidden"
            style={{ height: '800px' }}
          />
        </div>
      </div>

      <style jsx global>{`
        .udoc-viewer-container {
          border-radius: 0 !important;
        }
        .udoc-pages {
          background-color: #f3f4f6 !important;
          padding: 2rem !important;
        }
        .udoc-page {
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1) !important;
          margin-bottom: 2rem !important;
        }
      `}</style>
    </div>
  );
}
