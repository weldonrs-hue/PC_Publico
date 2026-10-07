'use client';

import { useState, useRef, useEffect } from 'react';
import { FileText, ArrowLeft, Upload, Loader2, AlertCircle, Printer, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface FileViewerProps {
  onBack: () => void;
}

export default function FileViewer({ onBack }: FileViewerProps) {
  const [file, setFile] = useState<File | string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const clientRef = useRef<any>(null);

  const [isViewerReady, setIsViewerReady] = useState(false);

  useEffect(() => {
    let destroyed = false;

    if (!file) return;

    const initViewer = async () => {
      // Small delay to ensure containerRef is attached to DOM (important for AnimatePresence)
      for (let i = 0; i < 10; i++) {
        if (containerRef.current) break;
        await new Promise(r => setTimeout(r, 50));
      }

      if (!containerRef.current || destroyed) return;

      setIsLoading(true);
      setError(null);
      try {
        const { getUDocClient } = await import('@/lib/udoc');
        const client = await getUDocClient();
        
        if (destroyed) return;

        const viewer = await client.createViewer({
          container: containerRef.current,
          theme: 'dark',
          hideToolbar: false,
          disableLeftPanel: false,
          disableRightPanel: false,
          scrollMode: 'continuous',
          layoutMode: 'single-page',
          zoomMode: 'fit-spread-width-max',
          dpi: 120,
          // @ts-ignore
          renderMode: 'paged'
        });

        if (!destroyed) {
          viewerRef.current = viewer;
          
          try {
            await (viewer as any).setViewMode('paged');
            await (viewer as any).setZoomMode('fit-page-width');
            await (viewer as any).setScrollMode('continuous');
          } catch (e) {}
          // Add a generous delay before marking as ready to ensure internal setup is complete
          setTimeout(() => {
            if (!destroyed && viewerRef.current) {
              setIsViewerReady(true);
            }
          }, 1500);
        }
      } catch (err: any) {
        console.error('FileViewer Error:', err);
        if (!destroyed) {
          setError(err.message || 'Erro ao carregar o visualizador. Verifique se o formato do arquivo é suportado.');
          setIsLoading(false);
        }
      }
    };

    if (!viewerRef.current) {
      initViewer();
    }

    return () => {
      destroyed = true;
      setIsViewerReady(false);
      if (viewerRef.current) {
        try { 
          const v = viewerRef.current;
          viewerRef.current = null;
          v.destroy(); 
        } catch (e) {}
      }
    };
  }, [file]);

  // Handle file updates separately
  useEffect(() => {
    let active = true;
    const loadFile = async () => {
      if (isViewerReady && viewerRef.current && file && active) {
        setIsLoading(true);
        try {
          if (!viewerRef.current?.load) throw new Error('Viewer not ready');
          await viewerRef.current.load(file);
        } catch (err: any) {
          if (!active) return;
          console.error('FileViewer Load Error:', err);
          
          // Retry logic for UDoc issues
          if (String(err).includes('length') || String(err).includes('null')) {
            console.log('FileViewer load failed, retrying in 2000ms...');
            setTimeout(async () => {
              if (active && viewerRef.current?.load && file) {
                try {
                  await viewerRef.current.load(file);
                } catch (e) {
                  console.error('FileViewer retry failed:', e);
                  setError('Erro ao carregar o documento após tentativa de recuperação.');
                }
              }
            }, 2000);
          } else {
            setError(err.message || 'Erro ao carregar o documento.');
          }
        } finally {
          if (active) setIsLoading(false);
        }
      }
    };

    loadFile();
    return () => { active = false; };
  }, [file, isViewerReady]);

  const handlePrint = () => {
    if (viewerRef.current?.print) {
      viewerRef.current.print();
    } else {
      try {
        const udocIframe = containerRef.current?.querySelector('iframe');
        if (udocIframe && udocIframe.contentWindow) {
          udocIframe.contentWindow.print();
        } else {
          window.print();
        }
      } catch (e) {
        window.print();
      }
    }
  };

  const handleDownload = () => {
    if (!file) return;
    
    let url: string;
    let filename: string;
    
    if (file instanceof File) {
      url = URL.createObjectURL(file);
      filename = file.name;
    } else if (typeof file === 'string') {
      url = file;
      filename = file.split('/').pop() || 'documento';
    } else {
      return;
    }
    
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    if (file instanceof File) {
      URL.revokeObjectURL(url);
    }
  };

  // Fix DocMentis printer choice in Modal
  useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof HTMLElement) {
            const modal = node.classList.contains('udoc-modal') ? node : node.querySelector('.udoc-modal');
            if (modal) {
              const titleNode = modal.querySelector('.udoc-modal-title');
              if (titleNode && (titleNode.textContent?.toLowerCase().includes('imprimir') || titleNode.textContent?.toLowerCase().includes('print'))) {
                const body = modal.querySelector('.udoc-modal-body') || modal.querySelector('[class*="body"]');
                if (body && !body.querySelector('.custom-printer-selector')) {
                  const selectorDiv = document.createElement('div');
                  selectorDiv.className = 'custom-printer-selector mt-4 pt-4 border-t border-gray-100';
                  selectorDiv.innerHTML = `
                    <label class="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Destino / Impressora</label>
                    <div class="relative group">
                      <select id="modal-printer-choice" class="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-[11px] font-bold text-gray-700 outline-none focus:border-blue-500 transition-all appearance-none cursor-pointer">
                        <option value="system">Impressora Física (Sistema)</option>
                      </select>
                      <div class="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 group-hover:text-blue-500 transition-colors">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                      </div>
                    </div>
                    <p class="text-[9px] text-gray-400 font-medium mt-2 leading-tight">* A escolha da impressora física específica será confirmada no sistema.</p>
                  `;
                  body.appendChild(selectorDiv);
                }
              }
            }
          }
        });
      });
    });

    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <div 
      className="space-y-4 pb-8"
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag Overlay */}
      <AnimatePresence>
        {isDragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-primary-200/20 backdrop-blur-sm border-4 border-dashed border-primary-200 m-4 rounded-3xl flex flex-col items-center justify-center pointer-events-none"
          >
            <div className="bg-primary-200 p-6 rounded-full shadow-2xl text-white mb-4">
              <Upload size={48} className="animate-bounce" />
            </div>
            <h3 className="text-2xl font-black uppercase tracking-tighter text-white">Solte para abrir</h3>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Screen Header & Top Controls */}
      <div className="flex items-center justify-between gap-3 bg-surface-100 p-3 sm:p-4 rounded-3xl border border-surface-300 shadow-xs flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <button 
            onClick={onBack}
            className="h-9 w-9 sm:h-10 sm:w-10 p-1.5 sm:p-2 hover:bg-surface-200 active:scale-95 rounded-xl transition-all text-typography-900 bg-surface-200/80 shadow-xs border border-surface-300 flex items-center justify-center shrink-0 cursor-pointer"
            title="Voltar para Diversos"
          >
            <ArrowLeft size={18} strokeWidth={2.5} />
          </button>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-black text-typography-900 tracking-tight leading-none truncate">
                Leitor de Arquivos
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 shrink-0">
                DOCX / PDF
              </span>
            </div>
            <p className="text-[11px] sm:text-xs font-medium text-typography-500 truncate mt-0.5">
              {file instanceof File ? file.name : (typeof file === 'string' ? file.split('/').pop() : 'Visualizador de Documentos em Alta Fidelidade')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 ml-auto flex-wrap">
          {file && (
            <button 
              onClick={handleDownload}
              disabled={isLoading}
              className="h-9 sm:h-10 px-2.5 sm:px-3 rounded-xl text-xs font-bold text-blue-700 dark:text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 shadow-xs flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
              title="Baixar Original"
            >
              <Download size={14} className="shrink-0 text-blue-600 dark:text-blue-400" />
              <span className="hidden sm:inline">Baixar Original</span>
            </button>
          )}
          <button 
            onClick={handlePrint}
            disabled={!file || isLoading}
            className="h-9 sm:h-10 px-2.5 sm:px-3 rounded-xl text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 shadow-xs flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
            title="Imprimir Documento"
          >
            <Printer size={14} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span>Imprimir</span>
          </button>
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="h-9 sm:h-10 px-2.5 sm:px-3.5 rounded-xl text-xs font-bold text-primary-200 bg-primary-200/10 hover:bg-primary-200/20 border border-primary-200/20 shadow-xs flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] cursor-pointer"
            title="Carregar Novo Arquivo"
          >
            <Upload size={14} className="shrink-0 text-primary-200" />
            <span>Carregar Novo</span>
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            className="hidden" 
            accept=".docx,.pdf,.pptx,.jpg,.png"
          />
        </div>
      </div>

      {/* Main Content Viewer Card */}
      <div className="bg-surface-100 rounded-3xl border border-surface-300 shadow-xs overflow-hidden h-[calc(100vh-210px)] min-h-[550px] relative flex flex-col">
        <AnimatePresence mode="wait">
          {!file ? (
            <motion.div 
              key="empty"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="h-full flex flex-col items-center justify-center p-8 text-center"
            >
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-surface-200/70 border border-surface-300 shadow-sm flex items-center justify-center text-blue-500 mb-6 transform -rotate-3 hover:rotate-0 transition-transform duration-500">
                <FileText size={48} />
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-typography-900 mb-2 tracking-tight uppercase">Pronto para ler seus documentos</h2>
              <p className="text-typography-500 max-w-sm font-medium text-xs sm:text-sm leading-relaxed mb-6">
                Arraste um arquivo ou clique no botão acima para visualizar documentos Word, PDF ou PowerPoint com alta fidelidade.
              </p>
              <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
                {['.DOCX', '.PDF', '.PPTX', '.JPG'].map((ext) => (
                  <span key={ext} className="px-3 py-1 bg-surface-200 border border-surface-300 text-typography-400 text-[10px] font-black rounded-full shadow-2xs">
                    {ext}
                  </span>
                ))}
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="viewer"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="w-full flex-1 relative"
            >
              {error ? (
                <div className="h-full flex flex-col items-center justify-center p-10 bg-surface-100 text-center">
                  <AlertCircle size={48} className="text-rose-500 mb-4" />
                  <p className="text-typography-900 font-bold mb-2">{error}</p>
                  <p className="text-typography-500 text-sm">O visualizador de alta fidelidade encontrou um problema.</p>
                </div>
              ) : (
                <div ref={containerRef} className="w-full h-full" />
              )}
              
              {isLoading && (
                <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-surface-100/80 backdrop-blur-md">
                  <div className="relative">
                    <Loader2 size={40} className="animate-spin text-primary-200" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-2 h-2 bg-primary-200 rounded-full animate-ping" />
                    </div>
                  </div>
                  <p className="mt-6 text-xs font-black text-typography-900 uppercase tracking-[0.2em] animate-pulse">Carregando Documento...</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer Info */}
        <div className="bg-surface-100 border-t border-surface-300 px-4 py-2 flex items-center justify-between text-[10px] font-bold text-typography-400 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.4)]"></div>
            <span className="uppercase tracking-widest">NÚCLEO DOCMENTIS v0.642</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="uppercase tracking-wider hidden sm:inline">ACELERAÇÃO WASM/SIMD ATIVA</span>
          </div>
        </div>
      </div>
    </div>
  );
}
