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
  PenTool,
  Sparkles,
  Trash2,
  Settings2,
  X,
  FileUp,
  Save
} from 'lucide-react';
import DocxToPdfDemo from './DocxToPdfDemo';
import { extractTagsFromDocx, getMissingTags, cleanPSSMetadata } from '@/lib/docxUtils';
import { db } from '@/lib/firebase';
import { 
  collection, 
  getDocs, 
  doc, 
  getDoc,
  setDoc,
  query,
  where,
  limit
} from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '@/utils/firestore';
import { AnimatePresence, motion } from 'motion/react';

interface PSSAssignmentLettersProps {
  userId: string;
  isAdmin?: boolean;
  canManage?: boolean;
  selectedTurma: '1' | '2' | '3';
  schoolInfo: {
    dataTurma: string;
    instrutorA: string;
    instrutorB: string;
    confirmacaoEmail: string;
    confirmacaoWhatsapp: string;
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
  selectedTurma, 
  schoolInfo, 
  workshopAssignments 
}: PSSAssignmentLettersProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<string>(TEMPLATE_NAMES[0]);
  const [templates, setTemplates] = useState<Record<string, { content: string, updatedAt: string, isPrivate?: boolean }>>({});
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [processedDocBuffer, setProcessedDocBuffer] = useState<ArrayBuffer | null>(null);
  const [loading, setLoading] = useState(true);
  const [personalData, setPersonalData] = useState<any>(null);
  
