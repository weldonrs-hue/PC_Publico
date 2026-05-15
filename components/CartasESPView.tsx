'use client';

import React, { useState, useRef, useEffect } from 'react';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import * as docxPreview from 'docx-preview';
import { FileUp, FileText, Download, RefreshCw, AlertCircle, CheckCircle2, Save, List, ArrowLeft, Mail, Settings2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '@/lib/firebase';
import PioneerSchoolLetters from './PioneerSchoolLetters';
import { extractTagsFromDocx, getMissingTags, cleanPSSMetadata } from '@/lib/docxUtils';
import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  getDocs,
  onSnapshot, 
  query, 
  where,
  deleteDoc 
} from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '@/utils/firestore';

const ESP_TEMPLATES = [
  { id: 'esp_anfitria', name: 'Carta à anfitriã' },
  { id: 'esp_refeicoes', name: 'Carta convites refeições' },
  { id: 'esp_pioneiros', name: 'Carta convite pioneiros' },
];

interface CartasESPViewProps {
  userId: string;
  isAdmin?: boolean;
  canManage?: boolean;
  initialMode?: 'geracao' | 'manager';
  onBack: () => void;
}

export default function CartasESPView({ userId, isAdmin, canManage, initialMode = 'geracao', onBack }: CartasESPViewProps) {
  const [showManager, setShowManager] = useState(initialMode === 'manager');
  const [selectedTurma, setSelectedTurma] = useState<'1' | '2' | '3'>('1');
  const [schoolInfo, setSchoolInfo] = useState<any>(null);
  const [loadingInfo, setLoadingInfo] = useState(true);
  const [templates, setTemplates] = useState<Record<string, { content: string, updatedAt: string }>>({});
  const [file, setFile] = useState<File | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [selectedTemplate, setSelectedTemplate] = useState<string>(ESP_TEMPLATES[0].id);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [missingTags, setMissingTags] = useState<string[]>([]);
  const [extractedTags, setExtractedTags] = useState<string[]>([]);
  const [saveAsGlobal, setSaveAsGlobal] = useState(false);

  const [processedBuffer, setProcessedBuffer] = useState<ArrayBuffer | null>(null);
  const [isProcessingPreview, setIsProcessingPreview] = useState(false);

  const previewRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (processedBuffer && previewRef.current) {
      renderDocxPreview(processedBuffer);
    }
  }, [processedBuffer]);

  const renderDocxPreview = async (buffer: ArrayBuffer) => {
    if (!previewRef.current) return;
    setIsProcessingPreview(true);
    try {
      previewRef.current.innerHTML = '';
      await docxPreview.renderAsync(buffer, previewRef.current, undefined, {
        className: "docx-preview",
        inWrapper: false,
        ignoreWidth: true,
        ignoreHeight: true,
        breakPages: false,
        useBase64URL: true,
      });
    } catch (err) {
      console.error('Error rendering docx preview:', err);
    } finally {
      setIsProcessingPreview(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, [userId]);

  useEffect(() => {
    const infoDocId = `${userId}_turma${selectedTurma}`;
    const unsubscribe = onSnapshot(doc(db, 'pioneer_school_info', infoDocId), (doc) => {
      if (doc.exists()) {
        setSchoolInfo(doc.data());
      } else {
        setSchoolInfo({
          dataTurma: '',
          instrutorA: '',
          instrutorB: '',
          localEscola: '',
          enderecoEscola: '',
          entregaLivroEndereco: '',
          entregaLivroDataHora: '',
          confirmacaoDataLimite: '',
          confirmacaoEmail: '',
          confirmacaoWhatsapp: '',
        });
      }
      setLoadingInfo(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'pioneer_school_info');
      setLoadingInfo(false);
    });

    return () => unsubscribe();
  }, [userId, selectedTurma]);

  const fetchTemplates = async () => {
    try {
      // Fetch all templates (Global and Private)
      const querySnapshot = await getDocs(collection(db, 'document_templates'));
      const fetchedTemplates: Record<string, any> = {};
      
      // First pass: load everything
      querySnapshot.forEach((doc) => {
        fetchedTemplates[doc.id] = doc.data();
      });

      // Consolidação: For each base template ID, decide which one to show to the user
      // If user has a private one, use it. Otherwise use the global one.
      const consolidated: Record<string, any> = {};
      
      ESP_TEMPLATES.forEach(t => {
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
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.name.endsWith('.docx')) {
        setFile(selectedFile);
        setProcessedBuffer(null); // Limpa o buffer para evitar usar dados antigos durante o processamento
        
        try {
          const rawBuffer = await selectedFile.arrayBuffer();
          const cleanedBuffer = cleanPSSMetadata(rawBuffer);
          setProcessedBuffer(cleanedBuffer);
          
          // Validate tags
          const tags = await extractTagsFromDocx(cleanedBuffer);
          setExtractedTags(tags);
          
          const required = [
            ['DATA', 'TURMA_DATA', 'DATATURMA'],
            ['ASSINATURA', '%ASSINATURA', 'ASSINATURA_GLOBAL'],
            ['VIAJANTE', 'NOME_VIAJANTE'],
            ['CIRCUITO', 'NOME_CIRCUITO'],
            ['TURMA'],
            ['INSTRUTORES', 'INSTRUTOR1', 'INSTRUTOR2', 'INSTRUTORA', 'INSTRUTORB'],
            ['LOCAL', 'LOCALESCOLA', 'LOCAL_ESCOLA'],
            ['ENDERECO', 'ENDEREÇO', 'ENDERECOESCOLA', 'ENDEREÇO_ESCOLA'],
            ['TELEFONE', 'FONE', 'TELEFONE_CIRCUITO', 'TELEFONECIRCUITO']
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
        category: 'esp',
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

  const getTemplateName = (id: string) => {
    return ESP_TEMPLATES.find(t => t.id === id)?.name || id;
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8 bg-white min-h-screen">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-3 hover:bg-gray-100 rounded-2xl transition-all text-gray-500 hover:text-emerald-600 hover:scale-110 active:scale-95"
          >
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-3xl font-black text-gray-900 uppercase tracking-tight">
              {showManager ? 'Gerenciador de Uploads ESP' : 'Cartas ESP'}
            </h1>
            <p className="text-gray-500 font-bold uppercase tracking-widest text-[10px] bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full border border-emerald-100 w-fit mt-1">
              {showManager ? 'Gestão de Modelos' : 'Geração de Documentos'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {canManage && (
            <button
              onClick={() => setShowManager(!showManager)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                showManager 
                  ? 'bg-emerald-600 text-white shadow-lg' 
                  : 'bg-white text-emerald-600 border border-emerald-100 hover:bg-emerald-50'
              }`}
            >
              {showManager ? <Mail size={16} /> : <Settings2 size={16} />}
              {showManager ? 'Ir para Geração' : 'Gerenciar Templates'}
            </button>
          )}

          {!showManager && (
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-2 py-1 shadow-sm">
              <span className="text-[10px] font-bold text-gray-400 ml-2 uppercase tracking-widest">Turma:</span>
              <div className="flex gap-1">
                {(['1', '2', '3'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setSelectedTurma(t)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      selectedTurma === t 
                        ? 'bg-emerald-100 text-emerald-700 shadow-sm' 
                        : 'text-gray-400 hover:bg-gray-50'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}
          

        </div>
      </div>

      <AnimatePresence mode="wait">
        {!showManager ? (
          <motion.div
            key="letters"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            {loadingInfo ? (
              <div className="flex flex-col items-center justify-center p-20 space-y-4">
                <RefreshCw size={32} className="text-emerald-500 animate-spin" />
                <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">Carregando Informações...</p>
              </div>
            ) : (
              <PioneerSchoolLetters 
                userId={userId}
                selectedTurma={selectedTurma}
                schoolInfo={schoolInfo}
              />
            )}
          </motion.div>
        ) : (
          <motion.div
            key="manager"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex flex-col gap-6"
          >
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
              {/* Left Side: Template Selection */}
              <div className="xl:col-span-8 bg-gray-50 p-6 rounded-2xl border border-gray-200 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500 opacity-5 rounded-bl-[5rem]" />
                <div className="flex items-center justify-between mb-4 relative z-10">
                  <h3 className="font-bold text-gray-800 flex items-center gap-2 text-sm uppercase tracking-tight">
                    <List size={18} className="text-emerald-600" />
                    Selecione o Modelo
                  </h3>
                  <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest bg-white px-3 py-1 rounded-full border border-gray-100 shadow-sm">
                    {ESP_TEMPLATES.length} Disponíveis
                  </span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 relative z-10">
                  {ESP_TEMPLATES.map(template => (
                    <button
                      key={template.id}
                      onClick={() => loadTemplate(template.id)}
                      className={`text-left px-4 py-3 rounded-xl text-[10px] font-black transition-all uppercase tracking-tighter border-2 flex flex-col gap-1 ${
                        selectedTemplate === template.id 
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' 
                          : 'bg-white text-gray-600 border-gray-50 hover:border-emerald-200 hover:bg-emerald-50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 w-full">
                        <span className="truncate">{template.name}</span>
                        {templates[template.id] && <CheckCircle2 size={12} className={selectedTemplate === template.id ? 'text-white' : 'text-emerald-500'} />}
                      </div>
                      {templates[template.id] && (
                        <span className={`text-[8px] px-1.5 py-0.5 rounded-md w-fit ${
                          templates[template.id].isPrivate 
                            ? (selectedTemplate === template.id ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-700')
                            : (selectedTemplate === template.id ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-700')
                        }`}>
                          {templates[template.id].isPrivate ? 'Seu Modelo' : 'Modelo ProgCir'}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Right Side: Actions & Upload */}
              <div className="xl:col-span-4 bg-emerald-50 p-6 rounded-2xl border border-emerald-100 relative">
                <h4 className="text-xs font-black text-emerald-600 uppercase mb-4 tracking-widest flex items-center gap-2">
                  <FileUp size={16} />
                  Ações do Template
                </h4>
                
                <div className="space-y-4">
                  {isAdmin && (
                    <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-emerald-100 mb-2">
                       <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Salvar para todos?</span>
                       <button
                         onClick={() => setSaveAsGlobal(!saveAsGlobal)}
                         className={`w-10 h-5 rounded-full transition-all relative ${saveAsGlobal ? 'bg-emerald-500' : 'bg-gray-300'}`}
                       >
                         <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${saveAsGlobal ? 'left-6' : 'left-1'}`} />
                       </button>
                    </div>
                  )}

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
                      className={`w-full flex flex-col items-center justify-center p-4 rounded-xl text-[10px] font-black uppercase tracking-tighter border-2 border-dashed transition-all ${
                        file 
                          ? 'bg-amber-50 text-amber-700 border-amber-300' 
                          : 'bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50'
                      }`}
                    >
                      <div className="flex flex-col items-center gap-2 text-center">
                        <FileUp size={20} className={file ? 'text-amber-500' : 'text-emerald-500'} />
                        <span className="truncate max-w-full">{file ? file.name : 'Carregar novo arquivo DOCX'}</span>
                      </div>
                    </button>
                  </div>

                  {file ? (
                    <div className="space-y-2">
                      {missingTags.length > 0 && (
                        <div className="p-3 bg-red-50 border border-red-100 rounded-xl space-y-1">
                          <p className="text-[9px] font-black text-red-600 uppercase tracking-widest flex items-center gap-1">
                            <AlertCircle size={12} />
                            Campos Faltantes
                          </p>
                          <p className="text-[8px] font-bold text-red-500 leading-tight">
                            Este documento não contém os seguintes marcadores recomendados: {missingTags.join(', ')}. Certifique-se de usar [CAMPO] ou @CAMPO no Word.
                          </p>
                        </div>
                      )}
                      {missingTags.length === 0 && (
                        <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl space-y-1">
                          <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-1">
                            <CheckCircle2 size={12} />
                            Status: OK
                          </p>
                          <p className="text-[8px] font-bold text-emerald-500 leading-tight">
                            Todos os marcadores principais foram detectados no documento.
                          </p>
                        </div>
                      )}
                      
                      <button
                        onClick={saveTemplate}
                        disabled={isSaving}
                        className={`w-full py-3 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-lg ${
                          saveStatus === 'success' 
                            ? 'bg-green-600 shadow-green-100 text-white' 
                            : saveStatus === 'error'
                              ? 'bg-red-600 shadow-red-100 text-white'
                              : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-100'
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
                        onClick={() => { setFile(null); setPreviewHtml(''); loadTemplate(selectedTemplate); }}
                        className="w-full py-2 text-gray-500 font-bold text-[9px] uppercase tracking-widest hover:text-red-500 transition-colors"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <div className="text-[9px] font-bold text-emerald-600/60 uppercase tracking-widest text-center px-2">
                      Selecione um arquivo DOCX para atualizar o modelo <span className="text-emerald-700 font-black">{getTemplateName(selectedTemplate)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center px-2">
                <h3 className="font-black text-gray-800 text-xs uppercase tracking-widest flex items-center gap-2">
                  <FileText size={16} className="text-gray-400" />
                  Visualização do Documento
                </h3>
                <span className="text-[9px] bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full font-black uppercase tracking-tighter border border-emerald-200">
                  {file ? 'Arquivo Carregado' : 'Versão no Servidor'}
                </span>
              </div>
              <div className="relative">
                <div 
                  className="w-full aspect-[1/1.414] bg-white border border-gray-200 rounded-2xl shadow-inner-lg overflow-hidden p-8 md:p-16"
                  style={{ overflowY: 'auto' }}
                >
                  <div 
                    ref={previewRef}
                    className="docx-preview-container mx-auto"
                  >
                    {!processedBuffer && (
                      <div className="h-full flex flex-col items-center justify-center text-gray-300 italic py-20 px-10 text-center uppercase font-black tracking-widest text-[10px]">
                        Selecione um template para visualizar
                      </div>
                    )}
                  </div>
                  {isProcessingPreview && (
                    <div className="absolute inset-0 bg-white/50 backdrop-blur-sm flex items-center justify-center">
                      <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style jsx global>{`
        .docx-preview-container {
          color: #374151 !important;
          background-color: #ffffff !important;
          font-family: 'Inter', sans-serif;
        }
        .docx-preview-container * {
          border-color: #e5e7eb !important;
        }
        .docx-preview-container h1 { font-size: 1.5rem; font-weight: bold; margin-bottom: 1rem; color: #111827 !important; }
        .docx-preview-container p { margin-bottom: 0.5rem; line-height: 1.5; color: #374151 !important; }
        .docx-preview-container table { width: 100%; border-collapse: collapse; margin-bottom: 1rem; border: 1px solid #e5e7eb; }
        .docx-preview-container td, .docx-preview-container th { border: 1px solid #e5e7eb; padding: 0.5rem; }
        
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
      `}</style>
    </div>
  );
}
