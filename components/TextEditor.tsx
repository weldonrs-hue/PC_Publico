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
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import 'react-quill-new/dist/quill.snow.css';

const ReactQuill = dynamic(() => import('react-quill-new'), { 
  ssr: false,
  loading: () => <div className="h-[500px] w-full bg-gray-50 animate-pulse rounded-xl flex items-center justify-center text-gray-400">Carregando Editor...</div>
});

interface TextEditorProps {
  onBack: () => void;
}

export default function TextEditor({ onBack }: TextEditorProps) {
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('Documento Sem Título');
  const [isSaving, setIsSaving] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);

  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
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
      // Simulate async saving
      await new Promise(resolve => setTimeout(resolve, 800));
      localStorage.setItem('progcir_wordpad_content', content);
      localStorage.setItem('progcir_wordpad_title', title);
      showNotification('Documento salvo com sucesso', 'success');
    } catch (error) {
      showNotification('Erro ao salvar documento', 'error');
    } finally {
      setIsSaving(false);
      setIsProcessing(null);
      // Keep the "SALVO" badge for a bit longer if needed, but we have notification now
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

  // Register custom fonts and sizes with Quill
  useEffect(() => {
    const registerQuillBase = async () => {
      if (typeof window !== 'undefined') {
        try {
          // Use the same package as the dynamic import
          const { Quill } = await import('react-quill-new');
          if (Quill) {
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
          }
        } catch (e) {
          console.error('Error registering Quill formats:', e);
        }
      }
    };
    registerQuillBase();
  }, []);

  // Memoize modules and formats to prevent unnecessary re-renders of ReactQuill
  const modules = useMemo(() => ({
    toolbar: {
      container: "#wordpad-toolbar",
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
      showNotification('Download concluído', 'success');
    } catch (error) {
      showNotification('Erro ao realizar download', 'error');
    } finally {
      setIsProcessing(null);
    }
  };

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
              'bg-blue-500/90 border-blue-400 text-white'
            }`}
          >
            {notification.type === 'success' && <CheckCircle2 size={18} />}
            {notification.type === 'error' && <AlertCircle size={18} />}
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
          {['File', 'Edit', 'View', 'Insert', 'Format', 'Tools', 'Table'].map((menu) => (
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
          {/* Group: Ações Rápidas (Custom Buttons - NOT in Quill Toolbar) */}
          <div className="flex items-center gap-0.5 border-r border-gray-300 pr-1 mr-1">
            <button 
              type="button"
              onClick={handleSave} 
              disabled={isProcessing === 'save'}
              className={`p-1.5 rounded transition-all ${isProcessing === 'save' ? 'bg-blue-50' : 'hover:bg-gray-200'}`}
              title="Salvar Agora (Ctrl+S)"
              aria-label="Salvar documento"
            >
              {isProcessing === 'save' ? (
                <Loader2 size={16} className="text-blue-600 animate-spin" />
              ) : (
                <Save size={16} className="text-blue-600" />
              )}
            </button>
            <button 
              type="button" 
              onClick={handlePrint} 
              disabled={isProcessing === 'print'}
              className={`p-1.5 rounded transition-all ${isProcessing === 'print' ? 'bg-gray-100' : 'hover:bg-gray-200'}`}
              title="Imprimir (Ctrl+P)"
              aria-label="Imprimir documento"
            >
              {isProcessing === 'print' ? (
                <Loader2 size={16} className="text-gray-600 animate-spin" />
              ) : (
                <Printer size={16} className="text-gray-600" />
              )}
            </button>
            <button 
              type="button" 
              onClick={handleUndo} 
              className="p-1.5 hover:bg-gray-200 rounded transition-all" 
              title="Desfazer (Ctrl+Z)"
              aria-label="Desfazer última ação"
            >
              <Undo2 size={16} className="text-gray-600" />
            </button>
            <button 
              type="button" 
              onClick={handleRedo} 
              className="p-1.5 hover:bg-gray-200 rounded transition-all" 
              title="Refazer (Ctrl+Y)"
              aria-label="Refazer última ação"
            >
              <Redo2 size={16} className="text-gray-600" />
            </button>
          </div>

          <div id="wordpad-toolbar" className="flex items-center gap-1">
            {/* Group: Fonte */}
            <div className="flex items-center gap-1 border-r border-gray-300 pr-1 mr-1">
              <select className="ql-font" style={{ width: '130px' }} aria-label="Fonte">
                <option value="arial">Arial</option>
                <option value="courier-new">Courier New</option>
                <option value="georgia">Georgia</option>
                <option value="lucida">Lucida Sans</option>
                <option value="tahoma">Tahoma</option>
                <option value="times-new-roman">Times New Roman</option>
                <option value="trebuchet">Trebuchet MS</option>
                <option value="verdana">Verdana</option>
              </select>
              <select className="ql-size" style={{ width: '70px' }} aria-label="Tamanho da fonte" defaultValue="">
                <option value="small">Pequeno</option>
                <option value="">Normal</option>
                <option value="large">Grande</option>
                <option value="huge">Muito Grande</option>
              </select>
              
              <div className="flex items-center gap-0.5 ml-1">
                <button type="button" className="ql-bold" title="Negrito (Ctrl+B)" aria-label="Negrito"></button>
                <button type="button" className="ql-italic" title="Itálico (Ctrl+I)" aria-label="Itálico"></button>
                <button type="button" className="ql-underline" title="Sublinhado (Ctrl+U)" aria-label="Sublinhado"></button>
                <button type="button" className="ql-strike" title="Tachado" aria-label="Tachado"></button>
                <div className="w-[1px] h-4 bg-gray-300 mx-0.5" aria-hidden="true"></div>
                <button type="button" className="ql-script" value="sub" title="Subscrito" aria-label="Subscrito"></button>
                <button type="button" className="ql-script" value="super" title="Sobrescrito" aria-label="Sobrescrito"></button>
                <div className="w-[1px] h-4 bg-gray-300 mx-0.5" aria-hidden="true"></div>
                <select className="ql-color" title="Cor da Fonte" aria-label="Cor da fonte"></select>
                <select className="ql-background" title="Cor de Realce" aria-label="Cor de realce"></select>
                <button type="button" className="ql-clean" title="Limpar Formatação" aria-label="Limpar formatação"></button>
              </div>
            </div>

            {/* Group: Parágrafo */}
            <div className="flex items-center gap-0.5 border-r border-gray-300 pr-1 mr-1">
              <button type="button" className="ql-list" value="ordered" title="Lista Numerada" aria-label="Lista numerada"></button>
              <button type="button" className="ql-list" value="bullet" title="Lista com Marcadores" aria-label="Lista com marcadores"></button>
              <div className="w-[1px] h-4 bg-gray-300 mx-0.5" aria-hidden="true"></div>
              <button type="button" className="ql-indent" value="-1" title="Diminuir Recuo" aria-label="Diminuir recuo"></button>
              <button type="button" className="ql-indent" value="+1" title="Aumentar Recuo" aria-label="Aumentar recuo"></button>
              <div className="w-[1px] h-4 bg-gray-300 mx-0.5" aria-hidden="true"></div>
              <button type="button" className="ql-align" value="" title="Alinhar à Esquerda" aria-label="Alinhar à esquerda"></button>
              <button type="button" className="ql-align" value="center" title="Centralizar" aria-label="Centralizar"></button>
              <button type="button" className="ql-align" value="right" title="Alinhar à Direita" aria-label="Alinhar à direita"></button>
              <button type="button" className="ql-align" value="justify" title="Justificar" aria-label="Justificar"></button>
            </div>

            {/* Group: Inserir */}
            <div className="flex items-center gap-0.5 border-r border-gray-300 pr-1 mr-1">
              <button type="button" className="ql-link" title="Inserir Link" aria-label="Inserir link"></button>
              <button type="button" className="ql-image" title="Inserir Imagem" aria-label="Inserir imagem"></button>
              <button type="button" className="ql-video" title="Inserir Vídeo" aria-label="Inserir vídeo"></button>
              <button type="button" className="ql-code-block" title="Bloco de Código" aria-label="Bloco de código"></button>
            </div>
          </div>

          {/* Group: Ferramentas (Custom Buttons - NOT in Quill Toolbar) */}
          <div className="flex items-center gap-0.5">
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
            <button 
              type="button"
              onClick={handleDownload}
              disabled={isProcessing === 'download'}
              className={`p-1.5 rounded text-gray-600 transition-all ${isProcessing === 'download' ? 'bg-gray-100' : 'hover:bg-gray-200'}`}
              title="Exportar HTML"
              aria-label="Exportar como HTML"
            >
              {isProcessing === 'download' ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Download size={16} />
              )}
            </button>
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
      <div className="flex-1 bg-[#e6e6e6] overflow-y-auto custom-scrollbar p-4 md:p-8 flex flex-col items-center">
        <div className="flex items-center gap-4 mb-4 bg-white/80 backdrop-blur px-4 py-1.5 rounded-full shadow-sm border border-gray-200 text-[10px] font-bold text-gray-500">
          <button 
            type="button" 
            onClick={() => setZoom(Math.max(50, zoom - 10))} 
            className="hover:text-blue-600 transition-colors"
            aria-label="Diminuir zoom"
          >
            <Minimize2 size={12} />
          </button>
          <span aria-live="polite">ZOOM: {zoom}%</span>
          <button 
            type="button" 
            onClick={() => setZoom(Math.min(150, zoom + 10))} 
            className="hover:text-blue-600 transition-colors"
            aria-label="Aumentar zoom"
          >
            <Maximize2 size={12} />
          </button>
          <div className="w-[1px] h-3 bg-gray-300 mx-1" aria-hidden="true"></div>
          <button 
            type="button" 
            onClick={() => setZoom(100)} 
            className="hover:text-blue-600 transition-colors"
            aria-label="Resetar zoom para 100%"
          >
            RESET
          </button>
        </div>

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
              ref={quillRef}
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

      <style jsx global>{`
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
        }
        
        #wordpad-toolbar button, #wordpad-toolbar .ql-picker {
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
        #wordpad-toolbar .ql-picker.ql-font {
          width: 130px !important;
        }
        #wordpad-toolbar .ql-picker.ql-size {
          width: 70px !important;
        }
        #wordpad-toolbar button:hover, #wordpad-toolbar .ql-picker:hover {
          background-color: #e2e2e2 !important;
          border-color: #bbb !important;
        }
        #wordpad-toolbar button.ql-active, #wordpad-toolbar .ql-picker.ql-expanded {
          background-color: #cde6f7 !important;
          border-color: #2b88d8 !important;
          color: #2b579a !important;
          z-index: 50;
        }
        
        /* Ensure italic button works correctly */
        #wordpad-toolbar button.ql-italic.ql-active {
          font-style: italic !important;
        }

        /* Hide the original selects to prevent duplication if Quill fails to hide them */
        #wordpad-toolbar select {
          display: none !important;
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
          content: '8pt';
        }
        .ql-snow .ql-picker.ql-size .ql-picker-label[data-value=large]::before,
        .ql-snow .ql-picker.ql-size .ql-picker-item[data-value=large]::before {
          content: '14pt';
        }
        .ql-snow .ql-picker.ql-size .ql-picker-label[data-value=huge]::before,
        .ql-snow .ql-picker.ql-size .ql-picker-item[data-value=huge]::before {
          content: '18pt';
        }
        
        .ql-size-small { font-size: 12px; }
        .ql-size-large { font-size: 20px; }
        .ql-size-huge { font-size: 28px; }

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
      `}</style>
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
