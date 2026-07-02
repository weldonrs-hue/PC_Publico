'use client';

import { useState, useEffect, useRef } from 'react';
import { 
  FileText, 
  ChevronLeft, 
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Download, 
  Loader2,
  Printer,
  Calendar,
  MapPin,
  User,
  Hash,
  Upload,
  Trash2,
  Settings2,
  Save,
  Maximize2,
  Move,
  Type,
  Sparkles,
  PenTool
} from 'lucide-react';
import Image from 'next/image';
import { motion } from 'motion/react';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

import { toPng, toJpeg } from 'html-to-image';
import { jsPDF } from 'jspdf';
import ImageCropper from './ImageCropper';
import SignaturePad from './SignaturePad';
import DraggableSignature from './DraggableSignature';

interface ElementLayout {
  top: number;
  left: number;
  fontSize: number;
  width?: number;
}

interface S302Layout {
  header: ElementLayout;
  body: ElementLayout;
  congregation: ElementLayout;
  visitor: ElementLayout;
  visitDate: ElementLayout;
  signature: {
    bottom: number;
    right: number;
    fontSize: number;
    width: number;
    imageHeight?: number;
    imageOffset?: number;
    imageShiftX?: number;
  };
}

const DEFAULT_LAYOUT: S302Layout = {
  header: { top: 12, left: 0, fontSize: 15 },
  body: { top: 32, left: 15, fontSize: 15 },
  congregation: { top: 65, left: 29, fontSize: 16 },
  visitor: { top: 75, left: 29, fontSize: 16 },
  visitDate: { top: 85, left: 29, fontSize: 16 },
  signature: { 
    bottom: 24, 
    right: 15, 
    fontSize: 16, 
    width: 125,
    imageHeight: 15,
    imageOffset: 0,
    imageShiftX: 0
  }
};

interface Congregation {
  id?: string;
  nome: string;
  numero: string;
  cidade: string;
  estado: string;
  endereco: string;
  bairro: string;
  cep: string;
  telefone: string;
  email: string;
  reuniaoFimSemana: string;
  reuniaoMeioSemana: string;
}

interface S302Event {
  congregacao: Congregation;
  data: string;
  substituteName?: string;
}

interface S302NoticeViewProps {
  events: S302Event[];
  initialIndex: number;
  userId: string;
  isAdmin: boolean;
  onBack: () => void;
}

