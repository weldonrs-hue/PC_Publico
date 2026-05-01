'use client';

import React, { useState, useRef, useEffect } from 'react';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import mammoth from 'mammoth';
import { FileUp, FileText, Download, RefreshCw, AlertCircle, CheckCircle2, Save, List, ArrowLeft, Mail } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '@/utils/firestore';

const ESP_TEMPLATES = [
  { id: 'esp_anfitria', name: 'Carta à anfitriã' },
  { id: 'esp_refeicoes', name: 'Carta convites refeições' },
  { id: 'esp_pioneiros', name: 'Carta convite pioneiros' },
];

interface CartasESPViewProps {
  onBack: () => void;
}

export default function CartasESPView({ onBack }: CartasESPViewProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [templates, setTemplates] = useState<Record<string, { content: string, updatedAt: string }>>({});
  const [file, setFile] = useState<File | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [selectedTemplate, setSelectedTemplate] = useState<string>(ESP_TEMPLATES[0].id);

  const fileInputRef = useRef<HTMLInputElement>(null);

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
      <div className="flex items-center gap-4">
        <button 
          onClick={onBack}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-600 hover:text-blue-600"
          title="Voltar ao Painel de Cartas"
        >
          <ArrowLeft size={24} />
        </button>
        <div className="text-left space-y-1">
          <h1 className="text-3xl font-bold text-gray-900 uppercase tracking-tight">Gerenciador de Cartas ESP</h1>
          <p className="text-gray-500 font-medium">Upload e gestão de templates Word para as cartas ESP.</p>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
              <Mail size={18} />
              Modelos de Cartas ESP
            </h3>
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest bg-white px-3 py-1 rounded-full border border-gray-100 shadow-sm">
              {ESP_TEMPLATES.length} Modelos
            </span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {ESP_TEMPLATES.map(template => (
              <button
                key={template.id}
                onClick={() => loadTemplate(template.id)}
                className={`text-left px-4 py-3 rounded-xl text-[11px] font-black transition-all uppercase tracking-tight border-2 ${
                  selectedTemplate === template.id 
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' 
                    : 'bg-white text-gray-600 border-gray-50 hover:border-emerald-200 hover:bg-emerald-50'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="truncate">{template.name}</span>
                  {templates[template.id] && <CheckCircle2 size={14} className={selectedTemplate === template.id ? 'text-white' : 'text-emerald-500'} />}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="grid md:grid-cols-12 gap-8">
          <div className="md:col-span-12 lg:col-span-5 space-y-6">
            <div className="bg-emerald-50 p-6 rounded-2xl border-2 border-dashed border-emerald-200">
              <h4 className="text-xs font-black text-emerald-600 uppercase mb-4 tracking-widest">Atualizar Template</h4>
              <div className="bg-white p-4 rounded-xl border border-emerald-100 mb-4">
                <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider mb-2">Destino:</p>
                <p className="text-xs font-black text-gray-800 break-all">{getTemplateName(selectedTemplate)}</p>
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
                className="w-full flex flex-col items-center justify-center space-y-3 py-6 bg-white/50 hover:bg-white transition-colors rounded-xl border border-emerald-100 shadow-sm"
              >
                <FileUp className="w-8 h-8 text-emerald-500" />
                <div className="text-center px-4">
                  <span className="text-emerald-600 font-bold text-xs uppercase tracking-widest">Carregar DOCX</span>
                  <p className="text-[9px] text-gray-500 mt-1 truncate max-w-[200px] font-bold">{file ? file.name : 'Nenhum arquivo selecionado'}</p>
                </div>
              </button>
              
              {file && (
                <button
                  onClick={saveTemplate}
                  disabled={isSaving}
                  className="w-full mt-4 py-3 bg-emerald-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-emerald-700 disabled:opacity-50 transition-all shadow-lg shadow-emerald-100"
                >
                  {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Salvar Template ESP
                </button>
              )}

              <div className="mt-6 p-4 bg-amber-50 rounded-xl border border-amber-100">
                <div className="flex gap-2">
                  <AlertCircle className="text-amber-600 flex-shrink-0" size={16} />
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-amber-800 uppercase tracking-wider">Instruções</p>
                    <p className="text-[9px] text-amber-700 font-medium leading-relaxed">
                      Utilize marcadores no formato [TAG] no seu arquivo Word. O sistema fará as substituições automáticas ao gerar os documentos.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="md:col-span-12 lg:col-span-7 space-y-3">
            <div className="flex justify-between items-center px-2">
              <h3 className="font-black text-gray-800 text-xs uppercase tracking-widest">Visualização</h3>
              <span className="text-[9px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-black uppercase tracking-tighter">
                {file ? 'Arquivo Local' : 'Versão no Banco'}
              </span>
            </div>
            <div className="relative group">
              <div 
                className="w-full aspect-[1/1.414] bg-white border border-gray-200 rounded-3xl shadow-inner-lg overflow-hidden p-10"
                style={{ overflowY: 'auto' }}
              >
                <div 
                  className="prose prose-sm max-w-none docx-preview-container"
                  dangerouslySetInnerHTML={{ __html: previewHtml || '<div class="h-full flex flex-col items-center justify-center text-gray-300 italic py-20 px-10 text-center uppercase font-black tracking-widest text-[10px]">Selecione um modelo para visualizar</div>' }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .docx-preview-container {
          color: #374151 !important;
          background-color: #ffffff !important;
          font-family: 'Inter', sans-serif;
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
