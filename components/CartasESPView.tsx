'use client';

import React, { useState, useRef, useEffect } from 'react';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import mammoth from 'mammoth';
import { FileUp, FileText, Download, RefreshCw, AlertCircle, CheckCircle2, Save, List, ArrowLeft, Mail } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '@/lib/firebase';
import PioneerSchoolLetters from './PioneerSchoolLetters';
import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  getDocs,
  onSnapshot, 
  query, 
  where 
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
  initialMode?: 'geracao' | 'manager';
  onBack: () => void;
}

export default function CartasESPView({ userId, isAdmin, initialMode = 'geracao', onBack }: CartasESPViewProps) {
  const [showManager, setShowManager] = useState(initialMode === 'manager');
  const [selectedTurma, setSelectedTurma] = useState<'1' | '2' | '3'>('1');
  const [schoolInfo, setSchoolInfo] = useState<any>(null);
  const [loadingInfo, setLoadingInfo] = useState(true);
  const [templates, setTemplates] = useState<Record<string, { content: string, updatedAt: string }>>({});
  const [file, setFile] = useState<File | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [selectedTemplate, setSelectedTemplate] = useState<string>(ESP_TEMPLATES[0].id);
  const [isSaving, setIsSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchTemplates();
  }, []);

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
        
        try {
          const arrayBuffer = await selectedFile.arrayBuffer();
          const result = await mammoth.convertToHtml({ arrayBuffer });
          setPreviewHtml(result.value);
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
        updatedAt: new Date().toISOString(),
        category: 'esp'
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
        const result = await mammoth.convertToHtml({ arrayBuffer: bytes.buffer });
        setPreviewHtml(result.value);
        setFile(null);
      } catch (err) {
        console.error('Error loading template preview:', err);
      }
    } else {
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
                      className={`text-left px-4 py-3 rounded-xl text-[10px] font-black transition-all uppercase tracking-tighter border-2 ${
                        selectedTemplate === template.id 
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' 
                          : 'bg-white text-gray-600 border-gray-50 hover:border-emerald-200 hover:bg-emerald-50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate">{template.name}</span>
                        {templates[template.id] && <CheckCircle2 size={12} className={selectedTemplate === template.id ? 'text-white' : 'text-emerald-500'} />}
                      </div>
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
                      <button
                        onClick={saveTemplate}
                        disabled={isSaving}
                        className="w-full py-3 bg-emerald-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-emerald-700 disabled:opacity-50 transition-all shadow-lg shadow-emerald-100"
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
                    className="prose prose-sm max-w-none docx-preview-container mx-auto"
                    dangerouslySetInnerHTML={{ __html: previewHtml || '<div class="h-full flex flex-col items-center justify-center text-gray-300 italic py-20 px-10 text-center uppercase font-black tracking-widest text-[10px]">Selecione um template para visualizar</div>' }}
                  />
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
      `}</style>
    </div>
  );
}
