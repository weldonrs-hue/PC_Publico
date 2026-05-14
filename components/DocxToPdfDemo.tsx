'use client';

import React, { useState, useRef, useEffect } from 'react';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import * as docxPreview from 'docx-preview';
import { FileUp, FileText, Download, RefreshCw, AlertCircle, CheckCircle2, Save, List, ArrowLeft, Settings2, Layout, Send } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '@/utils/firestore';

const TEMPLATE_NAMES = Array.from({ length: 18 }, (_, i) => `PSS assignment letter_T_${(i + 1).toString().padStart(2, '0')}`);

export default function DocxToPdfDemo({ 
  isAdmin, 
  canManage, 
  initialMode = 'geracao',
  onBack 
}: { 
  isAdmin?: boolean, 
  canManage?: boolean, 
  initialMode?: 'geracao' | 'manager',
  onBack?: () => void
}) {
  const [showManager, setShowManager] = useState(initialMode === 'manager');
  const [isSaving, setIsSaving] = useState(false);
  const [templates, setTemplates] = useState<Record<string, { content: string, updatedAt: string }>>({});
  const [file, setFile] = useState<File | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [selectedTemplate, setSelectedTemplate] = useState<string>(TEMPLATE_NAMES[0]);

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
    try {
      const querySnapshot = await getDocs(collection(db, 'document_templates'));
      const fetchedTemplates: Record<string, any> = {};
      querySnapshot.forEach((doc) => {
        fetchedTemplates[doc.id] = doc.data();
      });
      setTemplates(fetchedTemplates);
    } catch (error) {
      console.error('Error fetching templates:', error);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.name.endsWith('.docx')) {
        setFile(selectedFile);
        
        // Initial preview
        try {
          const arrayBuffer = await selectedFile.arrayBuffer();
          setProcessedBuffer(arrayBuffer);
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
        updatedAt: new Date().toISOString()
      });
      
      setTemplates(prev => ({
        ...prev,
        [selectedTemplate]: { content: base64, updatedAt: new Date().toISOString() }
      }));
      
      alert('Template salvo com sucesso!');
    } catch (error) {
      console.error('Error saving template:', error);
      handleFirestoreError(error, OperationType.WRITE, `document_templates/${selectedTemplate}`);
    } finally {
      setIsSaving(false);
    }
  };

  const loadTemplate = async (templateId: string) => {
    setSelectedTemplate(templateId);
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
              {showManager ? 'Gerenciador PSS' : 'Workshops PSS'}
            </h1>
            <p className="text-gray-500 font-medium uppercase tracking-widest text-[10px] bg-blue-50 text-blue-600 px-3 py-1 rounded-full border border-blue-100 w-fit mt-1">
              {showManager ? 'Gestão de Templates' : 'Geração de Documentos'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {canManage && (
            <button
              onClick={() => setShowManager(!showManager)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                showManager 
                  ? 'bg-blue-600 text-white shadow-lg' 
                  : 'bg-white text-blue-600 border border-blue-100 hover:bg-blue-50'
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
                    className={`text-left px-3 py-3 rounded-xl text-[10px] font-black transition-all uppercase tracking-tighter border-2 ${
                      selectedTemplate === name 
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm' 
                        : 'bg-white text-gray-600 border-gray-50 hover:border-blue-200 hover:bg-blue-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="truncate">{name.replace('PSS assignment letter_', '')}</span>
                      {templates[name] && <CheckCircle2 size={12} className={selectedTemplate === name ? 'text-white' : 'text-blue-500'} />}
                    </div>
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
                        <button
                          onClick={saveTemplate}
                          disabled={isSaving}
                          className="w-full py-4 bg-blue-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-blue-700 disabled:opacity-50 transition-all shadow-lg shadow-blue-100"
                        >
                          {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                          Salvar Alterações
                        </button>
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
                    className="w-full aspect-[1/1.414] bg-white border border-gray-200 rounded-[2.5rem] shadow-inner-lg overflow-hidden p-8 md:p-16"
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
                        <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
                      </div>
                    )}
                  </div>
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
              <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center mx-auto text-blue-600 shadow-inner">
                <Send size={48} />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-black text-gray-800 uppercase tracking-tight">Em Breve</h3>
                <p className="text-gray-500 font-medium">
                  O módulo de geração de workshops PSS será disponibilizado em breve.
                </p>
              </div>
              <button 
                onClick={onBack}
                className="mt-4 px-8 py-3 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
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
        }
        .docx-preview-container * {
          border-color: #e5e7eb !important;
          outline-color: transparent !important;
          text-decoration-color: transparent !important;
          box-shadow: none !important;
        }
        .docx-preview-container h1 { font-size: 1.5rem; font-weight: bold; margin-bottom: 1rem; color: #111827 !important; }
        .docx-preview-container h2 { font-size: 1.25rem; font-weight: bold; margin-bottom: 0.75rem; color: #1f2937 !important; }
        .docx-preview-container p { margin-bottom: 0.5rem; line-height: 1.5; color: #374151 !important; }
        .docx-preview-container table { width: 100%; border-collapse: collapse; margin-bottom: 1rem; border: 1px solid #e5e7eb; background: #ffffff; }
        .docx-preview-container td, .docx-preview-container th { border: 1px solid #e5e7eb; padding: 0.5rem; color: #374151 !important; }
        .docx-preview-container strong, .docx-preview-container b { color: #111827 !important; font-weight: bold; }
        .docx-preview-container ul, .docx-preview-container ol { margin-bottom: 0.5rem; padding-left: 1.5rem; }
        .docx-preview-container li { margin-bottom: 0.25rem; color: #374151 !important; }
        
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
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #d1d5db;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #9ca3af;
        }
      `}</style>
    </div>
  );
}
