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
  onBack: () => void;
}

export default function CartasESPView({ userId, isAdmin, onBack }: CartasESPViewProps) {
  const [showManager, setShowManager] = useState(false);
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
            <h1 className="text-3xl font-black text-gray-900 uppercase tracking-tight">Cartas ESP</h1>
            <p className="text-gray-500 font-bold uppercase tracking-widest text-[10px] bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full border border-emerald-100 w-fit mt-1">
              {showManager ? 'Gerenciador de Modelos' : 'Geração de Documentos'}
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
          
          {isAdmin && (
            <button
              onClick={() => setShowManager(!showManager)}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 border ${
                showManager 
                  ? 'bg-emerald-600 text-white border-emerald-600' 
                  : 'bg-white text-gray-600 border-gray-200 hover:border-emerald-200 hover:text-emerald-600'
              }`}
            >
              {showManager ? <List size={14} /> : <FileUp size={14} />}
              {showManager ? 'Voltar para Cartas' : 'Gerenciar Uploads'}
            </button>
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
            <div className="bg-gray-50 p-6 rounded-3xl border border-gray-200 relative overflow-hidden">
               <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500 opacity-5 rounded-bl-[5rem]" />
               <div className="flex items-center justify-between mb-6 relative z-10">
                <div>
                  <h3 className="font-black text-gray-800 flex items-center gap-2 text-sm uppercase tracking-widest">
                    <Mail size={18} className="text-emerald-600" />
                    Modelos de Uploads ESP
                  </h3>
                  <p className="text-[10px] font-bold text-gray-400 mt-1 uppercase tracking-widest">Selecione o modelo que deseja atualizar</p>
                </div>
                <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest bg-emerald-50 px-4 py-1.5 rounded-full border border-emerald-100 shadow-sm">
                  {ESP_TEMPLATES.length} Modelos Disponíveis
                </span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {ESP_TEMPLATES.map(template => (
                  <button
                    key={template.id}
                    onClick={() => loadTemplate(template.id)}
                    className={`text-left px-5 py-4 rounded-2xl text-[11px] font-black transition-all uppercase tracking-tight border-2 shadow-sm ${
                      selectedTemplate === template.id 
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-emerald-200' 
                        : 'bg-white text-gray-600 border-gray-100 hover:border-emerald-200 hover:bg-emerald-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="truncate">{template.name}</span>
                      {templates[template.id] && <CheckCircle2 size={16} className={selectedTemplate === template.id ? 'text-white' : 'text-emerald-500'} />}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid lg:grid-cols-12 gap-8">
              <div className="lg:col-span-12 xl:col-span-5 space-y-6">
                <div className="bg-emerald-50 p-8 rounded-3xl border-2 border-dashed border-emerald-200 relative">
                  <h4 className="text-xs font-black text-emerald-600 uppercase mb-4 tracking-widest flex items-center gap-2">
                    <FileUp size={14} />
                    Atualizar Template
                  </h4>
                  <div className="bg-white p-5 rounded-2xl border border-emerald-100 mb-6 shadow-sm">
                    <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider mb-2">Destino do Upload:</p>
                    <p className="text-sm font-black text-gray-800 break-all">{getTemplateName(selectedTemplate)}</p>
                  </div>

                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept=".docx"
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex flex-col items-center justify-center space-y-4 py-10 bg-white/60 hover:bg-white transition-all rounded-2xl border border-emerald-100 shadow-sm group"
                  >
                    <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-500 group-hover:scale-110 transition-transform">
                      <FileUp className="w-8 h-8" />
                    </div>
                    <div className="text-center px-4">
                      <span className="text-emerald-600 font-bold text-xs uppercase tracking-widest block">Selecionar Arquivo Word</span>
                      <p className="text-[10px] text-gray-400 mt-2 truncate max-w-[240px] font-bold italic line-clamp-1">
                        {file ? file.name : '.docx recomendado'}
                      </p>
                    </div>
                  </button>
                  
                  {file && (
                    <button
                      onClick={saveTemplate}
                      disabled={isSaving}
                      className="w-full mt-6 py-4 bg-emerald-600 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-emerald-700 disabled:opacity-50 transition-all shadow-xl shadow-emerald-100"
                    >
                      {isSaving ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                      Salvar Novo Template ESP
                    </button>
                  )}

                  <div className="mt-8 p-5 bg-amber-50 rounded-2xl border border-amber-100">
                    <div className="flex gap-3">
                      <AlertCircle className="text-amber-600 flex-shrink-0" size={20} />
                      <div className="space-y-1.5">
                        <p className="text-[11px] font-black text-amber-800 uppercase tracking-wider">Instruções Técnicas</p>
                        <p className="text-[10px] text-amber-700 font-medium leading-relaxed">
                          Utilize marcadores no formato <span className="font-black">[TAG]</span> como [DATA], [LOCAL], [INSTRUTORES], [HOJE] no Word. O sistema fará as substituições automáticas.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-12 xl:col-span-7 space-y-4">
                <div className="flex justify-between items-center px-4">
                  <h3 className="font-black text-gray-800 text-[10px] uppercase tracking-widest flex items-center gap-2">
                    <List size={14} className="text-emerald-600" />
                    Visualização do Template
                  </h3>
                  <span className="text-[9px] bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full font-black uppercase tracking-tight border border-emerald-200">
                    {file ? 'Arquivo Pendente' : 'Versão Atual no Banco'}
                  </span>
                </div>
                <div className="relative group">
                  <div 
                    className="w-full aspect-[1/1.414] bg-white border border-gray-200 rounded-[2.5rem] shadow-inner-lg overflow-hidden p-8 md:p-16 border-t-8 border-t-emerald-500"
                    style={{ overflowY: 'auto' }}
                  >
                    <div 
                      className="prose prose-sm max-w-none docx-preview-container-manager mx-auto"
                      dangerouslySetInnerHTML={{ __html: previewHtml || '<div class="h-full flex flex-col items-center justify-center text-gray-300 italic py-20 px-10 text-center uppercase font-black tracking-widest text-[11px]">Selecione um modelo para visualizar a prévia</div>' }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style jsx global>{`
        .docx-preview-container-manager {
          color: #374151 !important;
          background-color: #ffffff !important;
          font-family: 'Inter', sans-serif;
        }
        .docx-preview-container-manager * {
          border-color: #e5e7eb !important;
        }
        .docx-preview-container-manager h1 { font-size: 1.5rem; font-weight: bold; margin-bottom: 1rem; color: #111827 !important; }
        .docx-preview-container-manager p { margin-bottom: 0.5rem; line-height: 1.5; color: #374151 !important; }
        .docx-preview-container-manager table { width: 100%; border-collapse: collapse; margin-bottom: 1rem; border: 1px solid #e5e7eb; }
        .docx-preview-container-manager td, .docx-preview-container-manager th { border: 1px solid #e5e7eb; padding: 0.5rem; }
      `}</style>
    </div>
  );
}
