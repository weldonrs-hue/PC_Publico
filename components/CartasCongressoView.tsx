'use client';

import React, { useState, useRef, useEffect } from 'react';
import * as docxPreview from 'docx-preview';
import { FileUp, FileText, RefreshCw, CheckCircle2, Save, List, ArrowLeft, Mail, Layout, Settings2, Send, AlertCircle, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '@/lib/firebase';
import { extractTagsFromDocx, getMissingTags } from '@/lib/docxUtils';
import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  getDocs 
} from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '@/utils/firestore';

const CONGRESSO_TEMPLATES = [
  { id: 'cong_convite_oracao', name: 'Carta convite à oração' },
  { id: 'cong_presidente_sessao', name: 'Carta presidente de sessão' },
  { id: 'cong_aviso_treinamentos', name: 'Carta aviso treinamentos' },
];

interface CartasCongressoViewProps {
  userId: string;
  isAdmin?: boolean;
  canManage?: boolean;
  initialMode?: 'geracao' | 'manager';
  onBack: () => void;
}

export default function CartasCongressoView({ userId, isAdmin, canManage, initialMode = 'manager', onBack }: CartasCongressoViewProps) {
  const [showManager, setShowManager] = useState(initialMode === 'manager');
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<Record<string, { content: string, updatedAt: string }>>({});
  const [file, setFile] = useState<File | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [selectedTemplate, setSelectedTemplate] = useState<string>(CONGRESSO_TEMPLATES[0].id);
  const [isSaving, setIsSaving] = useState(false);
  const [missingTags, setMissingTags] = useState<string[]>([]);
  const [extractedTags, setExtractedTags] = useState<string[]>([]);

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
  }, []);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, 'document_templates'));
      const fetchedTemplates: Record<string, any> = {};
      querySnapshot.forEach((doc) => {
        fetchedTemplates[doc.id] = doc.data();
      });
      setTemplates(fetchedTemplates);
    } catch (error) {
      console.error('Error fetching templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.name.endsWith('.docx')) {
        setFile(selectedFile);
        
        try {
          const arrayBuffer = await selectedFile.arrayBuffer();
          setProcessedBuffer(arrayBuffer);
          
          // Validate tags
          const tags = await extractTagsFromDocx(arrayBuffer);
          setExtractedTags(tags);
          
          const required = [
            ['TEMA'],
            ['DATA'],
            ['LOCAL'],
            ['DIA'],
            ['ORADOR'],
            ['VIAJANTE'],
            ['CIRCUITO'],
            ['DESIGNAÇÃO', 'DESIGNACAO'],
            ['ASSINATURA', '%ASSINATURA'],
            ['FONE', 'TELEFONE'],
            ['DATAHORA'],
            ['LOCALTREINO']
          ];
          
          const missing = getMissingTags(tags, required);
          setMissingTags(missing);
        } catch (err) {
          console.error('Error generating preview:', err);
        }
      } else {
        alert('Por favor, selecione um arquivo .docx');
      }
    }
  };

  const saveTemplate = async () => {
    if (!file) return;
    
    if (missingTags.length > 0) {
      const confirmSave = confirm(`Atenção: Os seguintes campos recomendados não foram encontrados no documento: \n\n${missingTags.join(', ')}\n\nDeseja salvar assim mesmo?`);
      if (!confirmSave) return;
    }

    setIsSaving(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      let binary = '';
      const len = uint8Array.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(uint8Array[i]);
      }
      const base64 = window.btoa(binary);
      
      await setDoc(doc(db, 'document_templates', selectedTemplate), {
        name: selectedTemplate,
        content: base64,
        updatedAt: new Date().toISOString(),
        category: 'congresso'
      });
      
      setTemplates(prev => ({
        ...prev,
        [selectedTemplate]: { content: base64, updatedAt: new Date().toISOString() }
      }));
      
      alert('Template salvo com sucesso!');
      setFile(null);
    } catch (error) {
      console.error('Error saving template:', error);
      handleFirestoreError(error, OperationType.WRITE, `document_templates/${selectedTemplate}`);
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
    return CONGRESSO_TEMPLATES.find(t => t.id === id)?.name || id;
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8 bg-white min-h-screen">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-3 hover:bg-gray-100 rounded-2xl transition-all text-gray-500 hover:text-violet-600 hover:scale-110 active:scale-95"
          >
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-3xl font-black text-gray-900 uppercase tracking-tight">
              {showManager ? 'Gerenciador de Uploads Congresso' : 'Cartas Congresso'}
            </h1>
            <p className="text-gray-500 font-bold uppercase tracking-widest text-[10px] bg-violet-50 text-violet-600 px-3 py-1 rounded-full border border-violet-100 w-fit mt-1">
              {showManager ? 'Gestão de Modelos para Congresso' : 'Geração de Cartas'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {canManage && (
            <button
              onClick={() => setShowManager(!showManager)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                showManager 
                  ? 'bg-violet-600 text-white shadow-lg' 
                  : 'bg-white text-violet-600 border border-violet-100 hover:bg-violet-50'
              }`}
            >
              {showManager ? <Layout size={16} /> : <Settings2 size={16} />}
              {showManager ? 'Ir para Geração' : 'Gerenciar Templates'}
            </button>
          )}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {showManager ? (
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
                <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500 opacity-5 rounded-bl-[5rem]" />
                <div className="flex items-center justify-between mb-4 relative z-10">
                  <h3 className="font-bold text-gray-800 flex items-center gap-2 text-sm uppercase tracking-tight">
                    <List size={18} className="text-violet-600" />
                    Selecione o Modelo
                  </h3>
                  <span className="text-[10px] font-black text-violet-600 uppercase tracking-widest bg-white px-3 py-1 rounded-full border border-gray-100 shadow-sm">
                    {CONGRESSO_TEMPLATES.length} Disponíveis
                  </span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 relative z-10">
                  {CONGRESSO_TEMPLATES.map(template => (
                    <button
                      key={template.id}
                      onClick={() => loadTemplate(template.id)}
                      className={`text-left px-4 py-3 rounded-xl text-[10px] font-black transition-all uppercase tracking-tighter border-2 ${
                        selectedTemplate === template.id 
                          ? 'bg-violet-600 text-white border-violet-600 shadow-sm' 
                          : 'bg-white text-gray-600 border-gray-50 hover:border-violet-200 hover:bg-violet-50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate">{template.name}</span>
                        {templates[template.id] && <CheckCircle2 size={12} className={selectedTemplate === template.id ? 'text-white' : 'text-violet-500'} />}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Right Side: Actions & Upload */}
              <div className="xl:col-span-4 bg-violet-50 p-6 rounded-2xl border border-violet-100 relative">
                <h4 className="text-xs font-black text-violet-600 uppercase mb-4 tracking-widest flex items-center gap-2">
                  <FileUp size={16} />
                  Ações do Template
                </h4>
                
                <div className="space-y-4">
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
                          : 'bg-white text-violet-700 border-violet-200 hover:bg-violet-50'
                      }`}
                    >
                      <div className="flex flex-col items-center gap-2 text-center">
                        <FileUp size={20} className={file ? 'text-amber-500' : 'text-violet-500'} />
                        <span className="truncate max-w-full">{file ? file.name : 'Carregar novo arquivo DOCX'}</span>
                      </div>
                    </button>
                  </div>

                  {file ? (
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
                        <div className="p-3 bg-violet-50 border border-violet-100 rounded-xl space-y-1">
                          <p className="text-[9px] font-black text-violet-600 uppercase tracking-widest flex items-center gap-1">
                            <CheckCircle2 size={12} className="shrink-0" />
                            Status: OK
                          </p>
                          <p className="text-[8px] font-bold text-violet-500 leading-tight">
                            Todos os marcadores principais foram detectados no documento.
                          </p>
                        </div>
                      )}

                      <button
                        onClick={saveTemplate}
                        disabled={isSaving}
                        className="w-full py-3 bg-violet-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-violet-700 disabled:opacity-50 transition-all shadow-lg shadow-violet-100"
                      >
                        {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Salvar Alterações
                      </button>

                      <button
                        onClick={() => { setFile(null); setPreviewHtml(''); loadTemplate(selectedTemplate); }}
                        className="w-full py-2 text-gray-500 font-bold text-[9px] uppercase tracking-widest hover:text-red-500 transition-colors"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <div className="text-[9px] font-bold text-violet-600/60 uppercase tracking-widest text-center px-2">
                      Selecione um arquivo DOCX para atualizar o modelo <span className="text-violet-700 font-black">{getTemplateName(selectedTemplate)}</span>
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
                <span className="text-[9px] bg-violet-100 text-violet-700 px-3 py-1 rounded-full font-black uppercase tracking-tighter border border-violet-200">
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
                      <RefreshCw className="w-8 h-8 text-violet-500 animate-spin" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="generation"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-white rounded-[3rem] shadow-xl border border-gray-100 p-12 text-center"
          >
            <div className="max-w-md mx-auto space-y-6">
              <div className="w-24 h-24 bg-violet-100 rounded-full flex items-center justify-center mx-auto text-violet-600 shadow-inner">
                <Send size={48} />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-black text-gray-800 uppercase tracking-tight">Em Breve</h3>
                <p className="text-gray-500 font-medium">
                  O módulo de geração de cartas para congresso será disponibilizado em breve.
                </p>
              </div>
              <button 
                onClick={onBack}
                className="mt-4 px-8 py-3 bg-violet-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-violet-700 transition-all shadow-lg shadow-violet-100"
              >
                Voltar
              </button>
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
