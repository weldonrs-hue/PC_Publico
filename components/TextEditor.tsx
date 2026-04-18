'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { 
  ChevronLeft, 
  Save, 
  Printer, 
  Trash2, 
  Download, 
  FileText, 
  Search, 
  Type, 
  List, 
  AlignLeft, 
  AlignCenter,
  AlignRight,
  AlignJustify,
  Image as ImageIcon, 
  Video, 
  Maximize2, 
  Minimize2,
  Undo2,
  Redo2,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Subscript,
  Superscript,
  Palette,
  Eraser,
  Smile,
  ListOrdered,
  IndentDecrease,
  IndentIncrease,
  Minus,
  ClipboardPaste,
  Link as LinkIcon,
  Code,
  FileJson,
  Monitor,
  MoreHorizontal,
  ChevronDown,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Zap,
  Languages,
  Wand2,
  History,
  Layout,
  Clock,
  ExternalLink,
  Table as TableIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import 'react-quill-new/dist/quill.snow.css';
import { GoogleGenAI } from "@google/genai";
import { jsPDF } from 'jspdf';
import { db } from '@/lib/firebase';
import { doc, setDoc } from 'firebase/firestore';

const ReactQuill = dynamic(
  async () => {
    const { Quill, default: RQ } = await import('react-quill-new');
    
    // Register custom fonts and sizes with Quill BEFORE returning the component
    if (Quill) {
      try {
        // Register Fonts
        const Font = Quill.import('formats/font') as any;
        Font.whitelist = [
          'arial',
          'courier-new',
          'georgia',
          'lucida',
          'tahoma',
          'times-new-roman',
          'trebuchet',
          'verdana'
        ];
        Quill.register(Font, true);

        // Register Sizes
        const Size = Quill.import('formats/size') as any;
        Size.whitelist = ['small', 'large', 'huge'];
        Quill.register(Size, true);
      } catch (e) {
        console.error('Error registering Quill formats:', e);
      }
    }

    return function QuillWrapper({ forwardedRef, ...props }: any) {
      return <RQ ref={forwardedRef} {...props} />;
    };
  },
  { 
    ssr: false,
    loading: () => <div className="h-[500px] w-full bg-gray-50 animate-pulse rounded-xl flex items-center justify-center text-gray-400">Carregando Editor...</div>
  }
);

interface TextEditorProps {
  userId: string;
  onBack: () => void;
}

