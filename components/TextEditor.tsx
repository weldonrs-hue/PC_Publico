'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { 
  ChevronLeft, 
  ChevronDown, 
  ChevronRight,
  Save, 
  Undo2, 
  Redo2, 
  Printer,
  Download,
  Trash2,
  Sparkles,
  Zap,
  CheckCircle2,
  Layout,
  Wand2,
  FileText,
  Clock,
  History,
  Monitor,
  Search,
  Loader2,
  Maximize2,
  Minimize2,
  Share2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import 'react-quill-new/dist/quill.snow.css';

// Dynamic import for ReactQuill to avoid SSR errors
const ReactQuill = dynamic(() => import('react-quill-new'), { ssr: false });

const editorFormats = [
  'header', 'font', 'size',
  'bold', 'italic', 'underline', 'strike', 'blockquote',
  'list', 'indent',
  'link', 'image', 'video', 'color', 'background', 'align'
];

const editorModules = {
  toolbar: {
    container: "#quill-toolbar-container",
  },
  history: {
    delay: 2000,
    maxStack: 500,
    userOnly: true
  }
};

export default function TextEditor({ onBack }: { onBack?: () => void }) {
  const [mounted, setMounted] = useState(false);
  const [content, setContent] = useState('');
  const quillRef = useRef<any>(null);
  const [title, setTitle] = useState('Documento Sem Título');
  const [zoom, setZoom] = useState(100);
  const [isSaving, setIsSaving] = useState(false);
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [replaceTerm, setReplaceTerm] = useState('');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [notification, setNotification] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSave = useCallback(() => {
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      showNotification('Documento salvo com sucesso!');
    }, 1000);
  }, []);

  const handlePrint = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  }, []);

  const handleChange = useCallback((val: string) => {
    setContent(val);
  }, []);

  // Statistics
  const wordCount = useMemo(() => {
    return content.replace(/<[^>]*>/g, '').trim().split(/\s+/).filter(Boolean).length;
  }, [content]);

  const handleUndo = () => {
    // Manual undo would need a ref
  };

  const handleRedo = () => {
    // Manual redo would need a ref
  };

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  const handleClearAll = () => {
    setContent('');
    setShowClearConfirm(false);
    showNotification('Conteúdo limpo.');
  };

  const handleAIAssist = async (type: string, prompt?: string) => {
    setIsAiGenerating(true);
    // Simulation of AI response
    setTimeout(() => {
      setIsAiGenerating(false);
      setShowAIModal(false);
      showNotification('Texto processado pela IA!');
      // Here would go the logic to update content with Gemini
    }, 2000);
  };

  const handleExportPDF = () => {
    showNotification('Preparando PDF para download...');
  };

  return (
    <div className="h-full bg-surface-container-low text-on-surface font-body-md overflow-hidden flex flex-col h-screen">
      {/* Notification */}
      <AnimatePresence>
        {notification && (
          <motion.div 
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 20 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-0 left-1/2 -translate-x-1/2 z-[6000] bg-zinc-800 text-white px-6 py-2 rounded-full shadow-2xl flex items-center gap-2"
          >
            <CheckCircle2 size={16} className="text-green-400" />
            <span className="text-sm font-medium">{notification}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="flex items-center justify-between px-6 h-14 w-full bg-white border-b border-slate-200 shadow-sm shrink-0">
        <div className="flex items-center gap-6 h-full">
          <button 
            type="button"
            onClick={onBack ? () => onBack() : undefined}
            className="text-xl font-extrabold text-blue-700 hover:opacity-80 transition-opacity"
          >
            ProgCir
          </button>
          <nav className="flex items-end h-full gap-4 text-sm font-medium">
            <button type="button" className="text-slate-500 hover:text-blue-700 pb-2 px-1 hover:bg-slate-50 transition-all">Arquivo</button>
            <button type="button" className="text-blue-700 border-b-2 border-blue-700 pb-2 px-1 hover:bg-slate-50 transition-all">Início</button>
            <button type="button" className="text-slate-500 hover:text-blue-700 pb-2 px-1 hover:bg-slate-50 transition-all">Inserir</button>
            <button type="button" className="text-slate-500 hover:text-blue-700 pb-2 px-1 hover:bg-slate-50 transition-all">Layout</button>
            <button type="button" className="text-slate-500 hover:text-blue-700 pb-2 px-1 hover:bg-slate-50 transition-all">Exibir</button>
          </nav>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 mr-4">
            <button 
              type="button" 
              onClick={() => setShowHistory(true)} 
              className="p-2 text-slate-500 hover:bg-slate-100 rounded-sm"
            >
              <History size={20} />
            </button>
            <button 
              type="button" 
              className="p-2 text-slate-500 hover:bg-slate-100 rounded-sm"
            >
              <Search size={20} />
            </button>
          </div>
          <button 
            type="button"
            className="px-4 py-1.5 bg-blue-700 text-white rounded hover:opacity-90 transition-all font-medium text-xs flex items-center gap-2"
          >
            <Share2 size={14} />
            Compartilhar
          </button>
        </div>
      </header>

      {/* Ribbon Toolbar */}
      <div id="progcir-editor-ribbon" className="bg-slate-50 border-b border-slate-200 flex items-stretch h-24 px-4 gap-0.5 overflow-x-auto shrink-0">
        {/* System Group (Manual) */}
        <div className="flex flex-col items-center px-3 border-r border-slate-200 py-2">
          <div className="flex items-center gap-1 mb-auto">
            <button type="button" onClick={() => handleSave()} className="p-2 hover:bg-white rounded-sm flex flex-col items-center gap-0.5 min-w-[48px] text-blue-700">
              <Save size={24} />
              <span className="text-[10px] font-medium text-slate-700">Salvar</span>
            </button>
            <div className="flex flex-col gap-0.5">
              <button 
                type="button" 
                className="ql-undo p-1 hover:bg-white rounded-sm flex items-center gap-2 pr-4 text-slate-600"
              >
                <span className="text-[10px] font-bold">↶</span>
                <span className="text-[10px]">Desfazer</span>
              </button>
              <button 
                type="button" 
                className="ql-redo p-1 hover:bg-white rounded-sm flex items-center gap-2 pr-4 text-slate-600"
              >
                <span className="text-[10px] font-bold">↷</span>
                <span className="text-[10px]">Refazer</span>
              </button>
            </div>
          </div>
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1 text-center w-full">SISTEMA</span>
        </div>

        {/* The rest of the toolbar in a dedicated container */}
        <div className="flex flex-col items-center px-3 border-r border-slate-200 py-2">
          <div className="mb-auto">
            <div id="quill-toolbar-container" className="flex items-center gap-0.5">
              {/* Font Group (Quill) */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1">
                  <select className="ql-font border border-slate-200 rounded-sm text-xs h-6 px-1 outline-none w-32">
                    <option value="arial">Arial</option>
                    <option value="courier-new">Courier New</option>
                    <option value="georgia">Georgia</option>
                    <option value="lucida">Lucida Sans</option>
                    <option value="times-new-roman">Times New Roman</option>
                    <option value="trebuchet">Trebuchet MS</option>
                    <option value="verdana">Verdana</option>
                  </select>
                  <select className="ql-size border border-slate-200 rounded-sm text-xs h-6 px-1 outline-none w-20">
                    <option value="small">Pequeno</option>
                    <option value="normal">Normal</option>
                    <option value="large">Grande</option>
                    <option value="huge">Enorme</option>
                  </select>
                </div>
                <div className="flex items-center gap-0.5">
                  <button type="button" className="ql-bold h-7 w-7 hover:bg-white border border-transparent hover:border-slate-200 rounded-sm font-bold text-slate-700">
                    <span className="pointer-events-none">B</span>
                  </button>
                  <button type="button" className="ql-italic h-7 w-7 hover:bg-white border border-transparent hover:border-slate-200 rounded-sm italic text-slate-700">
                    <span className="pointer-events-none">I</span>
                  </button>
                  <button type="button" className="ql-underline h-7 w-7 hover:bg-white border border-transparent hover:border-slate-200 rounded-sm underline text-slate-700">
                    <span className="pointer-events-none">U</span>
                  </button>
                  <button type="button" className="ql-strike h-7 w-7 hover:bg-white border border-transparent hover:border-slate-200 rounded-sm line-through text-slate-700">
                    <span className="pointer-events-none">S</span>
                  </button>
                  <div className="w-px h-4 bg-slate-200 mx-1"></div>
                  <select className="ql-color h-7 w-7"></select>
                  <select className="ql-background h-7 w-7"></select>
                </div>
              </div>

              <div className="w-px h-10 bg-slate-200 mx-2"></div>

              {/* Paragraph Group (Quill) */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-0.5">
                  <button type="button" className="ql-list h-7 w-7 flex items-center justify-center hover:bg-white border border-transparent hover:border-slate-200 rounded-sm text-slate-700" value="ordered">
                    <span className="pointer-events-none">1.</span>
                  </button>
                  <button type="button" className="ql-list h-7 w-7 flex items-center justify-center hover:bg-white border border-transparent hover:border-slate-200 rounded-sm text-slate-700" value="bullet">
                    <span className="pointer-events-none">•</span>
                  </button>
                  <div className="w-px h-4 bg-slate-200 mx-1"></div>
                  <button type="button" className="ql-indent h-7 w-7 flex items-center justify-center hover:bg-white border border-transparent hover:border-slate-200 rounded-sm text-slate-700" value="-1">
                    <span className="pointer-events-none">«</span>
                  </button>
                  <button type="button" className="ql-indent h-7 w-7 flex items-center justify-center hover:bg-white border border-transparent hover:border-slate-200 rounded-sm text-slate-700" value="+1">
                    <span className="pointer-events-none">»</span>
                  </button>
                </div>
                <div className="flex items-center gap-0.5">
                  <button type="button" className="ql-align h-7 w-7 flex items-center justify-center hover:bg-white border border-transparent hover:border-slate-200 rounded-sm text-slate-700" value="">
                    <span className="pointer-events-none">≡</span>
                  </button>
                  <button type="button" className="ql-align h-7 w-7 flex items-center justify-center hover:bg-white border border-transparent hover:border-slate-200 rounded-sm text-slate-700" value="center">
                    <span className="pointer-events-none">═</span>
                  </button>
                  <button type="button" className="ql-align h-7 w-7 flex items-center justify-center hover:bg-white border border-transparent hover:border-slate-200 rounded-sm text-slate-700" value="right">
                    <span className="pointer-events-none">─≡</span>
                  </button>
                  <button type="button" className="ql-align h-7 w-7 flex items-center justify-center hover:bg-white border border-transparent hover:border-slate-200 rounded-sm text-slate-700" value="justify">
                    <span className="pointer-events-none">☵</span>
                  </button>
                </div>
              </div>

              <div className="w-px h-10 bg-slate-200 mx-2"></div>

              {/* Styles Group (Quill) */}
              <div className="flex items-center gap-2">
                <button type="button" className="ql-header h-14 w-20 border border-slate-200 bg-white rounded-sm flex flex-col p-1 hover:border-blue-500 transition-colors text-left" value="">
                  <span className="text-[9px] text-slate-400 font-sans pointer-events-none">Normal</span>
                  <span className="text-sm font-medium leading-none mt-1 pointer-events-none">AaBbCc</span>
                </button>
                <button type="button" className="ql-header h-14 w-20 border border-slate-200 bg-white rounded-sm flex flex-col p-1 hover:border-blue-500 transition-colors text-left" value="1">
                  <span className="text-[9px] text-slate-400 font-sans pointer-events-none">Título 1</span>
                  <span className="text-base font-bold leading-none mt-1 pointer-events-none">AaBb</span>
                </button>
              </div>
            </div>
          </div>
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1 text-center w-full">FORMATO</span>
        </div>

        {/* Tools Group (Manual) */}
        <div className="flex flex-col items-center px-3 border-r border-slate-200 py-2">
          <div className="flex items-center gap-2 mb-auto h-14">
            <button 
              type="button"
              onClick={() => setShowAIModal(true)}
              className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl transition-all flex flex-col items-center gap-0.5 min-w-[64px]"
            >
              <Sparkles size={18} />
              <span className="text-[10px] font-bold">Assistente</span>
            </button>
            <button type="button" onClick={() => handlePrint()} className="p-2 hover:bg-white rounded-sm flex flex-col items-center gap-0.5">
              <Printer size={20} />
              <span className="text-[10px]">Imprimir</span>
            </button>
            <button type="button" onClick={() => handleExportPDF()} className="p-2 hover:bg-white rounded-sm flex flex-col items-center gap-0.5">
              <FileText size={20} />
              <span className="text-[10px]">PDF</span>
            </button>
          </div>
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">SISTEMA</span>
        </div>
      </div>

      {/* Editor Body */}
      <main className="flex-1 bg-slate-100 overflow-y-auto custom-scrollbar p-10 flex flex-col items-center relative">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0, scale: zoom / 100 }}
          className="w-[210mm] min-h-[297mm] bg-white shadow-xl p-[20mm] flex flex-col origin-top shrink-0 relative mb-12"
        >
          <div className="wordpad-editor flex-1 h-full">
            {mounted && (
              <ReactQuill 
                theme="snow"
                value={content}
                onChange={handleChange}
                modules={editorModules}
                formats={editorFormats}
                className="h-full"
                placeholder="Comece a digitar seu documento..."
              />
            )}
          </div>
        </motion.div>
      </main>

      {/* Footer / Status Bar */}
      <footer className="h-8 w-full bg-slate-50 border-t border-slate-200 px-6 flex items-center justify-between text-[11px] text-slate-600 shrink-0">
        <div className="flex items-center gap-6 h-full">
          <div className="flex items-center gap-2 pr-4 border-r border-slate-300 h-full">
            <span className="font-medium">Página 1 de 1</span>
          </div>
          <div className="flex items-center gap-2 pr-4 border-r border-slate-300 h-full">
            <span className="font-bold text-blue-700">{wordCount}</span>
            <span>palavras</span>
          </div>
          <div className="flex items-center gap-2">
            <span>Português (Brasil)</span>
          </div>
        </div>
        <div className="flex items-center gap-6 h-full">
          <div className="flex items-center h-full gap-3 pl-4 border-l border-slate-300">
            <button type="button" onClick={() => setZoom(Math.max(50, zoom - 10))}>-</button>
            <span className="w-10 text-center">{zoom}%</span>
            <button type="button" onClick={() => setZoom(Math.min(150, zoom + 10))}>+</button>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <AnimatePresence>
        {showAIModal && (
          <div className="fixed inset-0 z-[5000] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAIModal(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden p-8"
            >
              <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                <Sparkles className="text-indigo-600" />
                Assistente IA
              </h3>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <button 
                  onClick={() => handleAIAssist('fix')}
                  className="p-4 rounded-2xl bg-slate-50 hover:bg-indigo-50 border border-slate-100 transition-all text-sm font-bold flex flex-col items-center gap-2"
                >
                  <Zap className="text-amber-500" />
                  Corrigir
                </button>
                <button 
                  onClick={() => handleAIAssist('formal')}
                  className="p-4 rounded-2xl bg-slate-50 hover:bg-indigo-50 border border-slate-100 transition-all text-sm font-bold flex flex-col items-center gap-2"
                >
                  <FileText className="text-blue-500" />
                  Formalizar
                </button>
              </div>
              <textarea 
                className="w-full p-4 bg-slate-50 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px] text-sm"
                placeholder="Como posso ajudar com seu texto?"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
              />
              <div className="mt-6 flex justify-end gap-3">
                <button onClick={() => setShowAIModal(false)} className="px-4 py-2 text-slate-500 font-bold">Cancelar</button>
                <button 
                  onClick={() => handleAIAssist('custom', aiPrompt)}
                  className="px-6 py-2 bg-blue-700 text-white rounded-xl font-bold flex items-center gap-2"
                  disabled={isAiGenerating}
                >
                  {isAiGenerating ? <Loader2 size={18} className="animate-spin" /> : 'Executar'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style dangerouslySetInnerHTML={{ __html: `
        .wordpad-editor .ql-toolbar { display: none !important; }
        .wordpad-editor .ql-container { border: none !important; font-size: 14px; }
        .wordpad-editor .ql-editor { padding: 0 !important; min-height: 100%; }
        
        .custom-scrollbar::-webkit-scrollbar { width: 8px; height: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
      `}} />
    </div>
  );
}