  // Management state
  const [isManaging, setIsManaging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [missingTags, setMissingTags] = useState<string[]>([]);
  const [saveAsGlobal, setSaveAsGlobal] = useState(false);

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
          toolbar: true,
          sidebar: false,
        });

        if (!destroyed) {
          viewerRef.current = viewer;
          setIsViewerReady(true);
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
      if (viewerRef.current) {
        try { viewerRef.current.destroy(); viewerRef.current = null; } catch (e) {}
      }
    };
  }, []);

  // Handle document updates
  useEffect(() => {
    const updateDoc = async () => {
      if (isViewerReady && viewerRef.current && processedDocBuffer) {
        setIsProcessing(true);
        try {
          await viewerRef.current.load(new Uint8Array(processedDocBuffer));
        } catch (err) {
          console.error('UDoc Viewer Load Error:', err);
        } finally {
          setIsProcessing(false);
        }
      }
    };

    updateDoc();
  }, [processedDocBuffer, isViewerReady]);

  useEffect(() => {
    fetchTemplates();
    fetchPersonalData();
  }, []);

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

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, 'document_templates'));
      const fetchedTemplates: Record<string, any> = {};
      querySnapshot.forEach((doc) => {
        fetchedTemplates[doc.id] = doc.data();
      });

      // Consolidate templates prioritizing private ones
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
    } catch (error) {
      console.error('Error fetching templates:', error);
    } finally {
      setLoading(false);
    }
  };

  // Auto-load template when selectedTemplate or templates changes
  useEffect(() => {
    if (templates[selectedTemplate]) {
      processAndPreview();
    } else {
      setPreviewHtml('<div class="h-full flex flex-col items-center justify-center text-gray-300 italic py-20 px-10 text-center text-sm uppercase font-bold tracking-widest">Template não encontrado no banco de dados. Carregue-o na aba Gerador de Documentos primeiro.</div>');
      setProcessedDocBuffer(null);
      setStatus('idle');
    }
  }, [selectedTemplate, templates, schoolInfo, workshopAssignments, personalData]);

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
    const emailValue = schoolInfo.confirmacaoEmail || '________________';
    const telefoneValue = schoolInfo.confirmacaoWhatsapp || '________________';
    const travelerName = personalData?.nome || '________________';
    const circuit = personalData?.circuito || '________________';
    const signatureText = `${travelerName} (${circuit})`;

    let instructorName = '________________';
    if ((scenarioId >= 1 && scenarioId <= 3) || (scenarioId >= 15 && scenarioId <= 18)) {
      instructorName = schoolInfo.instrutorB || '________________';
    } else if (scenarioId >= 4 && scenarioId <= 14) {
      instructorName = schoolInfo.instrutorA || '________________';
    }
    
    const res: any = {
      'data': dataValue,
      'DATA': dataValue,
      'nomes': nomes,
      'NOMES': nomes,
      'e mail': emailValue,
      'E MAIL': emailValue,
      'e-mail': emailValue,
      'E-mail': emailValue,
      'E-MAIL': emailValue,
      'email': emailValue,
      'EMAIL': emailValue,
      'telefone': telefoneValue,
      'TELEFONE': telefoneValue,
      'whatsapp': telefoneValue,
      'WHATSAPP': telefoneValue,
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

  const processAndPreview = async () => {
    const template = templates[selectedTemplate];
    if (!template) return;

    setIsProcessing(true);
    setStatus('idle');

    try {
      const ImageModule = (await import('docxtemplater-image-module-free')).default;
      
      const signatureImage = personalData?.signatureImage || '';
      let sigWidth = 150;
      let sigHeight = 60;
      
      if (signatureImage && signatureImage.startsWith('data:image')) {
        try {
          const img = new Image();
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

      const binaryString = window.atob(template.content);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      // Clean metadata first
      const cleanedBuffer = cleanPSSMetadata(bytes.buffer);
      const zip = new PizZip(cleanedBuffer);
      
      const replacements = getReplacements(selectedTemplate, signatureImage);
      
      // Pre-process all XML files in the zip (document, headers, footers)
      const xmlFiles = zip.file(/word\/(document|header\d*|footer\d*)\.xml/);
      
      xmlFiles.forEach(file => {
        let xmlContent = file.asText();
        xmlContent = xmlContent.replace(/<w:proofErr w:type="(?:spell|gram)(?:Start|End)"\/>/g, "");
        xmlContent = xmlContent.replace(/<w:noProof\/>/g, "");
        
        // Joined split tag logic - more robust version
        for (let i = 0; i < 6; i++) {
          xmlContent = xmlContent.replace(/(@[A-Za-z0-9À-ÿ\u00C0-\u00FF\_\s]*)(<\/w:t>(?:<(?!w:p|w:tr|w:tbl|w:br|w:tc|w:tr)[^>]+>)*?<w:t[^>]*>)([A-Za-z0-9À-ÿ\u00C0-\u00FF\_\s]+)/g, "$1$3$2");
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

  const downloadAsPdf = () => {
    alert('Dica: Para obter a máxima qualidade e fidelidade visual do seu PDF, utilize o botão de Download (seta para baixo) ou a Impressora integrados diretamente no topo do próprio Visualizador de Documentos abaixo!');
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.name.endsWith('.docx')) {
        setFile(selectedFile);
        try {
          const rawBuffer = await selectedFile.arrayBuffer();
          const cleanedBuffer = cleanPSSMetadata(rawBuffer);
          
          // Validate tags
          const tags = await extractTagsFromDocx(cleanedBuffer);
          const required = [
            ['NOME'],
            ['E-MAIL', 'EMAIL'],
            ['TELEFONE', 'CONTATO'],
            ['DATA'],
            ['ASSINATURA', '%ASSINATURA']
          ];
          const missing = getMissingTags(tags, required);
          setMissingTags(missing);
        } catch (err) {
          console.error('Error validating uploaded docx:', err);
        }
      } else {
        setErrorMessage('Por favor, selecione um arquivo .docx');
        setSaveStatus('error');
      }
    }
  };

  const saveTemplate = async () => {
    if (!file) return;
    setIsSaving(true);
    setSaveStatus('idle');
    try {
      const rawBuffer = await file.arrayBuffer();
      const cleanedBuffer = cleanPSSMetadata(rawBuffer);
      const blob = new Blob([cleanedBuffer]);
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      const docId = isAdmin && saveAsGlobal ? selectedTemplate : `${userId}_${selectedTemplate}`;
      await setDoc(doc(db, 'document_templates', docId), {
        name: selectedTemplate,
        content: base64,
        updatedAt: new Date().toISOString(),
        category: 'pss',
        isGlobal: isAdmin && saveAsGlobal,
        ownerId: isAdmin && saveAsGlobal ? 'admin' : userId
      });

      setSaveStatus('success');
      setFile(null);
      fetchTemplates();
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (error: any) {
      console.error('Error saving template:', error);
      setErrorMessage(error.message || 'Erro ao salvar');
      setSaveStatus('error');
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
        <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-extrabold text-gray-900 flex items-center gap-3 text-sm uppercase tracking-widest bg-blue-50 text-blue-700 px-4 py-2 rounded-xl border border-blue-100">
              <Mail size={20} />
              Selecione o Modelo de Carta PSS
            </h3>
            
            {canManage && (
              <button
                onClick={() => setIsManaging(!isManaging)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border shadow-sm ${
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
          
          <div className="flex overflow-x-auto md:grid md:grid-cols-4 lg:grid-cols-6 gap-2 pb-2 md:pb-0 custom-scrollbar">
            {TEMPLATE_NAMES.map(name => (
              <div key={name} className="relative group/card">
                <button
                  onClick={() => setSelectedTemplate(name)}
                  className={`w-full text-left px-3 py-2 rounded-xl text-[14px] font-black transition-all uppercase tracking-tighter border-2 flex flex-col gap-1 ${
                    selectedTemplate === name 
                      ? 'bg-blue-600 text-white border-blue-600 shadow-md' 
                      : 'bg-white text-gray-600 border-gray-100 hover:border-blue-200 hover:bg-blue-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 w-full">
                    <span className="truncate">{name.replace('PSS assignment letter_T_', 'WS ')}</span>
                    {templates[name] && <CheckCircle2 size={12} className={selectedTemplate === name ? 'text-white' : 'text-green-500'} />}
                  </div>
                  {templates[name] && (
                    <span className={`text-[8px] px-1.5 py-0.5 rounded-md w-fit ${
                      templates[name].isPrivate 
                        ? (selectedTemplate === name ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-700')
                        : (selectedTemplate === name ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-700')
                    }`}>
                      {templates[name].isPrivate ? 'Seu Modelo' : 'Modelo ProgCir'}
                    </span>
                  )}
                </button>

                {canManage && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setSelectedTemplate(name); setIsManaging(!isManaging); }}
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
                        saveStatus === 'success' ? 'bg-green-600 text-white' : saveStatus === 'error' ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white hover:bg-emerald-700'
                      } disabled:opacity-50`}
                    >
                      {isSaving ? <RefreshCw className="animate-spin" size={14} /> : saveStatus === 'success' ? <CheckCircle2 size={14} /> : <Save size={14} />}
                      {isSaving ? 'SALVANDO...' : saveStatus === 'success' ? 'SALVO!' : 'SALVAR MODELO'}
                    </button>
                    
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

        {/* Lado Direito: Preview e Ações */}
        <div className="w-full space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gray-50 p-4 rounded-2xl border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="bg-blue-100 p-2 rounded-lg">
                <FileText className="text-blue-600" size={20} />
              </div>
              <div>
                <h3 className="font-black text-gray-800 text-sm uppercase tracking-widest">Visualização</h3>
                <p className="text-[14px] text-gray-500 font-bold uppercase truncate max-w-[200px]">
                  {selectedTemplate.replace('PSS assignment letter_', '')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={downloadAsDocx}
                disabled={status !== 'success' || isProcessing}
                className="group flex items-center h-10 w-10 hover:w-32 transition-all duration-500 ease-in-out rounded-full bg-gray-800 text-white shadow-md overflow-hidden whitespace-nowrap pl-[11px] hover:pl-4 disabled:opacity-50"
                title="Baixar Word"
              >
                <FileDown size={14} className="shrink-0" />
                <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 ml-2 font-black text-[13px] uppercase tracking-widest">Baixar Word</span>
              </button>

              <button
                onClick={downloadAsPdf}
                disabled={status !== 'success' || isProcessing}
                className="group flex items-center h-10 w-10 hover:w-32 transition-all duration-500 ease-in-out rounded-full bg-red-600 text-white shadow-md overflow-hidden whitespace-nowrap pl-[11px] hover:pl-4 disabled:opacity-50"
                title="Baixar PDF"
              >
                <Download size={14} className="shrink-0" />
                <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 ml-2 font-black text-[13px] uppercase tracking-widest">Baixar PDF</span>
              </button>
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
      `}</style>
    </div>
  );
}
