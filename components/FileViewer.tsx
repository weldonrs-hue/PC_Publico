'use client';

import { useState, useRef, useEffect } from 'react';
import { FileText, ArrowLeft, Upload, Loader2, AlertCircle, Printer } from 'lucide-react';
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
          toolbar: true,
          sidebar: true,
        });

        if (!destroyed) {
          viewerRef.current = viewer;
          setIsViewerReady(true);
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
      if (viewerRef.current) {
        try { viewerRef.current.destroy(); viewerRef.current = null; } catch (e) {}
        setIsViewerReady(false);
      }
    };
  }, [file]);

  // Handle file updates separately
  useEffect(() => {
    const loadFile = async () => {
      if (isViewerReady && viewerRef.current && file) {
        setIsLoading(true);
        try {
          await viewerRef.current.load(file);
        } catch (err: any) {
          console.error('FileViewer Load Error:', err);
          setError(err.message || 'Erro ao carregar o documento.');
        } finally {
          setIsLoading(false);
        }
      }
    };

    loadFile();
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#1A1B1E] text-white">
      {/* Minimal Header */}
      <div className="bg-[#2C2E33] border-b border-[#373A40] px-4 py-2 flex items-center justify-between z-10 shrink-0">
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack}
            className="p-1.5 hover:bg-[#373A40] rounded-lg transition-colors text-gray-400 hover:text-white"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex items-center gap-2">
            <div className="bg-blue-600/20 p-1.5 rounded-lg text-blue-400">
              <FileText size={16} />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase tracking-widest text-[#909296]">Documento de Alta Fidelidade</span>
              <span className="text-xs font-bold truncate max-w-[200px]">
                {file instanceof File ? file.name : (typeof file === 'string' ? file.split('/').pop() : 'Visualizador')}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={handlePrint}
            disabled={!file || isLoading}
            className="flex items-center gap-2 px-3 py-1.5 bg-[#40C057] hover:bg-[#37B24D] text-white text-[10px] font-black rounded-lg transition-all shadow-lg shadow-green-900/10 disabled:opacity-50"
          >
            <Printer size={14} />
            IMPRIMIR
          </button>
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black rounded-lg transition-all shadow-lg shadow-blue-900/20"
          >
            <Upload size={14} />
            CARREGAR NOVO
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

      {/* Main Content */}
      <div className="flex-1 overflow-hidden relative bg-[#1A1B1E]">
        <AnimatePresence mode="wait">
          {!file ? (
            <motion.div 
              key="empty"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="h-full flex flex-col items-center justify-center p-8 text-center"
            >
              <div className="w-32 h-32 bg-white rounded-[3rem] shadow-2xl flex items-center justify-center text-blue-600 mb-8 border border-gray-100 transform -rotate-3 hover:rotate-0 transition-transform duration-500">
                <FileText size={64} />
              </div>
              <h2 className="text-2xl font-black text-gray-900 mb-3 tracking-tight uppercase">Pronto para ler seus documentos</h2>
              <p className="text-gray-500 max-w-sm font-medium leading-relaxed mb-8">
                Arraste um arquivo ou clique no botão acima para visualizar documentos Word, PDF ou PowerPoint com alta fidelidade.
              </p>
              <div className="flex gap-4">
                {['.DOCX', '.PDF', '.PPTX', '.JPG'].map((ext) => (
                  <span key={ext} className="px-3 py-1 bg-white border border-gray-200 text-gray-400 text-[10px] font-black rounded-full shadow-sm">
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
              className="w-full h-full relative"
            >
              {error ? (
                <div className="h-full flex flex-col items-center justify-center p-10 bg-gray-50 text-center">
                  <AlertCircle size={48} className="text-red-500 mb-4" />
                  <p className="text-gray-800 font-bold mb-2">{error}</p>
                  <p className="text-gray-500 text-sm">O visualizador de alta fidelidade encontrou um problema.</p>
                </div>
              ) : (
                <div ref={containerRef} className="w-full h-full" />
              )}
              
              {isLoading && (
                <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-white/80 backdrop-blur-md">
                  <div className="relative">
                    <Loader2 size={40} className="animate-spin text-blue-600" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-2 h-2 bg-blue-600 rounded-full animate-ping" />
                    </div>
                  </div>
                  <p className="mt-6 text-xs font-black text-gray-800 uppercase tracking-[0.2em] animate-pulse">Carregando Documento...</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer Info */}
      <div className="bg-[#1A1B1E] border-t border-[#373A40] px-4 py-1.5 flex items-center justify-between text-[10px] font-bold text-[#5C5F66]">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 bg-green-500 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.4)]"></div>
          <span className="uppercase tracking-widest">NÚCLEO DOCMENTIS v0.642</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="uppercase tracking-wider">ACELERAÇÃO WASM/SIMD ATIVA</span>
        </div>
      </div>
    </div>
  );
}