export default function TextEditor({ userId, onBack }: TextEditorProps) {
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('Documento Sem Título');
  const [isSaving, setIsSaving] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' | 'ai' } | null>(null);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<{title: string, date: string, content: string}[]>([]);

  const aiClient = useMemo(() => new GoogleGenAI({ 
    apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY || '' 
  }), []);

  const showNotification = (message: string, type: 'success' | 'error' | 'info' | 'ai' = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleAIAssist = async (type: string, customPrompt?: string) => {
    if (!content && !customPrompt) {
      showNotification('Adicione algum texto para o assistente analisar', 'error');
      return;
    }

    setIsAiGenerating(true);
    setIsProcessing('ai');
    showNotification('O assistente está processando seu texto...', 'ai');

    try {
      const quill = quillRef.current?.getEditor();
      if (!quill) return;
      
      const selection = quill.getSelection();
      // Safely handle selection which can be null
      const selectedText = (selection && typeof selection.index === 'number') 
        ? quill.getText(selection.index, selection.length) 
        : quill.getText();
      
      let systemInstruction = "Você é um assistente de redação profissional especializado em textos formais para organizações religiosas (Testemunhas de Jeová). Seu tom deve ser respeitoso, claro e equilibrado.";
      let prompt = "";

      switch (type) {
        case 'fix':
          prompt = `Corrija a gramática e ortografia do seguinte texto, mantendo o sentido original: "${selectedText}"`;
          break;
        case 'formal':
          prompt = `Reescreva o seguinte texto em um tom mais formal e polido, adequado para uma carta oficial do circuito: "${selectedText}"`;
          break;
        case 'summarize':
          prompt = `Faça um resumo direto e conciso dos pontos principais deste texto: "${selectedText}"`;
          break;
        case 'expand':
          prompt = `Desenvolva mais este ponto, adicionando detalhes pertinentes e mantendo o tom espiritual: "${selectedText}"`;
          break;
        case 'custom':
          prompt = `${customPrompt}\n\nTexto base: "${selectedText}"`;
          break;
        default:
          prompt = customPrompt || "";
      }

      const response = await aiClient.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          systemInstruction
        }
      });

      const result = response.text;
      
      if (result) {
        // Double check selection before modifications
        if (selection && typeof selection.index === 'number' && typeof selection.length === 'number' && selection.length > 0) {
          quill.deleteText(selection.index, selection.length);
          quill.insertText(selection.index, result);
        } else {
          setContent(prev => prev + `<p><br></p><p><strong>Sugestão da IA:</strong></p><p>${result.replace(/\n/g, '</p><p>')}</p>`);
        }
        showNotification('IA: Processamento concluído com sucesso!', 'success');
      }
    } catch (error) {
      console.error('AI Error:', error);
      showNotification('Erro ao processar com IA. Verifique sua conexão.', 'error');
    } finally {
      setIsAiGenerating(false);
      setIsProcessing(null);
      setShowAIModal(false);
      setAiPrompt('');
    }
  };

  const templates = [
    {
      id: 'announcement',
      name: 'Anúncio de Visita',
      content: '<h2>ANÚNCIO À CONGREGAÇÃO</h2><p>Temos o prazer de anunciar que o superintendente de circuito, <strong>[Nome]</strong>, visitará nossa congregação na semana de <strong>[Data]</strong> a <strong>[Data]</strong>.</p><p>Convidamos todos a apoiarem as reuniões para o serviço de campo durante essa semana especial de atividade espiritual.</p>'
    },
    {
      id: 'invitation',
      name: 'Convite para Reunião Especial',
      content: '<h1>CONVITE ESPECIAL</h1><p>Convidamos todos os irmãos e pessoas interessadas para a reunião especial que será realizada no <strong>[Local]</strong> em <strong>[Data]</strong> às <strong>[Horário]</strong>.</p><p>O tema do discurso público será: <strong>"[Tema]"</strong>.</p>'
    },
    {
      id: 'report',
      name: 'Relatório Trimestral',
      content: '<h2>RELATÓRIO DE ATIVIDADES</h2><p><strong>Circuito:</strong> [Número]<br><strong>Período:</strong> [Mês/Ano]</p><p>Resumo das atividades realizadas no último trimestre conforme as orientações recebidas.</p><ul><li>Reuniões com anciãos: [Total]</li><li>Escolas realizadas: [Lista]</li><li>Destaques espirituais: [Texto]</li></ul>'
    }
  ];

  const applyTemplate = (templateContent: string) => {
    setContent(templateContent);
    setShowTemplates(false);
    showNotification('Template aplicado com sucesso!', 'success');
  };

  const handleClearAll = async () => {
    setIsProcessing('clear');
    try {
      setContent('');
      localStorage.removeItem('progcir_wordpad_content');
      setShowClearConfirm(false);
      showNotification('Documento limpo com sucesso', 'success');
    } catch (error) {
      showNotification('Erro ao limpar documento', 'error');
    } finally {
      setIsProcessing(null);
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      showNotification('O título não pode estar vazio', 'error');
      return;
    }
    
    setIsSaving(true);
    setIsProcessing('save');
    
    try {
      // Always save to localStorage as backup
      localStorage.setItem('progcir_wordpad_content', content);
      localStorage.setItem('progcir_wordpad_title', title);

      // If we have a userId, save to Firebase
      if (userId) {
        const docName = title.toLowerCase().replace(/[^a-z0-9]/g, '_');
        const docRef = doc(db, 'documents', `${userId}_${docName}`);
        await setDoc(docRef, {
          title,
          content,
          userId,
          updatedAt: new Date().toISOString(),
          wordCount,
          charCount
        });
      } else {
        // Simulate progress for local save
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      showNotification('Documento salvo com sucesso', 'success');
    } catch (error) {
      console.error('Save error:', error);
      showNotification('Erro ao salvar documento no servidor', 'error');
    } finally {
      setIsSaving(false);
      setIsProcessing(null);
    }
  };
  const [zoom, setZoom] = useState(100);
  const [showSearch, setShowSearch] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [replaceTerm, setReplaceTerm] = useState('');
  const [currentMatchIndex, setCurrentMatchIndex] = useState(-1);
  const [matches, setMatches] = useState<number[]>([]);
  const quillRef = useRef<any>(null);

  // Search logic
  useEffect(() => {
    if (!searchTerm || !quillRef.current) {
      setMatches([]);
      setCurrentMatchIndex(-1);
      return;
    }

    const quill = quillRef.current?.getEditor();
    if (!quill) return;
    const text = quill.getText();
    const newMatches: number[] = [];
    let index = text.toLowerCase().indexOf(searchTerm.toLowerCase());
    
    while (index !== -1) {
      newMatches.push(index);
      index = text.toLowerCase().indexOf(searchTerm.toLowerCase(), index + 1);
    }
    
    setMatches(newMatches);
    if (newMatches.length > 0) {
      setCurrentMatchIndex(0);
      if (typeof newMatches[0] === 'number') {
        quill.setSelection(newMatches[0], searchTerm.length);
      }
    } else {
      setCurrentMatchIndex(-1);
    }
  }, [searchTerm]);

  const handleNextMatch = () => {
    if (matches.length === 0 || !quillRef.current) return;
    const nextIndex = (currentMatchIndex + 1) % matches.length;
    setCurrentMatchIndex(nextIndex);
    const quill = quillRef.current.getEditor();
    if (quill && typeof matches[nextIndex] === 'number') {
      quill.setSelection(matches[nextIndex], searchTerm.length);
    }
  };

  const handleReplace = () => {
    if (currentMatchIndex === -1 || !quillRef.current) return;
    const quill = quillRef.current.getEditor();
    quill.deleteText(matches[currentMatchIndex], searchTerm.length);
    quill.insertText(matches[currentMatchIndex], replaceTerm);
    // Refresh matches
    const text = quill.getText();
    const newMatches: number[] = [];
    let index = text.toLowerCase().indexOf(searchTerm.toLowerCase());
    while (index !== -1) {
      newMatches.push(index);
      index = text.toLowerCase().indexOf(searchTerm.toLowerCase(), index + 1);
    }
    setMatches(newMatches);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        handlePrint();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setShowSearch(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [content, title, showSearch]); // Dependencies for handlers

  // Load from localStorage on mount
  useEffect(() => {
    const savedContent = localStorage.getItem('progcir_wordpad_content');
    const savedTitle = localStorage.getItem('progcir_wordpad_title');
    if (savedContent) setContent(savedContent);
    if (savedTitle) setTitle(savedTitle);
  }, []);

  // Auto-save to localStorage
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      localStorage.setItem('progcir_wordpad_content', content);
      localStorage.setItem('progcir_wordpad_title', title);
      setIsSaving(true);
      setTimeout(() => setIsSaving(false), 2000);
    }, 1000);
    return () => clearTimeout(timeoutId);
  }, [content, title]);

  const handleUndo = () => {
    const quill = quillRef.current?.getEditor();
    if (quill) quill.history.undo();
  };

  const handleRedo = () => {
    const quill = quillRef.current?.getEditor();
    if (quill) quill.history.redo();
  };

  // Memoize modules and formats to prevent unnecessary re-renders of ReactQuill
  const modules = useMemo(() => ({
    toolbar: {
      container: "#wordpad-toolbar-v2",
    },
    history: {
      delay: 2000,
      maxStack: 500,
      userOnly: true
    }
  }), []);

  const formats = useMemo(() => [
    'font', 'size',
    'bold', 'italic', 'underline', 'strike',
    'color', 'background',
    'script',
    'header', 'blockquote', 'code-block',
    'list', 'indent',
    'direction', 'align',
    'link', 'image', 'video'
  ], []);

  const getWordCount = (str: string) => {
    return str.split(/\s+/).filter(word => word.length > 0).length;
  };

  const getCharCount = (str: string) => {
    return str.length;
  };

  const stripHtml = (html: string) => {
    const tmp = document.createElement("DIV");
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || "";
  };

  const plainText = stripHtml(content);
  const wordCount = getWordCount(plainText);
  const charCount = getCharCount(plainText);

  const handlePrint = async () => {
    if (!content || content === '<p><br></p>') {
      showNotification('O documento está vazio', 'info');
      return;
    }

    setIsProcessing('print');
    try {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head>
              <title>${title}</title>
              <style>
                @page { size: A4; margin: 20mm; }
                body { 
                  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
                  line-height: 1.6;
                  color: #333;
                  max-width: 800px;
                  margin: 0 auto;
                }
                h1.doc-title { 
                  text-align: center; 
                  color: #1a1a1a; 
                  border-bottom: 2px solid #eee;
                  padding-bottom: 10px;
                  margin-bottom: 30px;
                  font-size: 24pt;
                }
                .content { font-size: 11pt; }
                .ql-align-center { text-align: center; }
                .ql-align-right { text-align: right; }
                .ql-align-justify { text-align: justify; }
                img { max-width: 100%; height: auto; }
                .footer {
                  margin-top: 50px;
                  border-top: 1px solid #eee;
                  padding-top: 10px;
                  font-size: 8pt;
                  color: #999;
                  text-align: center;
                }
              </style>
            </head>
            <body>
              <h1 class="doc-title">${title}</h1>
              <div class="content">${content}</div>
              <div class="footer">
                Documento gerado pelo WordPad ProgCir Web em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}
              </div>
            </body>
          </html>
        `);
        printWindow.document.close();
        printWindow.print();
        showNotification('Impressão iniciada', 'success');
      }
    } catch (error) {
      showNotification('Erro ao preparar impressão', 'error');
    } finally {
      setIsProcessing(null);
    }
  };

  const handleDownload = async () => {
    if (!content || content === '<p><br></p>') {
      showNotification('O documento está vazio', 'info');
      return;
    }

    setIsProcessing('download');
    try {
      const element = document.createElement("a");
      const file = new Blob([content], {type: 'text/html'});
      element.href = URL.createObjectURL(file);
      element.download = `${title}.html`;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
      showNotification('Backup HTML concluído', 'success');
    } catch (error) {
      showNotification('Erro ao realizar backup', 'error');
    } finally {
      setIsProcessing(null);
    }
  };

  const handleExportPDF = async () => {
    if (!content || content === '<p><br></p>') {
      showNotification('O documento está vazio', 'info');
      return;
    }
    
    setIsProcessing('export_pdf');
    try {
      const doc = new jsPDF({
        unit: 'mm',
        format: 'a4',
      });

      // Simple implementation of HTML to PDF
      const titleText = title.toUpperCase();
      doc.setFontSize(22);
      doc.text(titleText, 105, 20, { align: 'center' });
      
      doc.setFontSize(11);
      const margin = 20;
      const width = 170;
      
      // We use a simplified text extraction for PDF to avoid layout issues in this demo
      const text = plainText;
      const splitText = doc.splitTextToSize(text, width);
      doc.text(splitText, margin, 40);
      
      doc.save(`${title}.pdf`);
      showNotification('PDF exportado com sucesso', 'success');
    } catch (error) {
      console.error(error);
      showNotification('Erro ao exportar PDF', 'error');
    } finally {
      setIsProcessing(null);
    }
  };

  const handleExportDocx = async () => {
    if (!content || content === '<p><br></p>') {
      showNotification('O documento está vazio', 'info');
      return;
    }

    setIsProcessing('export_docx');
    try {
      const response = await fetch('/api/export-docx', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ html: content, title }),
      });

      if (!response.ok) throw new Error('Falha na geração do arquivo');

      const contentBlob = await response.blob();
      
      const downloadLink = document.createElement('a');
      downloadLink.href = URL.createObjectURL(contentBlob);
      downloadLink.download = `${title}.docx`;
      downloadLink.click();
      showNotification('Word (DOCX) exportado com sucesso', 'success');
    } catch (error) {
      console.error(error);
      showNotification('Erro ao exportar Word. Tente novamente.', 'error');
    } finally {
      setIsProcessing(null);
    }
  };

  const readingTime = Math.ceil(wordCount / 200); // Average 200 words per minute

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] -m-4 md:-m-8 bg-[#f8f9fa]">
      {/* Notification Toast */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
            className={`fixed bottom-20 left-1/2 -translate-x-1/2 z-[3000] px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border backdrop-blur-md ${
              notification.type === 'success' ? 'bg-green-500/90 border-green-400 text-white' :
              notification.type === 'error' ? 'bg-red-500/90 border-red-400 text-white' :
              notification.type === 'ai' ? 'bg-indigo-600/90 border-indigo-400 text-white' :
              'bg-blue-500/90 border-blue-400 text-white'
            }`}
          >
            {notification.type === 'success' && <CheckCircle2 size={18} />}
            {notification.type === 'error' && <AlertCircle size={18} />}
            {notification.type === 'ai' && <Sparkles size={18} className="animate-pulse" />}
            {notification.type === 'info' && <Loader2 size={18} className="animate-spin" />}
            <span className="text-sm font-bold tracking-wide">{notification.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* WordPad Unified Ribbon Panel */}
      <div className="bg-[#f3f2f1] border-b border-gray-300 flex flex-col shadow-sm z-10 select-none">
        {/* Top Row: Navigation & Title */}
        <div className="px-4 py-1.5 flex items-center justify-between border-b border-gray-200 bg-white">
          <div className="flex items-center gap-3">
            <button 
              onClick={onBack}
              className="p-1.5 hover:bg-gray-100 rounded-md transition-colors text-gray-600"
              title="Voltar"
              aria-label="Voltar para a lista de documentos"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="flex items-center gap-2">
              <div className="bg-blue-600 p-1 rounded" aria-hidden="true">
                <FileText size={14} className="text-white" />
              </div>
              <input 
                type="text" 
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="text-sm font-semibold text-gray-700 bg-transparent border-none focus:ring-0 px-1 py-0 w-64 transition-all"
                placeholder="Documento Sem Título"
                aria-label="Título do documento"
              />
              <AnimatePresence>
                {isSaving && (
                  <motion.span 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-[10px] text-green-600 font-bold bg-green-50 px-2 py-0.5 rounded-full border border-green-100 flex items-center gap-1"
                  >
                    <CheckCircle2 size={10} />
                    SALVO
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-[10px] text-gray-400 font-bold tracking-widest uppercase hidden md:block">
              WordPad Profissional
            </div>
            <div className="flex items-center gap-2">
              <button className="p-1.5 hover:bg-gray-100 rounded text-gray-500"><Maximize2 size={14} /></button>
            </div>
          </div>
        </div>

        {/* Menu Bar Row */}
        <div className="flex items-center px-4 py-0.5 bg-white border-b border-gray-200 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-1 group relative">
            <button 
              className="px-3 py-1 text-[12px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded transition-colors flex items-center gap-1.5"
              onClick={() => setShowAIModal(true)}
            >
              <Sparkles size={14} className="text-blue-600" />
              Assistente IA
            </button>
          </div>
          <div className="w-[1px] h-4 bg-gray-200 mx-2"></div>
          <div className="flex items-center group relative">
            <button 
              className="px-3 py-1 text-[12px] text-gray-700 hover:bg-gray-100 rounded transition-colors flex items-center gap-1.5"
              onClick={() => setShowTemplates(!showTemplates)}
            >
              <Layout size={14} />
              Templates
              <ChevronDown size={12} />
            </button>
            <AnimatePresence>
              {showTemplates && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-xl shadow-xl z-50 p-2"
                >
                  <div className="text-[10px] font-bold text-gray-400 p-2 uppercase tracking-widest">Modelos Disponíveis</div>
                  {templates.map(t => (
                    <button
                      key={t.id}
                      onClick={() => applyTemplate(t.content)}
                      className="w-full text-left px-3 py-2 hover:bg-blue-50 rounded-lg text-xs transition-colors flex flex-col gap-0.5"
                    >
                      <span className="font-bold text-gray-800">{t.name}</span>
                      <span className="text-[10px] text-gray-500">Clique para aplicar este modelo</span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          {['Edit', 'View', 'Insert', 'Format', 'Tools', 'Table'].map((menu) => (
            <button 
              key={menu}
              className="px-3 py-1 text-[12px] text-gray-700 hover:bg-gray-100 rounded transition-colors"
            >
              {menu}
            </button>
          ))}
        </div>
                {/* Ribbon Toolbar Row */}
        <div className="flex items-center bg-[#f3f2f1] px-2 py-1 overflow-visible gap-1 relative z-20">
          <div id="wordpad-toolbar-v2" className="flex items-center gap-1">
            {/* Group: Ações (Merge Undo/Redo/Save/Print) */}
            <div className="flex items-center gap-0.5 border-r border-gray-300 pr-1 mr-1">
              <button 
                type="button" 
                onClick={handleSave} 
                disabled={isProcessing === 'save'}
                className="p-1.5 hover:bg-gray-200 rounded transition-all text-blue-600"
                title="Salvar (Ctrl+S)"
              >
                {isProcessing === 'save' ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              </button>
              <button 
                type="button" 
                onClick={handlePrint} 
                className="p-1.5 hover:bg-gray-200 rounded transition-all text-gray-600"
                title="Imprimir (Ctrl+P)"
              >
                <Printer size={16} />
              </button>
              <div className="w-[1px] h-4 bg-gray-200 mx-1"></div>
              <button 
                type="button" 
                onClick={handleUndo} 
                className="p-1.5 hover:bg-gray-200 rounded transition-all text-gray-600"
                title="Desfazer (Ctrl+Z)"
              >
                <Undo2 size={16} />
              </button>
              <button 
                type="button" 
                onClick={handleRedo} 
                className="p-1.5 hover:bg-gray-200 rounded transition-all text-gray-600"
                title="Refazer (Ctrl+Y)"
              >
                <Redo2 size={16} />
              </button>
            </div>

            {/* Group: Fonte */}
            <div className="flex items-center gap-1 border-r border-gray-300 pr-1 mr-1">
              <select className="ql-font border-none" defaultValue="arial" aria-label="Fonte">
                <option value="arial">Arial</option>
                <option value="courier-new">Courier New</option>
                <option value="georgia">Georgia</option>
                <option value="lucida">Lucida Sans</option>
                <option value="tahoma">Tahoma</option>
                <option value="times-new-roman">Times New Roman</option>
                <option value="trebuchet">Trebuchet MS</option>
                <option value="verdana">Verdana</option>
              </select>
              <select className="ql-size border-none" defaultValue="" aria-label="Tamanho">
                <option value="small">Small</option>
                <option value="">Normal</option>
                <option value="large">Large</option>
                <option value="huge">Huge</option>
              </select>
            </div>

            {/* Group: Estilo */}
            <div className="flex items-center gap-0.5 border-r border-gray-300 pr-1 mr-1">
              <button type="button" className="ql-bold" title="Negrito"></button>
              <button type="button" className="ql-italic" title="Itálico"></button>
              <button type="button" className="ql-underline" title="Sublinhado"></button>
              <button type="button" className="ql-strike" title="Tachado"></button>
              <div className="w-[1px] h-4 bg-gray-200 mx-0.5" aria-hidden="true"></div>
              <select className="ql-color" title="Cor"></select>
              <select className="ql-background" title="Fundo"></select>
            </div>

            {/* Group: Parágrafo */}
            <div className="flex items-center gap-0.5 border-r border-gray-300 pr-1 mr-1">
              <button type="button" className="ql-list" value="ordered" title="Lista Numerada"></button>
              <button type="button" className="ql-list" value="bullet" title="Lista com Marcadores"></button>
              <button type="button" className="ql-align" value="" title="Esquerda"></button>
              <button type="button" className="ql-align" value="center" title="Centralizado"></button>
              <button type="button" className="ql-align" value="right" title="Direita"></button>
              <button type="button" className="ql-align" value="justify" title="Justificado"></button>
            </div>

            {/* Group: Inserir */}
            <div className="flex items-center gap-0.5 border-r border-gray-300 pr-1 mr-1">
              <button type="button" className="ql-link" title="Link"></button>
              <button type="button" className="ql-image" title="Imagem"></button>
              <button type="button" className="ql-video" title="Vídeo"></button>
            </div>
          </div>

          {/* Group: Ferramentas (Custom Buttons - NOT in Quill Toolbar) */}
          <div className="flex items-center gap-0.5 border-l border-gray-300 pl-1 ml-1">
            <button 
              type="button"
              onClick={() => setShowSearch(!showSearch)}
              className={`p-1.5 rounded transition-all ${showSearch ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-200 text-gray-600'}`}
              title="Buscar e Substituir (Ctrl+F)"
              aria-label="Buscar e substituir"
              aria-expanded={showSearch}
            >
              <Search size={16} />
            </button>
            
            {/* Export Dropdown */}
            <div className="relative group">
              <button 
                type="button"
                className="p-1.5 rounded text-gray-600 hover:bg-gray-200 transition-all flex items-center gap-1"
                title="Exportar Documento"
              >
                <Download size={16} />
                <ChevronDown size={12} />
              </button>
              <div className="absolute top-full right-0 mt-1 hidden group-hover:block w-48 bg-white border border-gray-200 rounded-xl shadow-xl z-50 p-1">
                <button 
                  onClick={handleExportPDF}
                  disabled={isProcessing === 'export_pdf'}
                  className="w-full text-left px-3 py-2 hover:bg-red-50 rounded-lg text-xs transition-colors flex items-center gap-2"
                >
                  <FileText size={14} className="text-red-600" />
                  Exportar PDF (A4)
                </button>
                <button 
                  onClick={handleExportDocx}
                  disabled={isProcessing === 'export_docx'}
                  className="w-full text-left px-3 py-2 hover:bg-blue-50 rounded-lg text-xs transition-colors flex items-center gap-2"
                >
                  <Monitor size={14} className="text-blue-600" />
                  Exportar Word (DOCX)
                </button>
                <button 
                  onClick={handleDownload}
                  className="w-full text-left px-3 py-2 hover:bg-gray-100 rounded-lg text-xs transition-colors flex items-center gap-2 border-t border-gray-100 mt-1"
                >
                  <Code size={14} className="text-gray-500" />
                  Backup HTML
                </button>
              </div>
            </div>

            <button 
              type="button"
              onClick={() => setShowClearConfirm(true)}
              className="p-1.5 hover:bg-red-50 text-red-600 rounded transition-all"
              title="Limpar Tudo"
              aria-label="Limpar todo o conteúdo"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <AnimatePresence>
        {showSearch && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-white border-b border-gray-200 px-10 py-3 flex flex-col gap-2 shadow-inner overflow-hidden"
          >
            <div className="flex items-center gap-4">
              <div className="relative flex-1 max-w-md">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input 
                  type="text" 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Localizar no documento..."
                  className="w-full pl-9 pr-4 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all"
                  autoFocus
                />
              </div>
              <div className="flex items-center gap-2">
                <button 
                  type="button"
                  onClick={handleNextMatch}
                  disabled={matches.length === 0}
                  className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 rounded-lg text-[10px] font-bold text-gray-600 transition-all"
                  aria-label="Localizar próxima ocorrência"
                >
                  PRÓXIMO ({matches.length > 0 ? currentMatchIndex + 1 : 0}/{matches.length})
                </button>
                <button 
                  type="button"
                  onClick={() => setShowSearch(false)}
                  className="text-[10px] font-bold text-gray-400 hover:text-gray-600 uppercase tracking-widest ml-4"
                  aria-label="Fechar busca"
                >
                  Fechar
                </button>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="relative flex-1 max-w-md">
                <Type size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input 
                  type="text" 
                  value={replaceTerm}
                  onChange={(e) => setReplaceTerm(e.target.value)}
                  placeholder="Substituir por..."
                  className="w-full pl-9 pr-4 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all"
                />
              </div>
              <button 
                type="button"
                onClick={handleReplace}
                disabled={currentMatchIndex === -1}
                className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 disabled:opacity-50 text-blue-600 rounded-lg text-[10px] font-bold transition-all"
                aria-label="Substituir ocorrência atual"
              >
                SUBSTITUIR
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Editor Workspace */}
      <div className="flex-1 bg-[#e6e6e6] overflow-y-auto custom-scrollbar p-4 md:p-8 flex flex-col items-center relative">
        <AnimatePresence>
          {showAIModal && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-0 z-[4000] flex items-center justify-center p-4"
            >
              <div 
                className="absolute inset-0 bg-black/40 backdrop-blur-sm" 
                onClick={() => !isAiGenerating && setShowAIModal(false)}
              />
              <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col border border-indigo-100">
                <div className="bg-gradient-to-r from-indigo-600 to-blue-600 p-6 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-md">
                      <Sparkles className="text-white" size={20} />
                    </div>
                    <div>
                      <h3 className="font-black text-white uppercase tracking-wider text-sm">Assistente de Redação IA</h3>
                      <p className="text-indigo-100 text-[10px] font-medium opacity-80 uppercase tracking-[0.2em]">Melhore seu texto com Gemini 3.0</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setShowAIModal(false)}
                    className="p-2 hover:bg-white/10 rounded-full transition-colors text-white"
                  >
                    <ChevronDown size={20} />
                  </button>
                </div>

                <div className="p-6 space-y-6">
                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      onClick={() => handleAIAssist('fix')}
                      className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-gray-50 hover:bg-indigo-50 border border-gray-100 hover:border-indigo-200 transition-all group"
                    >
                      <Zap className="text-amber-500 group-hover:scale-110 transition-transform" />
                      <span className="text-xs font-bold text-gray-700">Corrigir Gramática</span>
                    </button>
                    <button 
                      onClick={() => handleAIAssist('formal')}
                      className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-gray-50 hover:bg-indigo-50 border border-gray-100 hover:border-indigo-200 transition-all group"
                    >
                      <CheckCircle2 className="text-blue-500 group-hover:scale-110 transition-transform" />
                      <span className="text-xs font-bold text-gray-700">Tom Formal</span>
                    </button>
                    <button 
                      onClick={() => handleAIAssist('summarize')}
                      className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-gray-50 hover:bg-indigo-50 border border-gray-100 hover:border-indigo-200 transition-all group"
                    >
                      <Layout className="text-indigo-500 group-hover:scale-110 transition-transform" />
                      <span className="text-xs font-bold text-gray-700">Resumir Texto</span>
                    </button>
                    <button 
                      onClick={() => handleAIAssist('expand')}
                      className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-gray-50 hover:bg-indigo-50 border border-gray-100 hover:border-indigo-200 transition-all group"
                    >
                      <Wand2 className="text-purple-500 group-hover:scale-110 transition-transform" />
                      <span className="text-xs font-bold text-gray-700">Expandir Pontos</span>
                    </button>
                  </div>

                  <div className="pt-4 border-t border-gray-100">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Comando Personalizado</label>
                    <div className="relative">
                      <textarea
                        value={aiPrompt}
                        onChange={(e) => setAiPrompt(e.target.value)}
                        placeholder="Ex: 'Traduza para espanhol' ou 'Transforme em lista de tópicos'..."
                        className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none min-h-[100px] resize-none"
                      />
                      <button 
                        onClick={() => handleAIAssist('custom', aiPrompt)}
                        disabled={!aiPrompt.trim() || isAiGenerating}
                        className="absolute bottom-4 right-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white p-2.5 rounded-xl shadow-lg transition-all"
                      >
                        {isAiGenerating ? <Loader2 size={20} className="animate-spin" /> : <ChevronLeft className="rotate-180" size={20} />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0, scale: zoom / 100 }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="w-full max-w-[816px] bg-white shadow-[0_0_50px_rgba(0,0,0,0.1)] min-h-[1056px] flex flex-col origin-top mb-20 border border-gray-200"
          style={{ 
            width: '210mm', 
            minHeight: '297mm',
            padding: '20mm'
          }}
        >
          <div className="wordpad-editor flex-1 h-full">
            <ReactQuill 
              forwardedRef={quillRef}
              theme="snow" 
              value={content} 
              onChange={setContent}
              modules={modules}
              formats={formats}
              className="h-full"
              placeholder="Comece a digitar seu documento profissional..."
            />
          </div>
        </motion.div>
      </div>

      {/* WordPad Status Bar */}
      <div className="bg-[#f3f2f1] border-t border-gray-300 px-4 py-1 flex items-center justify-between text-[11px] text-gray-600 select-none">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <span className="font-medium">p</span>
            <span className="text-gray-400">›</span>
            <span className="font-medium">em</span>
          </div>
          <div className="w-[1px] h-3 bg-gray-300"></div>
          <div className="flex items-center gap-1">
            <span className="font-bold text-blue-700">{wordCount}</span>
            <span className="text-gray-500">palavras</span>
          </div>
          <div className="w-[1px] h-3 bg-gray-300"></div>
          <div className="flex items-center gap-1">
            <span className="font-bold text-blue-700">{charCount}</span>
            <span className="text-gray-500">caracteres</span>
          </div>
          <div className="w-[1px] h-3 bg-gray-300"></div>
          <div className="flex items-center gap-1">
            <span className="font-bold text-indigo-600">{readingTime}</span>
            <span className="text-gray-500">min. de leitura</span>
          </div>
          <div className="w-[1px] h-3 bg-gray-300"></div>
          <div className="flex items-center gap-1 text-[10px] text-gray-400">
            <Clock size={12} />
            <span>Editado em {new Date().toLocaleTimeString()}</span>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-white border border-gray-300 px-2 py-0.5 rounded shadow-sm">
            <button 
              type="button" 
              onClick={() => setZoom(Math.max(50, zoom - 10))} 
              className="hover:text-blue-600 transition-colors"
              aria-label="Diminuir zoom"
            >
              <Minimize2 size={12} />
            </button>
            <span className="min-w-[40px] text-center font-bold" aria-live="polite">{zoom}%</span>
            <button 
              type="button" 
              onClick={() => setZoom(Math.min(150, zoom + 10))} 
              className="hover:text-blue-600 transition-colors"
              aria-label="Aumentar zoom"
            >
              <Maximize2 size={12} />
            </button>
          </div>
          <div className="flex items-center gap-1 text-gray-400">
            <Monitor size={12} />
            <span className="text-[9px] font-bold uppercase">Ready</span>
          </div>
        </div>
      </div>

      {/* Processing Loader Modal */}
      <AnimatePresence>
        {isProcessing && isProcessing !== 'ai' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[5000] flex items-center justify-center bg-white/60 backdrop-blur-[2px]"
          >
            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
              <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Processando...</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Templates Modal */}
      <AnimatePresence>
        {showTemplates && (
          <div className="fixed inset-0 z-[4000] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[80vh]"
            >
              <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                  <FileText className="text-blue-600" />
                  Templates Recomendados
                </h3>
                <button onClick={() => setShowTemplates(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                  <ChevronDown size={24} />
                </button>
              </div>
              <div className="p-6 overflow-y-auto custom-scrollbar grid grid-cols-1 md:grid-cols-2 gap-4">
                {templates.map(template => (
                  <button
                    key={template.id}
                    onClick={() => applyTemplate(template.content)}
                    className="p-4 border border-gray-100 rounded-2xl hover:border-blue-300 hover:bg-blue-50 transition-all text-left flex flex-col gap-2 group"
                  >
                    <span className="font-bold text-gray-800 group-hover:text-blue-700">{template.name}</span>
                    <div className="text-[10px] text-gray-400 line-clamp-3 overflow-hidden" dangerouslySetInnerHTML={{ __html: template.content }} />
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* History Modal */}
      <AnimatePresence>
        {showHistory && (
          <div className="fixed inset-0 z-[4000] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[80vh]"
            >
              <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                  <Clock className="text-indigo-600" />
                  Histórico Local
                </h3>
                <button onClick={() => setShowHistory(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                  <ChevronDown size={24} />
                </button>
              </div>
              <div className="p-6 overflow-y-auto custom-scrollbar space-y-3">
                {history.length === 0 ? (
                  <div className="text-center py-10 text-gray-400 italic">Nenhum histórico detectado neste dispositivo.</div>
                ) : (
                  history.map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => { setContent(item.content); setShowHistory(false); }}
                      className="w-full p-4 border border-gray-100 rounded-2xl hover:border-indigo-300 hover:bg-indigo-50 transition-all text-left flex justify-between items-center group"
                    >
                      <div>
                        <div className="font-bold text-gray-800 group-hover:text-indigo-700">{item.title}</div>
                        <div className="text-[10px] text-gray-400">{item.date}</div>
                      </div>
                      <ChevronLeft className="rotate-180 text-gray-300 group-hover:text-indigo-400 transition-colors" size={20} />
                    </button>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style dangerouslySetInnerHTML={{ __html: `
        .wordpad-editor .ql-toolbar.ql-snow {
          border: none;
          padding: 0;
          background: transparent;
          display: none; /* We use our custom toolbar */
        }
        .wordpad-editor .ql-container.ql-snow {
          border: none !important;
          font-family: 'Segoe UI', system-ui, sans-serif;
          font-size: 14px;
        }
        .wordpad-editor .ql-editor {
          padding: 0 !important;
          min-height: 100%;
          font-family: Arial, sans-serif;
          font-size: 14px;
        }
        
        #wordpad-toolbar-v2 button, #wordpad-toolbar-v2 .ql-picker {
          border: 1px solid transparent !important;
          background: transparent !important;
          padding: 2px !important;
          width: 28px !important;
          height: 28px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          border-radius: 3px !important;
          transition: all 0.1s !important;
          position: relative;
        }
        #wordpad-toolbar-v2 .ql-picker.ql-font {
          width: 130px !important;
        }
        #wordpad-toolbar-v2 .ql-picker.ql-size {
          width: 70px !important;
        }
        #wordpad-toolbar-v2 button:hover, #wordpad-toolbar-v2 .ql-picker:hover {
          background-color: #e2e2e2 !important;
          border-color: #bbb !important;
        }
        #wordpad-toolbar-v2 button.ql-active, #wordpad-toolbar-v2 .ql-picker.ql-expanded {
          background-color: #cde6f7 !important;
          border-color: #2b88d8 !important;
          color: #2b579a !important;
          z-index: 50;
        }
        
        /* Ensure italic button works correctly */
        #wordpad-toolbar-v2 button.ql-italic.ql-active {
          font-style: italic !important;
        }

        /* Aggressively hide original selects to prevent duplication */
        #wordpad-toolbar-v2 select {
          display: none !important;
          visibility: hidden !important;
          opacity: 0 !important;
          position: absolute !important;
          pointer-events: none !important;
        }

        /* Picker Options Z-Index and Positioning */
        .ql-snow .ql-picker-options {
          z-index: 1000 !important;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15) !important;
          border-radius: 4px !important;
          border: 1px solid #ccc !important;
          background-color: white !important;
        }

        .wordpad-editor .ql-snow .ql-stroke {
          stroke: #444;
          stroke-width: 1.5px;
        }
        .wordpad-editor .ql-snow .ql-fill {
          fill: #444;
        }
        
        /* Picker Styling */
        .wordpad-editor .ql-snow .ql-picker {
          color: #444;
          font-weight: 500;
          font-size: 12px;
          width: auto !important;
        }
        .wordpad-editor .ql-snow .ql-picker-label {
          border: 1px solid #ccc !important;
          background: white !important;
          padding: 0 6px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
          height: 26px !important;
          border-radius: 3px !important;
        }
        .wordpad-editor .ql-snow .ql-picker-label:hover {
          border-color: #2b88d8 !important;
          background-color: #f8fbff !important;
        }
        
        /* Custom Font Sizes */
        .ql-snow .ql-picker.ql-size .ql-picker-label::before,
        .ql-snow .ql-picker.ql-size .ql-picker-item::before {
          content: '11pt';
        }
        .ql-snow .ql-picker.ql-size .ql-picker-label[data-value=small]::before,
        .ql-snow .ql-picker.ql-size .ql-picker-item[data-value=small]::before {
          content: '11pt';
        }
        .ql-snow .ql-picker.ql-size .ql-picker-label[data-value=large]::before,
        .ql-snow .ql-picker.ql-size .ql-picker-item[data-value=large]::before {
          content: '14pt';
        }
        .ql-snow .ql-picker.ql-size .ql-picker-label[data-value=huge]::before,
        .ql-snow .ql-picker.ql-size .ql-picker-item[data-value=huge]::before {
          content: '18pt';
        }
        
        .ql-size-small { font-size: 11pt; }
        .ql-size-large { font-size: 14pt; }
        .ql-size-huge { font-size: 18pt; }

        /* Custom Fonts */
        .ql-font-arial { font-family: Arial, sans-serif; }
        .ql-font-courier-new { font-family: 'Courier New', Courier, monospace; }
        .ql-font-georgia { font-family: Georgia, serif; }
        .ql-font-lucida { font-family: 'Lucida Sans Unicode', 'Lucida Grande', sans-serif; }
        .ql-font-tahoma { font-family: Tahoma, Geneva, sans-serif; }
        .ql-font-times-new-roman { font-family: 'Times New Roman', Times, serif; }
        .ql-font-trebuchet { font-family: 'Trebuchet MS', Helvetica, sans-serif; }
        .ql-font-verdana { font-family: Verdana, Geneva, sans-serif; }

        /* Font Picker Labels */
        .ql-snow .ql-picker.ql-font .ql-picker-label::before,
        .ql-snow .ql-picker.ql-font .ql-picker-item::before {
          content: 'Arial';
        }
        .ql-snow .ql-picker.ql-font .ql-picker-label[data-value=arial]::before,
        .ql-snow .ql-picker.ql-font .ql-picker-item[data-value=arial]::before {
          content: 'Arial';
          font-family: Arial, sans-serif;
        }
        .ql-snow .ql-picker.ql-font .ql-picker-label[data-value=courier-new]::before,
        .ql-snow .ql-picker.ql-font .ql-picker-item[data-value=courier-new]::before {
          content: 'Courier New';
          font-family: 'Courier New', Courier, monospace;
        }
        .ql-snow .ql-picker.ql-font .ql-picker-label[data-value=georgia]::before,
        .ql-snow .ql-picker.ql-font .ql-picker-item[data-value=georgia]::before {
          content: 'Georgia';
          font-family: Georgia, serif;
        }
        .ql-snow .ql-picker.ql-font .ql-picker-label[data-value=lucida]::before,
        .ql-snow .ql-picker.ql-font .ql-picker-item[data-value=lucida]::before {
          content: 'Lucida Sans';
          font-family: 'Lucida Sans Unicode', sans-serif;
        }
        .ql-snow .ql-picker.ql-font .ql-picker-label[data-value=tahoma]::before,
        .ql-snow .ql-picker.ql-font .ql-picker-item[data-value=tahoma]::before {
          content: 'Tahoma';
          font-family: Tahoma, sans-serif;
        }
        .ql-snow .ql-picker.ql-font .ql-picker-label[data-value=times-new-roman]::before,
        .ql-snow .ql-picker.ql-font .ql-picker-item[data-value=times-new-roman]::before {
          content: 'Times New Roman';
          font-family: 'Times New Roman', Times, serif;
        }
        .ql-snow .ql-picker.ql-font .ql-picker-label[data-value=trebuchet]::before,
        .ql-snow .ql-picker.ql-font .ql-picker-item[data-value=trebuchet]::before {
          content: 'Trebuchet MS';
          font-family: 'Trebuchet MS', sans-serif;
        }
        .ql-snow .ql-picker.ql-font .ql-picker-label[data-value=verdana]::before,
        .ql-snow .ql-picker.ql-font .ql-picker-item[data-value=verdana]::before {
          content: 'Verdana';
          font-family: Verdana, sans-serif;
        }

        /* Document Page Styling */
        .wordpad-editor .ql-editor h1 { font-size: 2em; font-weight: bold; margin-bottom: 0.5em; }
        .wordpad-editor .ql-editor h2 { font-size: 1.5em; font-weight: bold; margin-bottom: 0.5em; }
        .wordpad-editor .ql-editor p { margin-bottom: 1em; }
        .wordpad-editor .ql-editor ul, .wordpad-editor .ql-editor ol { padding-left: 1.5em; margin-bottom: 1em; }
        .wordpad-editor .ql-editor li { margin-bottom: 0.25em; }
        
        .ql-align-center { text-align: center; }
        .ql-align-right { text-align: right; }
        .ql-align-justify { text-align: justify; }

        /* Scrollbar for Editor */
        .custom-scrollbar::-webkit-scrollbar {
          width: 12px;
          height: 12px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f1f1;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #c1c1c1;
          border: 3px solid #f1f1f1;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #a8a8a8;
        }
      `}} />
      {/* Clear Confirmation Modal */}
      <AnimatePresence>
        {showClearConfirm && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden"
            >
              <div className="p-8 text-center space-y-4">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto text-red-600">
                  <Trash2 size={32} />
                </div>
                <h3 className="text-xl font-bold text-gray-800">Limpar Documento</h3>
                <p className="text-gray-600">Deseja realmente limpar todo o conteúdo? Esta ação não pode ser desfeita.</p>
              </div>
              <div className="flex border-t border-gray-100">
                <button 
                  onClick={() => setShowClearConfirm(false)}
                  className="flex-1 px-6 py-4 text-gray-500 font-bold hover:bg-gray-50 transition-colors border-r border-gray-100"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleClearAll}
                  className="flex-1 px-6 py-4 text-red-600 font-bold hover:bg-red-50 transition-colors"
                >
                  Limpar Tudo
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
