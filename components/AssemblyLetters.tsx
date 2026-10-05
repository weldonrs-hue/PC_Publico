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
  Printer,
  ChevronDown
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
import { cleanPSSMetadata, formatDocxError } from '@/lib/docxUtils';
import CustomSelect from '@/components/CustomSelect';

const ASSEMBLEIA_TEMPLATES = [
  { id: 'ass_carta_anciaos', name: 'Carta aos Anciãos' },
  { id: 'ass_carta_oradores', name: 'Carta aos Oradores' },
  { id: 'ass_convite_presidente', name: 'Convite Presidentes' },
  { id: 'ass_convite_oracao', name: 'Convites Orações' },
  { id: 'ass_convite_assistente', name: 'Convite Assistentes' },
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
  const [needsProcessing, setNeedsProcessing] = useState(true);
  
  // Event selection state
  const [availableAssemblies, setAvailableAssemblies] = useState<any[]>([]);
  const [selectedAssemblyId, setSelectedAssemblyId] = useState<string>('');
  const [assemblyData, setAssemblyData] = useState<any>(null);
  const [userSpeakerData, setUserSpeakerData] = useState<any>(null);
  
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

  // Fetch available assemblies
  useEffect(() => {
    const fetchAssemblies = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'assembly_programs'));
        const programs = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setAvailableAssemblies(programs);
        if (programs.length > 0) {
          setSelectedAssemblyId(programs[0].id);
        }
      } catch (error) {
        console.error('Error fetching assemblies:', error);
      }
    };
    fetchAssemblies();
  }, []);

  // Fetch selected assembly data and user speaker data
  useEffect(() => {
    const fetchData = async () => {
      if (!selectedAssemblyId) return;
      
      try {
        // Get program details
        const programSnap = await getDoc(doc(db, 'assembly_programs', selectedAssemblyId));
        if (programSnap.exists()) {
          setAssemblyData(programSnap.data());
        }

        // Get user's speaker assignments for this assembly
        const [year, type] = selectedAssemblyId.split('_');
        const collectionName = type === 'supt' ? 'circuit_assembly_supt_speakers' : 'circuit_assembly_branch_speakers';
        const docId = year === '2026-2027' ? userId : `${userId}_${year}`;
        
        const speakersSnap = await getDoc(doc(db, collectionName, docId));
        if (speakersSnap.exists()) {
          setUserSpeakerData(speakersSnap.data());
        } else {
          setUserSpeakerData(null);
        }
      } catch (error) {
        console.error('Error fetching assembly details:', error);
      }
    };
    fetchData();
  }, [selectedAssemblyId, userId]);

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

  // Auto-load raw template when selectedTemplate or templates changes
  useEffect(() => {
    const loadRaw = async () => {
      if (localFileBuffer) {
        setProcessedDocBuffer(localFileBuffer);
        setStatus('success');
      } else if (templates[selectedTemplate]) {
        const template = templates[selectedTemplate];
        const binaryString = window.atob(template.content);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        setProcessedDocBuffer(bytes.buffer);
        setStatus('success');
      } else {
        setProcessedDocBuffer(null);
        setStatus('idle');
      }
      setNeedsProcessing(true);
    };
    
    loadRaw();
  }, [selectedTemplate, templates, localFileBuffer]);

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

    const isAssistant = selectedTemplate === 'ass_convite_assistente';
    const isPresident = selectedTemplate === 'ass_convite_presidente';
    const isPrayer = selectedTemplate === 'ass_convite_oracao';

    const firstPart = userSpeakerData?.parts?.[0] || userSpeakerData?.parts?.['0'];
    const details = firstPart?.details;

    const replacements = {
      'EVENTO': assemblyData?.title || 'Programa da Assembleia de Circuito — com o Superintendente de Circuito',
      'TEMA': details?.assemblyTheme || assemblyData?.theme || '“Feliz É Aquele Que Confia em Jeová” — Provérbios 16:20',
      'DATA': details?.eventDate || hoje,
      'LOCAL': details?.eventLocation || '________________',
      'ORADOR': '________________',
      'D_ENSAIO': details?.rehearsalDate || '________________',
      'L_ENSAIO': details?.rehearsalLocation || '________________',
      'DATA_ENSAIO': details?.rehearsalDate || '________________',
      'LOCAL_ENSAIO': details?.rehearsalLocation || '________________',
      'DATAHORA': details?.eventDate || '________________',
      'LOCALTREINO': details?.rehearsalLocation || '________________',
      'HORA': '________________',
      'N': '________________',
      'TITULO': isAssistant ? 'ASSISTENTE DA ASSEMBLEIA' : '________________',
      'DESIGNAÇÃO': isAssistant ? 'ASSISTENTE DA ASSEMBLEIA' : isPresident ? 'PRESIDENTE DE SESSÃO' : isPrayer ? 'ORAÇÃO' : '________________',
      'DESIGNACAO': isAssistant ? 'ASSISTENTE DA ASSEMBLEIA' : isPresident ? 'PRESIDENTE DE SESSÃO' : isPrayer ? 'ORAÇÃO' : '________________',
      'ANO': selectedAssemblyId.split('_')[0] || '2027',
      'data': hoje,
      'HOJE': hoje,
      'orador': '________________',
      'NOME_ORADOR': '________________',
      'DESIGNADO': '________________',
      'NOME_DESIGNADO': '________________',
      'ASSISTENTE': '________________',
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
      'ASSINATURA': `${travelerName} (${circuit})`,
      'ASSINATURA_GLOBAL': `${travelerName} (${circuit})`,
      'ASSINATURA GLOBAL': `${travelerName} (${circuit})`,
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
      const hasImage = Boolean(signatureImage && typeof signatureImage === 'string' && signatureImage.startsWith('data:image'));

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

      const cleanedBuffer = cleanPSSMetadata(sourceBuffer);
      const zip = new PizZip(cleanedBuffer);

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
            return `${p1}[${p2.toUpperCase()}]`;
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
        modules: hasImage && ImageModule ? [new ImageModule(imgOpts)] : [],
        nullGetter: () => ''
      });

      docReal.render(replacements);
      const outReal = docReal.getZip().generate({
        type: 'arraybuffer'
      });
      setProcessedDocBuffer(outReal);
      setStatus('success');
      setNeedsProcessing(false);
    } catch (err: any) {
      console.error('Error processing DOCX:', formatDocxError(err), err);
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
    <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-140px)] min-h-[500px]">
      {/* Sidebar: Selection & Settings Toggle */}
      <div className="w-full lg:w-72 flex flex-col gap-4 shrink-0 overflow-y-auto pr-1 custom-scrollbar">
        <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between px-1">
            <h3 className="font-black text-gray-900 text-[10px] uppercase tracking-[0.2em] flex items-center gap-2">
              <Mail size={14} className="text-amber-600" />
              Modelos
            </h3>
            
            {canManage && (
              <button
                onClick={() => setIsManaging(!isManaging)}
                className={`p-2 rounded-xl transition-all shadow-sm ${
                  isManaging 
                    ? 'bg-amber-600 text-white shadow-amber-200 ring-2 ring-amber-600 ring-offset-2' 
                    : 'bg-amber-100 text-amber-600 hover:bg-amber-200'
                }`}
                title="Configurar Templates"
              >
                <Settings2 size={18} />
              </button>
            )}
          </div>

          {/* Event Selector */}
          <div className="px-1 space-y-1.5">
            <CustomSelect
              label="Vincular Evento"
              value={selectedAssemblyId}
              onChange={(val) => setSelectedAssemblyId(val)}
              options={availableAssemblies.map(assembly => ({
                value: assembly.id,
                label: assembly.title || assembly.id
              }))}
              className="w-full"
              dropdownClassName="w-full max-w-full"
              size="sm"
            />
            {assemblyData && (
              <div className="bg-amber-50/50 p-2 rounded-xl border border-amber-100/50">
                <p className="text-[8px] font-bold text-amber-600 uppercase tracking-tighter truncate leading-tight">
                  {assemblyData.theme || 'Sem Tema Definido'}
                </p>
              </div>
            )}
          </div>
          
          <div className="flex flex-col gap-2">
            {ASSEMBLEIA_TEMPLATES.map(t => (
              <button
                key={t.id}
                onClick={() => setSelectedTemplate(t.id)}
                className={`flex items-center gap-3 px-3 py-2.5 transition-all border rounded-2xl text-left group relative overflow-hidden ${
                   selectedTemplate === t.id
                    ? 'bg-amber-600 text-white border-amber-600 shadow-md scale-[1.02]'
                    : 'bg-gray-50/50 text-gray-600 border-gray-100 hover:border-amber-200 hover:bg-white'
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors shrink-0 ${selectedTemplate === t.id ? 'bg-white/20' : 'bg-amber-100/50'}`}>
                  <Mail size={16} className={selectedTemplate === t.id ? 'text-white' : 'text-amber-600'} />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="block font-black uppercase tracking-tight text-[10px] leading-tight truncate">{t.name}</span>
                  {templates[t.id] && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <CheckCircle2 size={8} className={selectedTemplate === t.id ? 'text-white' : 'text-emerald-500'} />
                      <span className={`text-[6px] font-black uppercase tracking-widest ${selectedTemplate === t.id ? 'text-white/80' : 'text-gray-400'}`}>
                        {templates[t.id].isPrivate ? 'PRIVADO' : 'GLOBAL'}
                      </span>
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {needsProcessing && (
          <button
            onClick={() => processAndPreview()}
            disabled={isProcessing}
            className="w-full flex items-center justify-center gap-3 p-4 bg-amber-600 text-white rounded-3xl shadow-xl shadow-amber-200 hover:bg-amber-700 active:scale-[0.98] transition-all disabled:opacity-50 font-black text-[10px] uppercase tracking-widest"
          >
            {isProcessing ? <RefreshCw size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            Gerar Carta Agora
          </button>
        )}

        {/* Quick Actions Panel */}
        {status === 'success' && !isProcessing && (
          <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm space-y-4">
            <h4 className="text-[9px] font-black text-gray-400 uppercase tracking-widest px-1">Ações do Documento</h4>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={downloadAsDocx}
                className="flex flex-col items-center justify-center gap-2 p-3 bg-gray-50 text-amber-700 rounded-2xl border border-gray-100 hover:bg-amber-50 hover:border-amber-200 transition-all group"
              >
                <FileDown size={18} className="group-hover:scale-110 transition-transform" />
                <span className="text-[8px] font-black uppercase tracking-tighter">DOCX</span>
              </button>

              <button
                onClick={downloadAsPdf}
                disabled={generating}
                className="flex flex-col items-center justify-center gap-2 p-3 bg-gray-50 text-amber-700 rounded-2xl border border-gray-100 hover:bg-amber-50 hover:border-amber-200 transition-all group disabled:opacity-50"
              >
                {generating ? <Loader2 size={18} className="animate-spin" /> : <FileDown size={18} className="group-hover:scale-110 transition-transform" />}
                <span className="text-[8px] font-black uppercase tracking-tighter">PDF</span>
              </button>

              <button
                onClick={() => viewerRef.current?.print()}
                className="col-span-2 flex items-center justify-center gap-2 p-3 bg-amber-600 text-white rounded-2xl shadow-lg shadow-amber-200 hover:bg-amber-700 transition-all font-black text-[10px] uppercase tracking-widest"
              >
                <Printer size={16} />
                Imprimir Agora
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main Content: Management & Viewer */}
      <div className="flex-1 flex flex-col gap-4 min-w-0 h-full overflow-hidden">
        <AnimatePresence mode="wait">
          {isManaging ? (
            <motion.div
              key="management"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-amber-50/50 p-5 rounded-3xl border border-amber-100 shadow-sm shrink-0"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600">
                    <FileUp size={20} />
                  </div>
                  <div>
                    <h4 className="text-[11px] font-black text-gray-900 uppercase tracking-widest">
                      Configurar Template
                    </h4>
                    <p className="text-[8px] font-bold text-amber-600 uppercase tracking-widest">
                      {ASSEMBLEIA_TEMPLATES.find(t => t.id === selectedTemplate)?.name}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsManaging(false)} 
                  className="w-8 h-8 flex items-center justify-center bg-white rounded-full text-gray-400 hover:text-red-500 shadow-sm transition-colors"
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
                      file ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-white border-gray-200 text-gray-400 hover:border-amber-300'
                    }`}
                  >
                    <FileUp size={24} className={file ? 'text-emerald-500' : ''} />
                    <span className="font-black uppercase text-[9px] tracking-[0.2em]">{file ? file.name : 'Selecionar Novo DOCX'}</span>
                  </button>
                </div>

                <div className="flex flex-col justify-between gap-2">
                  {isAdmin && (
                    <label className="flex items-center gap-3 p-3 bg-white rounded-2xl border border-gray-100 cursor-pointer hover:bg-amber-50 transition-colors">
                      <input 
                        type="checkbox" 
                        checked={saveAsGlobal} 
                        onChange={e => setSaveAsGlobal(e.target.checked)}
                        className="w-4 h-4 accent-amber-600"
                      />
                      <span className="text-[9px] font-black text-gray-600 uppercase tracking-tight">Definir como GLOBAL</span>
                    </label>
                  )}
                  <button
                    onClick={saveTemplate}
                    disabled={!file || isSaving}
                    className="w-full h-12 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest disabled:opacity-50 hover:bg-emerald-700 shadow-lg shadow-emerald-200 transition-all flex items-center justify-center gap-2"
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
        <div className="flex-1 bg-white border border-gray-100 rounded-3xl shadow-inner relative overflow-hidden flex flex-col">
          <div className="absolute top-4 left-4 z-10 flex items-center gap-2 bg-white/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-gray-200 shadow-sm">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            <span className="text-[8px] font-black text-gray-500 uppercase tracking-widest">Prévia em Tempo Real</span>
          </div>
          
          <div 
            ref={previewRef} 
            className="flex-1 w-full overflow-hidden"
          />
        </div>
      </div>

      <style jsx global>{`
        .udoc-viewer-container {
          border-radius: 0 !important;
          height: 100% !important;
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
