'use client';

import React, { useState, useEffect, useRef } from 'react';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import * as docxPreview from 'docx-preview';
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
  User,
  ChevronDown,
  Info
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { toJpeg } from 'html-to-image';
import { extractTagsFromDocx, getMissingTags, cleanPSSMetadata } from '@/lib/docxUtils';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, getDoc, query, where, limit, setDoc, deleteDoc } from 'firebase/firestore';
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
  
  // Management state
  const [isManaging, setIsManaging] = useState(initialMode === 'manager');
  const [file, setFile] = useState<File | null>(null);
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

  useEffect(() => {
    fetchTemplates();
    fetchPersonalData();
    fetchConventionData();
  }, [userId]);

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
    } catch (error) {
      console.error('Error fetching templates:', error);
    } finally {
      setLoading(false);
    }
  };

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
    if (templates[selectedTemplate]) {
      setNeedsProcessing(true);
      processAndPreview();
    } else {
      setPreviewHtml('<div class="h-full flex flex-col items-center justify-center text-red-400 py-20 px-10 text-center text-xs uppercase font-black tracking-widest leading-relaxed">Template não encontrado no banco de dados.<br/>Carregue o arquivo .docx no Gerenciador de Uploads primeiro.</div>');
      setProcessedDocBuffer(null);
      setStatus('idle');
    }
  }, [selectedTemplate, templates, conventionData, selectedSpeaker]);

  const getReplacements = () => {
    const details = conventionData?.details || {};
    const signatureImage = personalData?.signatureImage || '';
    const signatureName = personalData?.nome || '________________';
    const circuito = personalData?.circuito || '________________';
    const telefoneCircuito = personalData?.telefoneCircuito || personalData?.telefone || '________________';
    const signatureText = `${signatureName} (${circuito})`;
    const signatureValue = signatureImage && signatureImage.startsWith('data:image') ? signatureImage : signatureText;

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
      '%ASSINATURA': signatureValue,
      'VIAJANTE': signatureName,
      'CIRCUITO': circuito,
      'FONE': telefoneCircuito,
      'TELEFONE': telefoneCircuito,
      'DATAHORA': details.trainingDate || '________________',
      'LOCALTREINO': details.trainingLocation || '________________',
    };
  };

  const processAndPreview = async () => {
    const template = templates[selectedTemplate];
    if (!template) return;

    setIsProcessing(true);
    setStatus('idle');

    try {
      const binaryString = window.atob(template.content);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      const cleanedBuffer = cleanPSSMetadata(bytes.buffer);
      const zip = new PizZip(cleanedBuffer);
      
      const xmlFiles = zip.file(/word\/(document|header\d+|footer\d+)\.xml/);
      xmlFiles.forEach(file => {
        let xmlContent = file.asText();
        xmlContent = xmlContent.replace(/<w:proofErr w:type="(?:spell|gram)(?:Start|End)"\/>/g, "");
        xmlContent = xmlContent.replace(/<w:noProof\/>/g, "");
        
        for (let i = 0; i < 6; i++) {
          xmlContent = xmlContent.replace(/([\[@][^<\]]*)(<\/w:t>(?:<w:proofErr[^>]*\/>)*?<w:t[^>]*>)([^<\]]+)/g, "$1$3$2");
        }

        // Ensure namespaces are present for images
        if (!xmlContent.includes('xmlns:wp=')) {
          xmlContent = xmlContent.replace(/(<w:(?:document|hdr|ftr)[^>]*)/, (match) => {
            if (match.includes('xmlns:wp=')) return match;
            return `${match} xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape" xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas" xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"`;
          });
        }
        
        // 3. Surgical replacement of @TAG to [TAG]
        const repsForRegex = getReplacements();
        const hasImage = repsForRegex.ASSINATURA && repsForRegex.ASSINATURA.startsWith('data:image');

        xmlContent = xmlContent.replace(/(<w:t[^>]*>)(.*?)(<\/w:t>)/g, (match, opening, text, closing) => {
          let newText = text;
          // Handle Signature - prioritize image only if it's available in replacements
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
        modules: [new ImageModule(opts)]
      });

      docObj.render(replacements);

      const out = docObj.getZip().generate({
        type: 'blob',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });

      const arrayBuffer = await out.arrayBuffer();
      setProcessedDocBuffer(arrayBuffer);
      
      if (previewRef.current) {
        previewRef.current.innerHTML = '';
        await docxPreview.renderAsync(arrayBuffer, previewRef.current, undefined, {
          className: "docx-preview",
          inWrapper: false,
          ignoreWidth: true,
          ignoreHeight: true,
          breakPages: false,
          useBase64URL: true,
        });
      }

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
    if (!previewRef.current) return;
    setIsProcessing(true);
    try {
      const element = previewRef.current;
      const docxElement = element.querySelector('.docx') as HTMLElement || element;
      const dataUrl = await toJpeg(docxElement, { 
        quality: 0.98,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        width: 800,
        style: { margin: '0', padding: '0', backgroundColor: '#ffffff', width: '800px' }
      });

      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const imgProps = pdf.getImageProperties(dataUrl);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const margin = 15;
      const contentWidth = pdfWidth - (margin * 2);
      const contentHeight = (imgProps.height * contentWidth) / imgProps.width;

      pdf.addImage(dataUrl, 'JPEG', margin, margin, contentWidth, contentHeight);
      pdf.save(`Carta_Congresso_${selectedTemplate}.pdf`);
    } catch (err) {
      console.error('Error generating PDF:', err);
      alert('Erro ao gerar PDF.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile?.name.endsWith('.docx')) {
      setFile(selectedFile);
      try {
        const rawBuffer = await selectedFile.arrayBuffer();
        const cleanedBuffer = cleanPSSMetadata(rawBuffer);
        const tags = await extractTagsFromDocx(cleanedBuffer);
        const required = [
          ['TEMA'], ['DATA'], ['LOCAL'], ['DIA'], ['ORADOR'], 
          ['ASSINATURA', '%ASSINATURA'], ['VIAJANTE'], ['CIRCUITO']
        ];
        setMissingTags(getMissingTags(tags, required));
      } catch (err) {
        console.error('Error validating:', err);
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
      const docId = isAdmin && saveAsGlobal ? selectedTemplate : `${userId}_${selectedTemplate}`;
      
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve) => {
        reader.onloadend = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]);
        };
        reader.readAsDataURL(new Blob([cleanedBuffer]));
      });

      await setDoc(doc(db, 'document_templates', docId), {
        name: selectedTemplate,
        content: base64,
        updatedAt: new Date().toISOString(),
        category: 'congresso',
        isGlobal: isAdmin && saveAsGlobal,
        ownerId: isAdmin && saveAsGlobal ? 'admin' : userId
      });

      setSaveStatus('success');
      setFile(null);
      fetchTemplates();
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (error: any) {
      console.error('Error saving:', error);
      setErrorMessage(error.message || 'Erro ao salvar');
      setSaveStatus('error');
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
    <div className="space-y-6">
      <div className="flex flex-col gap-6">
        <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-800 flex items-center gap-2 text-xs uppercase tracking-widest">
              <Mail size={18} className="text-violet-600" />
              Selecione o Modelo de Carta
            </h3>
          </div>
          
          <div className="flex overflow-x-auto md:grid md:grid-cols-3 gap-3 pb-2 md:pb-0 custom-scrollbar">
            {CONGRESSO_TEMPLATES.map(template => (
              <div key={template.id} className="relative group/card">
                <button
                  onClick={() => setSelectedTemplate(template.id)}
                  className={`w-full text-left px-4 py-3 rounded-xl text-[16px] font-black transition-all uppercase tracking-tight border-2 flex flex-col gap-1 ${
                    selectedTemplate === template.id 
                      ? 'bg-violet-600 text-white border-violet-600 shadow-md' 
                      : 'bg-white text-gray-600 border-gray-50 hover:border-violet-200 hover:bg-violet-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 w-full">
                    <span className="truncate">{template.name}</span>
                    {templates[template.id] && <CheckCircle2 size={14} className={selectedTemplate === template.id ? 'text-white' : 'text-violet-500'} />}
                  </div>
                  {templates[template.id] && (
                    <span className={`text-[8px] px-1.5 py-0.5 rounded-md w-fit ${
                      templates[template.id].isPrivate 
                        ? (selectedTemplate === template.id ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-700')
                        : (selectedTemplate === template.id ? 'bg-white/20 text-white' : 'bg-violet-100 text-violet-700')
                    }`}>
                      {templates[template.id].isPrivate ? 'Seu Modelo' : 'Modelo ProgCir'}
                    </span>
                  )}
                </button>
                
                {canManage && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setSelectedTemplate(template.id); setIsManaging(!isManaging); }}
                    className={`absolute -top-2 -right-2 p-1.5 rounded-full shadow-lg border transition-all z-20 ${
                      isManaging && selectedTemplate === template.id
                        ? 'bg-amber-500 text-white border-amber-400 rotate-90'
                        : 'bg-white text-gray-400 border-gray-100 hover:text-violet-600'
                    }`}
                  >
                    <Settings2 size={12} />
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
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gray-50 p-4 rounded-2xl border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="bg-violet-100 p-2 rounded-lg">
                <FileText className="text-violet-600" size={20} />
              </div>
              <div>
                <h3 className="font-black text-gray-800 text-xs uppercase tracking-widest">Pré-visualização</h3>
                <div className="flex items-center gap-2">
                  <p className="text-[10px] text-gray-400 font-bold uppercase truncate max-w-[150px]">
                    {CONGRESSO_TEMPLATES.find(t => t.id === selectedTemplate)?.name}
                  </p>
                  {speakers.length > 0 && selectedTemplate !== 'cong_aviso_treinamentos' && (
                    <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg px-2 py-0.5 shadow-sm">
                      <User size={10} className="text-gray-400" />
                      <select 
                        value={selectedSpeaker}
                        onChange={(e) => setSelectedSpeaker(e.target.value)}
                        className="bg-transparent text-[9px] font-black text-gray-600 uppercase tracking-tighter outline-none cursor-pointer"
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

            <div className="flex items-center gap-2">
              {needsProcessing && (
                <button
                  onClick={processAndPreview}
                  disabled={isProcessing}
                  className="group flex items-center h-10 w-10 hover:w-44 transition-all duration-500 ease-in-out rounded-full bg-violet-600 text-white shadow-md overflow-hidden whitespace-nowrap pl-[11px] hover:pl-4 disabled:opacity-50"
                  title="Gerar PDF/Prévia"
                >
                  <div className="shrink-0">
                    {isProcessing ? <RefreshCw size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                  </div>
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 ml-2 font-black text-[10px] uppercase tracking-widest">
                    Gerar PDF/Prévia
                  </span>
                </button>
              )}

              <button
                onClick={downloadAsDocx}
                disabled={status !== 'success' || isProcessing}
                className="group flex items-center h-10 w-10 hover:w-32 transition-all duration-500 ease-in-out rounded-full bg-gray-800 text-white shadow-md overflow-hidden whitespace-nowrap pl-[11px] hover:pl-4 disabled:opacity-50"
                title="Baixar Word"
              >
                <FileDown size={14} className="shrink-0" />
                <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 ml-2 font-black text-[10px] uppercase tracking-widest">Baixar Word</span>
              </button>

              <button
                onClick={downloadAsPdf}
                disabled={status !== 'success' || isProcessing}
                className="group flex items-center h-10 w-10 hover:w-32 transition-all duration-500 ease-in-out rounded-full bg-red-600 text-white shadow-md overflow-hidden whitespace-nowrap pl-[11px] hover:pl-4 disabled:opacity-50"
                title="Baixar PDF"
              >
                <Download size={14} className="shrink-0" />
                <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 ml-2 font-black text-[10px] uppercase tracking-widest">Baixar PDF</span>
              </button>
            </div>
          </div>

          <div className="relative group">
            <div 
              className="w-full aspect-[1/1.414] bg-white border border-gray-200 rounded-3xl shadow-inner-lg overflow-auto p-4 md:p-12 custom-scrollbar"
            >
              <div 
                className="docx-preview-container mx-auto bg-white relative"
                style={{ width: '800px', minWidth: '800px' }}
              >
                <div ref={previewRef} />
                
                {!processedDocBuffer && !isProcessing && (
                  <div dangerouslySetInnerHTML={{ __html: previewHtml || '<div class="h-full flex flex-col items-center justify-center text-gray-300 py-20 px-10 text-center text-xs uppercase font-black tracking-widest leading-relaxed">Selecione um template para visualizar</div>' }} />
                )}
              </div>
            </div>
            {isProcessing && (
              <div className="absolute inset-0 bg-white/50 backdrop-blur-sm flex items-center justify-center rounded-3xl pointer-events-none">
                <RefreshCw className="w-10 h-10 text-violet-500 animate-spin" />
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
        .docx-preview-container {
          background-color: #ffffff !important;
        }
        .docx-preview-container p {
          font-size: 1.1rem !important;
          line-height: 1.25 !important;
          color: #1a1a1a !important;
          margin-bottom: 0.4rem !important;
        }
        .docx-preview-container * {
          border-color: #e5e7eb !important;
          outline-color: transparent !important;
          text-decoration-color: transparent !important;
          box-shadow: none !important;
        }
        .docx-preview-container .docx-preview {
          padding: 0 !important;
          margin: 0 !important;
          box-shadow: none !important;
          width: 100% !important;
        }
        .docx-preview-container section.docx {
          padding: 0 !important;
          margin: 0 !important;
          background: white !important;
          box-shadow: none !important;
        }
        
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