export default function S302NoticeView({ events, initialIndex, userId, isAdmin, onBack }: S302NoticeViewProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const currentEvent = events[currentIndex];
  const { congregacao, data, substituteName } = currentEvent;

  const [loading, setLoading] = useState(true);
  const [personalData, setPersonalData] = useState<any>(null);
  const [generating, setGenerating] = useState(false);
  
  // Design Mode States
  const [isDesignMode, setIsDesignMode] = useState(false);
  const [layout, setLayout] = useState<S302Layout>(DEFAULT_LAYOUT);
  const [selectedElement, setSelectedElement] = useState<keyof S302Layout | null>(null);
  const [isSavingLayout, setIsSavingLayout] = useState(false);
  const [signaturePlacement, setSignaturePlacement] = useState<{ x: number, y: number, scale: number } | null>(null);
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  
  // Signature States (Similar to AppointmentLetterView)
  const [signatureName, setSignatureName] = useState('');
  const [signatureImage, setSignatureImage] = useState<string | null>(null);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const removeImageBackground = () => {
    if (!signatureImage) return;
    
    setIsProcessing(true);
    
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.src = signatureImage;
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        setIsProcessing(false);
        return;
      }
      
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      const threshold = 230; 
      
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        if (r > threshold && g > threshold && b > threshold) {
          data[i + 3] = 0;
        }
      }
      
      ctx.putImageData(imageData, 0, 0);
      const processedImage = canvas.toDataURL('image/png');
      setSignatureImage(processedImage);
      saveSignature(processedImage);
      setIsProcessing(false);
    };
    
    img.onerror = () => {
      console.error("Error loading image for background removal");
      setIsProcessing(false);
    };
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const personalRef = doc(db, 'personal_data', userId);
        const layoutRef = doc(db, 's302_layouts', 'shared_layout');
        const placementRef = doc(db, 'signature_placements', `s302_${userId}`);
        
        const [personalSnap, layoutSnap, placementSnap] = await Promise.all([
          getDoc(personalRef),
          getDoc(layoutRef),
          getDoc(placementRef)
        ]);

        if (personalSnap.exists()) {
          const pData = personalSnap.data();
          setPersonalData(pData);
          if (!signatureName) setSignatureName(pData.nome || '');
          setSignatureImage(pData.signatureImage || null);
        }

        if (placementSnap.exists()) {
          setSignaturePlacement(placementSnap.data() as any);
        } else {
          setSignaturePlacement({ x: 500, y: 440, scale: 1 });
        }

        if (layoutSnap.exists()) {
          const remoteLayout = layoutSnap.data() as S302Layout;
          // Deep merge with defaults to ensure no missing keys cause undefined values
          setLayout({
            header: { ...DEFAULT_LAYOUT.header, ...remoteLayout.header },
            body: { ...DEFAULT_LAYOUT.body, ...remoteLayout.body },
            congregation: { ...DEFAULT_LAYOUT.congregation, ...remoteLayout.congregation },
            visitor: { ...DEFAULT_LAYOUT.visitor, ...remoteLayout.visitor },
            visitDate: { ...DEFAULT_LAYOUT.visitDate, ...remoteLayout.visitDate },
            signature: { 
              ...DEFAULT_LAYOUT.signature, 
              ...remoteLayout.signature,
              imageHeight: remoteLayout.signature.imageHeight ?? DEFAULT_LAYOUT.signature.imageHeight,
              imageOffset: remoteLayout.signature.imageOffset ?? DEFAULT_LAYOUT.signature.imageOffset,
              imageShiftX: remoteLayout.signature.imageShiftX ?? DEFAULT_LAYOUT.signature.imageShiftX
            }
          });
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [userId]);

  const handleSaveLayout = async () => {
    if (!isAdmin) return;
    setIsSavingLayout(true);
    try {
      await setDoc(doc(db, 's302_layouts', 'shared_layout'), layout);
      setIsDesignMode(false);
    } catch (error) {
      console.error('Error saving layout:', error);
    } finally {
      setIsSavingLayout(false);
    }
  };

  const updateLayout = (key: keyof S302Layout, field: string, value: number) => {
    setLayout(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        [field]: value
      }
    }));
  };

  const saveSignature = async (image: string | null) => {
    if (!userId) return;
    try {
      await setDoc(doc(db, 'personal_data', userId), {
        signatureImage: image
      }, { merge: true });
    } catch (error) {
      console.error('Erro ao salvar assinatura:', error);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageToCrop(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
    // Reset input
    e.target.value = '';
  };

  const handleCropComplete = (croppedImage: string) => {
    setSignatureImage(croppedImage);
    saveSignature(croppedImage);
    setImageToCrop(null);
  };

  const handleRemoveSignature = () => {
    setSignatureImage(null);
    saveSignature(null);
  };

  const handleSignaturePlacementSave = async (settings: { x: number, y: number, scale: number }) => {
    setSignaturePlacement(settings);
    try {
      await setDoc(doc(db, 'signature_placements', `s302_${userId}`), settings);
    } catch (error) {
      console.error('Error saving signature placement:', error);
    }
  };

  const handleSignaturePadSave = (signatureDataUrl: string) => {
    setSignatureImage(signatureDataUrl);
    saveSignature(signatureDataUrl);
    setShowSignaturePad(false);
  };

  const handleDownloadPDF = async () => {
    const element = document.getElementById('s302-print-container');
    if (!element) return;

    setGenerating(true);
    try {
      // Use toJpeg for high quality capture
      const dataUrl = await toJpeg(element, {
        quality: 0.95,
        pixelRatio: 3, // High resolution for text clarity
        backgroundColor: '#ffffff',
        width: 793.7, // 210mm at 96dpi is ~793.7px
        height: 521.6, // 138mm at 96dpi is ~521.6px
        style: {
          margin: '0',
          boxShadow: 'none',
          borderRadius: '0',
          transform: 'scale(1)',
          transformOrigin: 'top left'
        }
      });

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true
      });

      // Calculate 20% reduction dimensions (scale 0.8)
      const scale = 0.8;
      const imgWidth = 210 * scale;
      const imgHeight = 138 * scale;
      const xOffset = (210 - imgWidth) / 2;
      const yOffset = 20; // Match the top: 20mm from print CSS

      // Fit the image to A4 with the specified scale and position
      pdf.addImage(dataUrl, 'JPEG', xOffset, yOffset, imgWidth, imgHeight, undefined, 'FAST');
      
      const filename = `S-302_${congregacao.nome.replace(/\s+/g, '_')}.pdf`;
      pdf.save(filename);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Erro ao gerar o PDF. Por favor, tente novamente.');
    } finally {
      setGenerating(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const visitorName = substituteName ? `${substituteName} (SCS)` : (personalData?.nome || '');
  const fullCongName = (congregacao.cidade && congregacao.cidade.trim().toLowerCase() !== congregacao.nome.trim().toLowerCase())
    ? `${congregacao.nome}, ${congregacao.cidade}` 
    : congregacao.nome;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <Loader2 className="animate-spin text-[#512da8] mb-4" size={48} />
        <p className="text-gray-500 font-bold">Carregando formulário...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20 print:bg-white print:pb-0 print:min-h-0">
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page {
            size: A4 portrait;
            margin: 0;
          }
          body {
            background: white !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .no-print {
            display: none !important;
          }
          #s302-print-container {
            display: block !important;
            visibility: visible !important;
            position: absolute !important;
            top: 20mm !important;
            left: 0 !important;
            right: 0 !important;
            margin-left: auto !important;
            margin-right: auto !important;
            width: 210mm !important;
            height: 138mm !important;
            border: 0.5pt solid #000 !important;
            box-shadow: none !important;
            overflow: hidden !important;
            z-index: 9999 !important;
            background: white !important;
            transform: scale(0.8) !important;
            transform-origin: top center !important;
          }
          #s302-print-container * {
            visibility: visible !important;
          }
        }
      `}} />
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-center justify-between bg-[#512da8] p-4 rounded-2xl shadow-lg no-print gap-4 m-2 sm:m-4">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button 
            onClick={onBack}
            className="p-2 hover:bg-white/20 rounded-full transition-all text-white bg-white/10 shadow-md border border-white/20"
            title="Voltar"
          >
            <ChevronLeft size={24} strokeWidth={3} />
          </button>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            S-302 Aviso de Visitas
          </h2>
        </div>

        <div className="flex gap-2 w-full sm:w-auto justify-end">
          {isAdmin && (
            <button 
              onClick={() => setIsDesignMode(!isDesignMode)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all shadow-md ${
                isDesignMode ? 'bg-white text-[#512da8]' : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              <Settings2 size={20} />
              {isDesignMode ? 'Sair do Design' : 'Personalizar Layout'}
            </button>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-2 sm:p-4 flex flex-col lg:flex-row gap-4 sm:gap-6 no-print-container">
        {/* Design Sidebar */}
        {isDesignMode && (
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="w-full lg:w-80 shrink-0 space-y-6 no-print"
          >
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <Settings2 size={20} className="text-[#512da8]" />
                Modo Design
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase mb-2 block">Elemento para ajustar</label>
                  <select 
                    value={selectedElement || ''} 
                    onChange={(e) => setSelectedElement(e.target.value as keyof S302Layout)}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#512da8] focus:border-[#512da8] outline-none font-medium"
                  >
                    <option value="">Selecione...</option>
                    <option value="header">Cabeçalho (Título)</option>
                    <option value="body">Texto de Instrução</option>
                    <option value="congregation">Campo Congregação</option>
                    <option value="visitor">Campo Superintendente</option>
                    <option value="visitDate">Campo Data</option>
                    <option value="signature">Assinatura / Nome</option>
                  </select>
                </div>

                {selectedElement && (
                  <div className="space-y-6 pt-4 border-t border-gray-100">
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1">
                          <Move size={14} /> Posição Vertical {selectedElement === 'signature' ? '(de baixo)' : '(do topo)'}
                        </label>
                        <span className="text-xs font-mono font-bold text-[#512da8]">
                          {selectedElement === 'signature' ? (layout.signature as any).bottom : (layout as any)[selectedElement].top}mm
                        </span>
                      </div>
                      <input 
                        type="range" min="0" max="138" step="1"
                        value={selectedElement === 'signature' ? (layout.signature as any).bottom : (layout as any)[selectedElement].top}
                        onChange={(e) => updateLayout(selectedElement, selectedElement === 'signature' ? 'bottom' : 'top', parseInt(e.target.value))}
                        className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#512da8]"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1">
                          <Move size={14} /> Posição Horizontal {selectedElement === 'signature' ? '(da direita)' : '(da esquerda)'}
                        </label>
                        <span className="text-xs font-mono font-bold text-[#512da8]">
                          {selectedElement === 'signature' ? (layout.signature as any).right : (layout as any)[selectedElement].left}mm
                        </span>
                      </div>
                      <input 
                        type="range" min="0" max="210" step="1"
                        value={selectedElement === 'signature' ? (layout.signature as any).right : (layout as any)[selectedElement].left}
                        onChange={(e) => updateLayout(selectedElement, selectedElement === 'signature' ? 'right' : 'left', parseInt(e.target.value))}
                        className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#512da8]"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1">
                          <Type size={14} /> Tamanho da Fonte
                        </label>
                        <span className="text-xs font-mono font-bold text-[#512da8]">
                          {(layout as any)[selectedElement].fontSize}pt
                        </span>
                      </div>
                      <input 
                        type="range" min="6" max="40" step="0.5"
                        value={(layout as any)[selectedElement].fontSize}
                        onChange={(e) => updateLayout(selectedElement, 'fontSize', parseFloat(e.target.value))}
                        className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#512da8]"
                      />
                    </div>

                    {selectedElement === 'signature' && (
                      <div className="space-y-6">
                        <div>
                          <div className="flex justify-between items-center mb-2">
                            <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1">
                              <Maximize2 size={14} /> Largura do Bloco
                            </label>
                            <span className="text-xs font-mono font-bold text-[#512da8]">
                              {layout.signature.width}mm
                            </span>
                          </div>
                          <input 
                            type="range" min="20" max="150" step="1"
                            value={layout.signature.width}
                            onChange={(e) => updateLayout('signature', 'width', parseInt(e.target.value))}
                            className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#512da8]"
                          />
                        </div>

                        <div>
                          <div className="flex justify-between items-center mb-2">
                            <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1">
                              <Maximize2 size={14} /> Altura da Imagem
                            </label>
                            <span className="text-xs font-mono font-bold text-[#512da8]">
                              {layout.signature.imageHeight}mm
                            </span>
                          </div>
                          <input 
                            type="range" min="5" max="50" step="1"
                            value={layout.signature.imageHeight}
                            onChange={(e) => updateLayout('signature', 'imageHeight', parseInt(e.target.value))}
                            className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#512da8]"
                          />
                        </div>

                        <div>
                          <div className="flex justify-between items-center mb-2">
                            <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1">
                              <Move size={14} /> Ajuste Vertical Imagem
                            </label>
                            <span className="text-xs font-mono font-bold text-[#512da8]">
                              {layout.signature.imageOffset}mm
                            </span>
                          </div>
                          <input 
                            type="range" min="-20" max="20" step="0.5"
                            value={layout.signature.imageOffset}
                            onChange={(e) => updateLayout('signature', 'imageOffset', parseFloat(e.target.value))}
                            className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#512da8]"
                          />
                        </div>

                        <div>
                          <div className="flex justify-between items-center mb-2">
                            <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1">
                              <Move size={14} /> Ajuste Horizontal Imagem
                            </label>
                            <span className="text-xs font-mono font-bold text-[#512da8]">
                              {layout.signature.imageShiftX}mm
                            </span>
                          </div>
                          <input 
                            type="range" min="-50" max="50" step="0.5"
                            value={layout.signature.imageShiftX}
                            onChange={(e) => updateLayout('signature', 'imageShiftX', parseFloat(e.target.value))}
                            className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#512da8]"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <button 
                  onClick={handleSaveLayout}
                  disabled={isSavingLayout}
                  className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 mt-4"
                >
                  {isSavingLayout ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
                  Salvar Posições
                </button>
              </div>
            </div>
          </motion.div>
        )}

        <div className="flex-1 space-y-6 no-print-container">
          {/* Info Card - Simplified/Updated Controls */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden print:border-none print:shadow-none print:overflow-visible"
          >
            <div className="bg-[#512da8] p-3 sm:p-4 text-white flex flex-col sm:flex-row justify-between items-center gap-4 no-print">
              <div className="flex items-center bg-white/10 rounded-xl p-1 gap-1 w-full sm:w-auto">
                <button
                  onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                  disabled={currentIndex === 0}
                  className="p-2 rounded-lg hover:bg-white/20 transition-all text-white disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronsLeft size={20} />
                </button>
                <div className="px-2 sm:px-4 flex flex-col items-center flex-1 sm:flex-initial min-w-[120px]">
                  <span className="text-xs sm:text-sm font-bold truncate max-w-[150px] sm:max-w-none">
                    {congregacao.nome}
                  </span>
                  <span className="text-[10px] text-white/60 font-bold uppercase tracking-widest leading-none">
                    {currentIndex + 1} / {events.length}
                  </span>
                </div>
                <button
                  onClick={() => setCurrentIndex(prev => Math.min(events.length - 1, prev + 1))}
                  disabled={currentIndex === events.length - 1}
                  className="p-2 rounded-lg hover:bg-white/20 transition-all text-white disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronsRight size={20} />
                </button>
              </div>

              <div className="flex gap-2 w-full sm:w-auto justify-center sm:justify-end">
                <button 
                  onClick={handlePrint}
                  className="bg-white/20 text-white px-4 py-1.5 rounded-lg font-bold text-sm hover:bg-white/30 transition-colors flex items-center gap-2"
                >
                  <Printer size={16} />
                  IMPRIMIR
                </button>
                <button 
                  onClick={handleDownloadPDF}
                  disabled={generating}
                  className="bg-white text-[#512da8] px-4 py-1.5 rounded-lg font-bold text-sm hover:bg-gray-100 transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {generating ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                  Baixar PDF
                </button>
              </div>
            </div>

            <div className="p-2 sm:p-8 overflow-x-auto flex justify-start sm:justify-center bg-gray-100 print:bg-white print:p-0 print:overflow-visible">
              {/* Visual Form Representation */}
              <div 
                id="s302-print-container"
                ref={previewRef}
                className="bg-white shadow-2xl print:shadow-none min-w-[210mm] w-[210mm] h-[138mm] relative font-serif-document text-black border border-gray-400 shrink-0 overflow-hidden print:overflow-visible"
                style={{ backgroundColor: 'white' }}
              >
                {/* Header */}
                <h1 
                  className={`absolute left-0 right-0 text-center font-bold tracking-wide uppercase cursor-pointer transition-all ${selectedElement === 'header' ? 'bg-[#512da8]/10 ring-2 ring-[#512da8] ring-inset' : ''}`}
                  style={{ 
                    top: `${layout.header.top}mm`, 
                    fontSize: `${layout.header.fontSize}pt` 
                  }}
                  onClick={() => isDesignMode && setSelectedElement('header')}
                >
                  AVISO SOBRE A VISITA DO SUPERINTENDENTE DE CIRCUITO
                </h1>
  
                {/* Body Content */}
                <div 
                  className={`absolute cursor-pointer transition-all ${selectedElement === 'body' ? 'bg-[#512da8]/10 ring-2 ring-[#512da8] ring-inset' : ''}`}
                  style={{ 
                    top: `${layout.body.top}mm`, 
                    left: `${layout.body.left}mm`,
                    right: '15mm',
                    fontSize: `${layout.body.fontSize}pt`,
                    lineHeight: '1.4'
                  }}
                  onClick={() => isDesignMode && setSelectedElement('body')}
                >
                  <p className="mb-[8pt]">Prezados Irmãos:</p>
                  <p className="indent-[40pt] text-justify">
                    Por favor notem os seguintes arranjos para a próxima visita do supe- rintendente de circuito. 
                    Informe a congregação e depois coloque este aviso no quadro de anúncios.
                  </p>
                </div>

                <div 
                  className={`absolute flex items-end cursor-pointer transition-all ${selectedElement === 'congregation' ? 'bg-[#512da8]/10 ring-2 ring-[#512da8] ring-inset' : ''}`}
                  style={{ 
                    top: `${layout.congregation.top}mm`,
                    left: `${layout.congregation.left}mm`, 
                    right: '15mm' 
                  }}
                  onClick={() => isDesignMode && setSelectedElement('congregation')}
                >
                  <span className="whitespace-nowrap pr-2" style={{ fontSize: `${layout.congregation.fontSize}pt` }}>Congregação:</span>
                  <div className="flex-1 border-b border-black border-dotted font-bold px-3 min-h-[1.5em] flex items-end">
                    {fullCongName}
                  </div>
                </div>

                <div 
                  className={`absolute flex items-end cursor-pointer transition-all ${selectedElement === 'visitor' ? 'bg-[#512da8]/10 ring-2 ring-[#512da8] ring-inset' : ''}`}
                  style={{ 
                    top: `${layout.visitor.top}mm`,
                    left: `${layout.visitor.left}mm`, 
                    right: '15mm' 
                  }}
                  onClick={() => isDesignMode && setSelectedElement('visitor')}
                >
                  <span className="whitespace-nowrap pr-2" style={{ fontSize: `${layout.visitor.fontSize}pt` }}>Superintendente de circuito:</span>
                  <div className="flex-1 border-b border-black border-dotted font-bold px-3 min-h-[1.5em] flex items-end">
                    {visitorName}
                  </div>
                </div>

                <div 
                  className={`absolute flex items-end cursor-pointer transition-all ${selectedElement === 'visitDate' ? 'bg-[#512da8]/10 ring-2 ring-[#512da8] ring-inset' : ''}`}
                  style={{ 
                    top: `${layout.visitDate.top}mm`,
                    left: `${layout.visitDate.left}mm`, 
                    right: '15mm' 
                  }}
                  onClick={() => isDesignMode && setSelectedElement('visitDate')}
                >
                  <span className="whitespace-nowrap pr-2" style={{ fontSize: `${layout.visitDate.fontSize}pt` }}>Data da visita:</span>
                  <div className="flex-1 border-b border-black border-dotted font-bold px-3 min-h-[1.5em] flex items-end">
                    {data}
                  </div>
                </div>
                
                {/* Signature Block */}
                <div 
                  className={`absolute flex flex-col items-center cursor-pointer transition-all ${selectedElement === 'signature' ? 'bg-[#512da8]/10 ring-2 ring-[#512da8] ring-inset' : ''}`}
                  style={{ 
                    bottom: `${layout.signature.bottom}mm`, 
                    right: `${layout.signature.right}mm`,
                    width: `${layout.signature.width}mm`
                  }}
                  onClick={() => isDesignMode && setSelectedElement('signature')}
                >
                  <div className="w-full text-center mb-[4pt]" style={{ fontSize: `${layout.signature.fontSize}pt` }}>Seu irmão,</div>
                  
                  <div className="w-full relative flex flex-col items-center group">
                    <div 
                      className="w-full relative flex items-end justify-center transition-transform"
                      style={{ 
                        height: `${layout.signature.imageHeight || 12}mm`,
                        marginBottom: `${layout.signature.imageOffset || 0}mm`,
                        transform: `translateX(${layout.signature.imageShiftX || 0}mm)`
                      }}
                    >
                      {!signatureImage && (
                        <span className="font-signature text-[#004aad] text-2xl leading-none">{signatureName}</span>
                      )}
                    </div>
                    <div className="w-full border-b border-black"></div>
                  </div>
                </div>

                {/* Draggable Signature Layer */}
                {signatureImage && signaturePlacement && (
                  <DraggableSignature 
                    image={signatureImage}
                    initialX={signaturePlacement.x}
                    initialY={signaturePlacement.y}
                    initialScale={signaturePlacement.scale}
                    onSave={handleSignaturePlacementSave}
                    containerRef={previewRef}
                  />
                )}

                <div className="absolute bottom-[0.8cm] left-[1.5cm] flex gap-[20pt] text-[11pt] font-sans">
                  <span>S-302-T</span>
                  <span>12/14</span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-4 no-print">
            <button
              onClick={handleDownloadPDF}
              disabled={generating}
              className="flex-1 bg-[#512da8] hover:bg-[#4527a0] text-white font-bold py-4 px-6 rounded-2xl shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
            >
              {generating ? (
                <Loader2 size={24} className="animate-spin" />
              ) : (
                <Download size={24} />
              )}
              {generating ? 'Gerando PDF...' : 'Baixar PDF'}
            </button>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-800 text-sm flex gap-3 no-print">
            <div className="shrink-0 mt-0.5">⚠️</div>
            <p>
              Este recurso preenche o formulário oficial S-302-T. Se os dados não aparecerem nos locais corretos, 
              pode ser necessário ajustar as coordenadas de impressão no modo Design.
            </p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 no-print">
            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
              <PenTool size={20} className="text-[#512da8]" />
              Assinatura Global
            </h3>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => setShowSignaturePad(true)}
                className="px-6 py-2.5 bg-[#512da8] text-white rounded-xl font-bold text-sm shadow-md hover:bg-[#4527a0] transition-all flex items-center gap-2"
              >
                <Sparkles size={16} />
                Nova Assinatura Digital
              </button>
              {signatureImage && (
                <button
                  onClick={handleRemoveSignature}
                  className="px-6 py-2.5 bg-red-50 text-red-600 rounded-xl font-bold text-sm hover:bg-red-100 transition-all flex items-center gap-2"
                >
                  <Trash2 size={16} />
                  Remover
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Signature Pad Modal */}
      {showSignaturePad && (
        <SignaturePad 
          initialName={personalData?.nome || signatureName}
          onSave={handleSignaturePadSave}
          onCancel={() => setShowSignaturePad(false)}
        />
      )}

      {/* Image Cropper for Signature */}
      {imageToCrop && (
        <ImageCropper 
          image={imageToCrop}
          onCropComplete={handleCropComplete}
          onCancel={() => setImageToCrop(null)}
          aspect={6}
          cropShape="rect"
          lockAspect={false}
        />
      )}
    </div>
  );
}
