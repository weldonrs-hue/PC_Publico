'use client';

import React, { useState, useRef, useEffect } from 'react';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { FileUp, FileText, Download, RefreshCw, AlertCircle, CheckCircle2, Save, List, ArrowLeft, Settings2, Layout, Send } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '@/lib/firebase';
import { extractTagsFromDocx, getMissingTags, cleanPSSMetadata } from '@/lib/docxUtils';
import { doc, getDoc, setDoc, collection, getDocs, deleteDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '@/utils/firestore';

const TEMPLATE_NAMES = Array.from({ length: 18 }, (_, i) => `PSS assignment letter_T_${(i + 1).toString().padStart(2, '0')}`);

export default function DocxToPdfDemo({ 
  userId,
  isAdmin, 
  canManage, 
  initialMode = 'geracao',
  onBack 
}: { 
  userId: string,
  isAdmin?: boolean, 
  canManage?: boolean, 
  initialMode?: 'geracao' | 'manager',
  onBack?: () => void
}) {
  const [showManager, setShowManager] = useState(initialMode === 'manager');
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [templates, setTemplates] = useState<Record<string, { content: string, updatedAt: string, isGlobal?: boolean, isPrivate?: boolean }>>({});
  const [file, setFile] = useState<File | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [selectedTemplate, setSelectedTemplate] = useState<string>(TEMPLATE_NAMES[0]);
  const [missingTags, setMissingTags] = useState<string[]>([]);
  const [extractedTags, setExtractedTags] = useState<string[]>([]);
  const [saveAsGlobal, setSaveAsGlobal] = useState(false);

  const [processedBuffer, setProcessedBuffer] = useState<ArrayBuffer | null>(null);
  const [isProcessingPreview, setIsProcessingPreview] = useState(false);

  const previewRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const viewerRef = useRef<any>(null);
  const [isViewerReady, setIsViewerReady] = useState(false);

  // Initialize viewer when management view is active
  useEffect(() => {
    let destroyed = false;

    const initViewer = async () => {
      if (!showManager) return;

      // Small delays to ensure container is fully loaded and attached to DOM
      for (let i = 0; i < 20; i++) {
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
        console.error('UDoc Viewer Init Error inside DocxToPdfDemo:', err);
      }
    };

    if (showManager && !viewerRef.current) {
      initViewer();
    }

    return () => {
      destroyed = true;
      if (viewerRef.current) {
        try { viewerRef.current.destroy(); viewerRef.current = null; setIsViewerReady(false); } catch (e) {}
      }
    };
  }, [showManager]);

  // Handle document updates
  useEffect(() => {
    const updateDoc = async () => {
      if (isViewerReady && viewerRef.current && processedBuffer) {
        setIsProcessingPreview(true);
        try {
          await viewerRef.current.load(new Uint8Array(processedBuffer));
        } catch (err) {
          console.error('UDoc Viewer Load Error:', err);
        } finally {
          setIsProcessingPreview(false);
        }
      }
    };

    updateDoc();
  }, [processedBuffer, isViewerReady]);

  useEffect(() => {
    fetchTemplates();
  }, [userId]);

  const fetchTemplates = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'document_templates'));
      const fetchedTemplates: Record<string, any> = {};
      
      querySnapshot.forEach((doc) => {
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
    } catch (error) {
      console.error('Error fetching templates:', error);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.name.endsWith('.docx')) {
        setFile(selectedFile);
        setProcessedBuffer(null); // Clear buffer to prevent using old data during processing
        
        // Initial preview
        try {
          const rawBuffer = await selectedFile.arrayBuffer();
          const cleanedBuffer = cleanPSSMetadata(rawBuffer);
          setProcessedBuffer(cleanedBuffer);

          // Validate tags
          const tags = await extractTagsFromDocx(cleanedBuffer);
          setExtractedTags(tags);
          
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
          console.error('Error generating preview:', err);
        }
      } else {
        setErrorMessage('Por favor, selecione um arquivo .docx');
        setSaveStatus('error');
        setTimeout(() => setSaveStatus('idle'), 5000);
      }
    }
  };

  const saveTemplate = async () => {
    if (!file) return;

    setIsSaving(true);
    setSaveStatus('idle');
    setErrorMessage('');
    
    try {
      // Use processedBuffer as it already filtered out the metadata
      const arrayBuffer = processedBuffer || await file.arrayBuffer();
      
      // Use FileReader for safe and fast base64 conversion of large files
      const blob = new Blob([arrayBuffer]);
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

      // If admin is saving as global, ensure their private version (if any) is deleted 
      // so it doesn't shadow the new global template in UI logic
      if (isAdmin && saveAsGlobal) {
        try {
          const privateId = `${userId}_${selectedTemplate}`;
          await deleteDoc(doc(db, 'document_templates', privateId));
        } catch (e) {
          console.log('No private template to delete or error deleting it:', e);
        }
      }
      
      setTemplates(prev => ({
        ...prev,
        [selectedTemplate]: { 
          content: base64, 
          updatedAt: new Date().toISOString(),
          isGlobal: isAdmin && saveAsGlobal,
          isPrivate: !(isAdmin && saveAsGlobal)
        }
      }));
      
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
      setFile(null); // Reset file after successful save
    } catch (error) {
      console.error('Error saving template:', error);
      const docId = isAdmin && saveAsGlobal ? selectedTemplate : `${userId}_${selectedTemplate}`;
      handleFirestoreError(error, OperationType.WRITE, `document_templates/${docId}`);
      setErrorMessage(error instanceof Error ? error.message : 'Erro desconhecido');
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 5000);
    } finally {
      setIsSaving(false);
    }
  };

  const loadTemplate = async (templateId: string) => {
    setSelectedTemplate(templateId);
    setMissingTags([]);
    setExtractedTags([]);
    const template = templates[templateId];
    if (template) {
      try {
        const binaryString = window.atob(template.content);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        setProcessedBuffer(bytes.buffer);
        setFile(null);
      } catch (err) {
        console.error('Error loading template preview:', err);
      }
    } else {
      setProcessedBuffer(null);
      setPreviewHtml('');
      setFile(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8 bg-white min-h-screen">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-3 bg-gray-50 hover:bg-gray-100 rounded-2xl transition-all text-gray-500 hover:text-blue-600 border border-gray-100 shadow-sm"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 uppercase tracking-tight">
              Gerenciar Templates PSS
            </h1>
            <p className="text-gray-500 font-medium uppercase tracking-widest text-[12px] bg-blue-50 text-blue-100 px-3 py-1 rounded-full border border-blue-50 w-fit mt-1">
              Escola de Pioneiros
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key="manager"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="flex flex-col gap-6"
        >
            {/* Top: Lista de Uploads em Grid */}
            <div className="bg-gray-50 p-6 rounded-2xl border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-800 flex items-center gap-2 text-sm uppercase tracking-tight">
                  <List size={18} className="text-blue-600" />
                  Selecione o Modelo
                </h3>
                <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest bg-white px-3 py-1 rounded-full border border-gray-100 shadow-sm">
                  {TEMPLATE_NAMES.length} Disponíveis
                </span>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                {TEMPLATE_NAMES.map(name => (
                  <button
                    key={name}
                    onClick={() => loadTemplate(name)}
                    className={`text-left px-3 py-3 rounded-xl text-[14px] font-black transition-all uppercase tracking-tighter border-2 flex flex-col gap-1 ${
                      selectedTemplate === name 
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm' 
                        : 'bg-white text-gray-600 border-gray-50 hover:border-blue-200 hover:bg-blue-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 w-full">
                      <span className="truncate">{name.replace('PSS assignment letter_', '')}</span>
                      {templates[name] && <CheckCircle2 size={12} className={selectedTemplate === name ? 'text-white' : 'text-blue-500'} />}
                    </div>
                    {templates[name] && (
                        <span className={`text-[8px] px-1.5 py-0.5 rounded-md w-fit ${
                          templates[name].isPrivate 
                            ? (selectedTemplate === name ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-700')
                            : (selectedTemplate === name ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-700')
                        }`}>
                          {templates[name].isPrivate ? 'Privado' : 'ProgCir'}
                        </span>
                      )}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid md:grid-cols-12 gap-8">
              {/* Lado Esquerdo: Upload */}
              <div className="md:col-span-12 lg:col-span-5 space-y-6">
                <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500 opacity-5 rounded-bl-[5rem]" />
                  <h4 className="text-xs font-black text-blue-600 uppercase mb-4 tracking-widest flex items-center gap-2">
                    <FileUp size={16} />
                    Ações do Template
                  </h4>
                  
                  <div className="space-y-4">
                    {isAdmin && (
                      <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-blue-100 mb-2">
                         <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Salvar para todos?</span>
                         <button
                           onClick={() => setSaveAsGlobal(!saveAsGlobal)}
                           className={`w-10 h-5 rounded-full transition-all relative ${saveAsGlobal ? 'bg-blue-500' : 'bg-gray-300'}`}
                         >
                           <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${saveAsGlobal ? 'left-6' : 'left-1'}`} />
                         </button>
                      </div>
                    )}
                    <div className="bg-white p-4 rounded-xl border border-blue-100">
                      <p className="text-[9px] font-bold text-blue-400 uppercase tracking-[0.2em] mb-1">Template Atual:</p>
                      <p className="text-xs font-black text-gray-800 break-all">{selectedTemplate}</p>
                    </div>

                    <div className="relative">
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept=".docx"
                        className="hidden"
                      />
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className={`w-full flex flex-col items-center justify-center p-6 rounded-xl text-[10px] font-black uppercase tracking-tighter border-2 border-dashed transition-all ${
                          file 
                            ? 'bg-amber-50 text-amber-700 border-amber-300' 
                            : 'bg-white text-blue-700 border-blue-200 hover:bg-blue-50'
                        }`}
                      >
                        <div className="flex flex-col items-center gap-2 text-center text-blue-600">
                          <FileUp size={24} className={file ? 'text-amber-500' : 'text-blue-500'} />
                          <span className="truncate max-w-full font-black tracking-widest">{file ? file.name : 'CARREGAR NOVO DOCX'}</span>
                        </div>
                      </button>
                    </div>
                    
                    {file && (
                      <div className="space-y-2">
                        {missingTags.length > 0 && (
                          <div className="p-3 bg-red-50 border border-red-100 rounded-xl space-y-1">
                            <p className="text-[9px] font-black text-red-600 uppercase tracking-widest flex items-center gap-1">
                              <AlertCircle size={12} className="shrink-0" />
                              Campos Faltantes
                            </p>
                            <p className="text-[8px] font-bold text-red-500 leading-tight">
                              Este documento não contém os seguintes marcadores recomendados: {missingTags.join(', ')}. Certifique-se de usar [CAMPO] ou @CAMPO no Word.
                            </p>
                          </div>
                        )}
                        {missingTags.length === 0 && (
                          <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl space-y-1">
                            <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-1">
                              <CheckCircle2 size={12} className="shrink-0" />
                              Status: OK
                            </p>
                            <p className="text-[8px] font-bold text-blue-500 leading-tight">
                              Todos os marcadores principais foram detectados no documento.
                            </p>
                          </div>
                        )}

                        <button
                          onClick={saveTemplate}
                          disabled={isSaving}
                          className={`w-full py-4 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-lg ${
                            saveStatus === 'success' 
                              ? 'bg-green-600 shadow-green-100 text-white' 
                              : saveStatus === 'error'
                                ? 'bg-red-600 shadow-red-100 text-white'
                                : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-100'
                          } disabled:opacity-50`}
                        >
                          {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : 
                           saveStatus === 'success' ? <CheckCircle2 className="w-4 h-4" /> :
                           saveStatus === 'error' ? <AlertCircle className="w-4 h-4" /> :
                           <Save className="w-4 h-4" />}
                          {isSaving ? 'Salvando...' : 
                           saveStatus === 'success' ? 'Salvo com Sucesso!' : 
                           saveStatus === 'error' ? 'Erro ao Salvar' :
                           'Salvar Alterações'}
                        </button>
                        {saveStatus === 'error' && errorMessage && (
                          <p className="text-[9px] text-red-500 font-bold text-center uppercase tracking-tight leading-tight">
                            {errorMessage}
                          </p>
                        )}
                        <button
                          onClick={() => { setFile(null); loadTemplate(selectedTemplate); }}
                          className="w-full py-2 text-gray-500 font-bold text-[9px] uppercase tracking-widest hover:text-red-500 transition-colors"
                        >
                          Cancelar
                        </button>
                      </div>
                    )}

                    <div className="p-4 bg-amber-50 rounded-xl border border-amber-100">
                      <div className="flex gap-2">
                        <AlertCircle className="text-amber-600 flex-shrink-0" size={16} />
                        <div className="space-y-1">
                          <p className="text-[10px] font-black text-amber-800 uppercase tracking-wider">Instruções</p>
                          <p className="text-[9px] text-amber-700 font-medium leading-relaxed">
                            O arquivo deve conter as tags de substituição que serão preenchidas na aba de geração da escola.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Lado Direito: Preview */}
              <div className="md:col-span-12 lg:col-span-7 space-y-3">
                <div className="flex justify-between items-center px-2">
                  <h3 className="font-black text-gray-800 text-xs uppercase tracking-widest flex items-center gap-2">
                    <FileText size={16} className="text-gray-400" />
                    Visualização do Documento
                  </h3>
                  <span className="text-[9px] bg-blue-100 text-blue-700 px-3 py-1 rounded-full font-black uppercase tracking-tighter border border-blue-200">
                    {file ? 'Arquivo Carregado' : 'Versão no Servidor'}
                  </span>
                </div>
                <div className="relative group shadow-2xl rounded-[2.5rem]">
                  <div 
                    className="w-full h-[650px] bg-[#1A1B1E] border border-[#2c2e33] rounded-[2.5rem] shadow-inner-lg overflow-hidden relative"
                  >
                    <div 
                      ref={previewRef}
                      className="w-full h-full"
                      style={{ display: processedBuffer ? 'block' : 'block', visibility: processedBuffer ? 'visible' : 'hidden', position: processedBuffer ? 'relative' : 'absolute' }}
                    />
                    
                    {!processedBuffer && (
                      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex flex-col items-center justify-center text-gray-500 font-bold uppercase tracking-widest text-xs">
                        Selecione um template para visualizar
                      </div>
                    )}
                    
                    {isProcessingPreview && (
                      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center">
                        <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
      </AnimatePresence>


      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #1A1B1E;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #2c2e33;
          border-radius: 10px;
        }
      `}</style>
    </div>
  );
}
