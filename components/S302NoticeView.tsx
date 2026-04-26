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
  Type
} from 'lucide-react';
import Image from 'next/image';
import { motion } from 'motion/react';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

import { toPng } from 'html-to-image';

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
  };
}

const DEFAULT_LAYOUT: S302Layout = {
  header: { top: 13, left: 0, fontSize: 16.5 },
  body: { top: 27, left: 10, fontSize: 10 },
  congregation: { top: 65, left: 28, fontSize: 16.5 },
  visitor: { top: 78, left: 27, fontSize: 16.5 },
  visitDate: { top: 93, left: 27, fontSize: 16.5 },
  signature: { bottom: 21, right: 23, fontSize: 15.5, width: 125 }
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
  onBack: () => void;
}

export default function S302NoticeView({ events, initialIndex, userId, onBack }: S302NoticeViewProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const currentEvent = events[currentIndex];
  const { congregacao, data, substituteName } = currentEvent;

  const [loading, setLoading] = useState(false);
  const [personalData, setPersonalData] = useState<any>(null);
  const [generating, setGenerating] = useState(false);
  
  // Design Mode States
  const [isDesignMode, setIsDesignMode] = useState(false);
  const [layout, setLayout] = useState<S302Layout>(DEFAULT_LAYOUT);
  const [selectedElement, setSelectedElement] = useState<keyof S302Layout | null>(null);
  const [isSavingLayout, setIsSavingLayout] = useState(false);
  
  // Signature States (Similar to AppointmentLetterView)
  const [signatureName, setSignatureName] = useState('');
  const [signatureImage, setSignatureImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const personalRef = doc(db, 'personal_data', userId);
        const layoutRef = doc(db, 's302_layouts', userId);
        
        const [personalSnap, layoutSnap] = await Promise.all([
          getDoc(personalRef),
          getDoc(layoutRef)
        ]);

        if (personalSnap.exists()) {
          const pData = personalSnap.data();
          setPersonalData(pData);
          if (!signatureName) setSignatureName(pData.nome || '');
          setSignatureImage(pData.signatureImage || null);
        }

        if (layoutSnap.exists()) {
          setLayout(layoutSnap.data() as S302Layout);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };
    fetchData();
  }, [userId]);

  const handleSaveLayout = async () => {
    setIsSavingLayout(true);
    try {
      await setDoc(doc(db, 's302_layouts', userId), layout);
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
        const result = reader.result as string;
        setSignatureImage(result);
        saveSignature(result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveSignature = () => {
    setSignatureImage(null);
    saveSignature(null);
  };

  const handleDownloadPDF = async () => {
    setGenerating(true);
    try {
      // Create a fresh PDF using the PNG background for better reliability
      const pdfDoc = await PDFDocument.create();
      const mmToPt = 2.83465;
      const pageWidth = 210 * mmToPt;
      const pageHeight = 148 * mmToPt;
      const firstPage = pdfDoc.addPage([pageWidth, pageHeight]);
      
      const { height } = firstPage.getSize();

      // Removed background image embed block for plain PDF

      // Ensure fonts are loaded before generation
      try {
        await document.fonts.load('16px "Dancing Script"');
        const fontFace = new FontFace('Dancing Script', 'url(https://fonts.gstatic.com/s/dancingscript/v25/If2cXTr6fe34-3S3SM1uQ_Lp.woff2)');
        await fontFace.load();
        document.fonts.add(fontFace);
      } catch (e) {
        console.warn('Erro ao carregar fonte para PDF:', e);
      }
      await document.fonts.ready;
      
      const font = await pdfDoc.embedFont(StandardFonts.TimesRoman);
      const boldFont = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);

      const drawText = (text: string, xMm: number, yMm: number, sizePt = 10, isBold = false) => {
        if (!text) return;
        firstPage.drawText(text, {
          x: xMm * mmToPt,
          y: height - (yMm * mmToPt),
          size: sizePt,
          font: isBold ? boldFont : font,
          color: rgb(0, 0, 0),
        });
      };

      // 1. Header
      if (layout.header.left === 0) {
        // Centered logic
        const headerText = "AVISO SOBRE A VISITA DO SUPERINTENDENTE DE CIRCUITO";
        const textWidth = boldFont.widthOfTextAtSize(headerText, layout.header.fontSize);
        const centerX = (pageWidth - textWidth) / 2;
        firstPage.drawText(headerText, {
          x: centerX,
          y: height - (layout.header.top * mmToPt),
          size: layout.header.fontSize,
          font: boldFont,
          color: rgb(0, 0, 0),
        });
      } else {
        drawText("AVISO SOBRE A VISITA DO SUPERINTENDENTE DE CIRCUITO", layout.header.left, layout.header.top, layout.header.fontSize, true);
      }

      // 2. Prezado / Body Text
      drawText("Prezados Irmãos:", layout.body.left, layout.body.top, layout.body.fontSize);
      
      const bodyLine1 = "Por favor notem os seguintes arranjos para a próxima visita do superintendente de";
      const bodyLine2 = "circuito. Informe a congregação e depois coloque este aviso no quadro de anúncios.";
      
      const lineHeightPt = layout.body.fontSize * 1.15; // Even tighter spacing
      const bodyTopGap = 5; // Reduced from 6mm
      drawText(bodyLine1, layout.body.left + 12, layout.body.top + bodyTopGap, layout.body.fontSize);
      drawText(bodyLine2, layout.body.left, layout.body.top + bodyTopGap + (lineHeightPt / mmToPt), layout.body.fontSize);

      // 3. Labels and Data using Layout
      const labelFontSize = (size: number) => size - 3;
      
      const drawField = (label: string, value: string, layoutItem: any) => {
        const lSize = labelFontSize(layoutItem.fontSize);
        const vSize = layoutItem.fontSize;
        
        drawText(label, layoutItem.left, layoutItem.top, lSize);
        
        const labelWidth = font.widthOfTextAtSize(label, lSize);
        const gapMm = 3;
        drawText(value, layoutItem.left + (labelWidth / mmToPt) + gapMm, layoutItem.top, vSize, true);
      };

      drawField("Congregação:", fullCongName, layout.congregation);
      drawField("Superintendente de circuito:", visitorName, layout.visitor);
      drawField("Data da visita:", data, layout.visitDate);

      // 4. Signature using Layout
      const sigY = height - ((pageHeight - layout.signature.bottom) * mmToPt);
      const sigX = (pageWidth - (layout.signature.right * mmToPt)) - (layout.signature.width * mmToPt);
      
      // Draw "Seu irmão," closing
      const closingText = "Seu irmão,";
      const closingFontSize = layout.signature.fontSize + 1;
      const closingWidth = font.widthOfTextAtSize(closingText, closingFontSize);
      firstPage.drawText(closingText, {
        x: sigX + (layout.signature.width * mmToPt / 2) - (closingWidth / 2),
        y: sigY + (10 * mmToPt),
        size: closingFontSize,
        font: font,
        color: rgb(0, 0, 0),
      });
      
      if (signatureImage) {
        try {
          const imageBytes = await fetch(signatureImage).then(res => res.arrayBuffer());
          let embeddedImage;
          if (signatureImage.includes('png')) {
            embeddedImage = await pdfDoc.embedPng(imageBytes);
          } else {
            embeddedImage = await pdfDoc.embedJpg(imageBytes);
          }
          
          const targetHeight = 10 * mmToPt;
          const targetWidth = (embeddedImage.width / embeddedImage.height) * targetHeight;
          
          firstPage.drawImage(embeddedImage, {
            x: sigX + (layout.signature.width * mmToPt / 2) - (targetWidth / 2),
            y: sigY + (4 * mmToPt),
            width: targetWidth,
            height: targetHeight,
          });
        } catch (e) {
          console.error('Erro ao processar imagem da assinatura:', e);
        }
      } else if (signatureName) {
        // Draw typed signature
        try {
          const fontSize = layout.signature.fontSize;
          const textWidth = boldFont.widthOfTextAtSize(signatureName, fontSize);
          firstPage.drawText(signatureName, {
            x: sigX + (layout.signature.width * mmToPt / 2) - (textWidth / 2),
            y: sigY + (4 * mmToPt),
            size: fontSize,
            font: boldFont,
            color: rgb(0.1, 0.2, 0.6), // Blueish to simulate ink
          });
        } catch (e) {
          console.error('Erro ao desenhar assinatura de texto:', e);
        }
      }

      const modifiedPdfBytes = await pdfDoc.save();
      const blob = new Blob([modifiedPdfBytes as any], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `S-302_${congregacao.nome.replace(/\s+/g, '_')}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Erro ao gerar o PDF. Verifique se o arquivo S-302_T.pdf está na pasta public.');
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

  return (
    <div className="min-h-screen bg-gray-50 pb-20 print:bg-white print:pb-0">
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page {
            size: A5 landscape;
            margin: 0;
          }
          body {
            background: white;
          }
          /* Hide everything except the form */
          body > :not(#s302-print-container) {
            display: none !important;
          }
          #s302-print-container {
            display: block !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 210mm !important;
            height: 148mm !important;
          }
        }
      `}} />
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-center justify-between bg-[#512da8] p-4 rounded-2xl shadow-lg print:hidden gap-4 m-4">
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <button 
            onClick={onBack}
            className="p-2 hover:bg-white/20 rounded-full transition-all text-white bg-white/10 shadow-md border border-white/20"
            title="Voltar"
          >
            <ChevronLeft size={28} strokeWidth={3} />
          </button>
          <h2 className="text-2xl font-black text-white tracking-tight">
            S-302 Aviso de Visitas
          </h2>
        </div>

        <div className="flex gap-2 w-full sm:w-auto justify-end">
          <button 
            onClick={() => setIsDesignMode(!isDesignMode)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all shadow-md ${
              isDesignMode ? 'bg-white text-[#512da8]' : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            <Settings2 size={20} />
            {isDesignMode ? 'Sair do Design' : 'Personalizar Layout'}
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 flex flex-col lg:flex-row gap-6">
        {/* Design Sidebar */}
        {isDesignMode && (
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="w-full lg:w-80 shrink-0 space-y-6"
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
                        type="range" min="0" max="148" step="1"
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

        <div className="flex-1 space-y-6">
          {/* Info Card - Simplified/Updated Controls */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden"
          >
            <div className="bg-[#512da8] p-4 text-white flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="flex items-center bg-white/10 rounded-xl p-1 gap-1 w-full sm:w-auto justify-between sm:justify-start">
                <button
                  onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                  disabled={currentIndex === 0}
                  className="p-1.5 rounded-lg hover:bg-white/20 transition-all text-white disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronsLeft size={18} />
                </button>
                <div className="px-4 flex flex-col items-center min-w-[100px]">
                  <span className="text-sm font-bold truncate max-w-[150px]">
                    {congregacao.nome}
                  </span>
                  <span className="text-[9px] text-white/60 font-bold uppercase tracking-widest leading-none">
                    {currentIndex + 1} / {events.length}
                  </span>
                </div>
                <button
                  onClick={() => setCurrentIndex(prev => Math.min(events.length - 1, prev + 1))}
                  disabled={currentIndex === events.length - 1}
                  className="p-1.5 rounded-lg hover:bg-white/20 transition-all text-white disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronsRight size={18} />
                </button>
              </div>

              <div className="flex gap-2 shrink-0">
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
                  BAIXAR PDF
                </button>
              </div>
            </div>

            <div className="p-8 overflow-x-auto flex justify-center bg-gray-100 print:bg-white print:p-0">
              {/* Visual Form Representation */}
              <div 
                id="s302-print-container"
                className="bg-white shadow-2xl print:shadow-none min-w-[210mm] w-[210mm] h-[148mm] relative font-serif-document text-black border border-gray-200 print:border-none shrink-0 overflow-hidden"
                style={{ backgroundColor: 'white' }}
              >
                {/* Header */}
                <h1 
                  className={`absolute w-full text-center font-bold tracking-wide uppercase px-[10mm] cursor-pointer transition-all ${selectedElement === 'header' ? 'bg-[#512da8]/10 ring-2 ring-[#512da8] ring-inset' : ''}`}
                  style={{ 
                    top: `${layout.header.top}mm`, 
                    left: layout.header.left === 0 ? '0' : `${layout.header.left}mm`,
                    fontSize: `${layout.header.fontSize}pt` 
                  }}
                  onClick={() => isDesignMode && setSelectedElement('header')}
                >
                  AVISO SOBRE A VISITA DO SUPERINTENDENTE DE CIRCUITO
                </h1>
  
                {/* Body Content */}
                <div 
                  className={`absolute right-[25mm] space-y-[2mm] cursor-pointer transition-all ${selectedElement === 'body' ? 'bg-[#512da8]/10 ring-2 ring-[#512da8] ring-inset' : ''}`}
                  style={{ 
                    top: `${layout.body.top}mm`, 
                    left: `${layout.body.left}mm`,
                    fontSize: `${layout.body.fontSize}pt`
                  }}
                  onClick={() => isDesignMode && setSelectedElement('body')}
                >
                  <p className="leading-[1.15]">Prezados Irmãos:</p>
                  <p className="indent-[12mm] leading-[1.15] text-justify mt-[3mm]">
                    Por favor notem os seguintes arranjos para a próxima visita do superintendente de circuito. 
                    Informe a congregação e depois coloque este aviso no quadro de anúncios.
                  </p>
                </div>

                {/* Form Fields */}
                <div 
                  className={`absolute h-[8mm] flex items-end gap-2 cursor-pointer transition-all ${selectedElement === 'congregation' ? 'bg-[#512da8]/10 ring-2 ring-[#512da8] ring-inset' : ''}`}
                  style={{ 
                    top: `${layout.congregation.top}mm`, 
                    left: `${layout.congregation.left}mm`,
                    right: '25mm'
                  }}
                  onClick={() => isDesignMode && setSelectedElement('congregation')}
                >
                  <span className="pb-1" style={{ fontSize: `${layout.congregation.fontSize - 3}pt` }}>Congregação:</span>
                  <div 
                    className="flex-1 border-b border-black border-dotted font-bold px-3 pb-0.5 flex items-end overflow-hidden whitespace-nowrap"
                    style={{ fontSize: `${layout.congregation.fontSize}pt` }}
                  >
                    {fullCongName}
                  </div>
                </div>

                <div 
                  className={`absolute h-[8mm] flex items-end gap-2 cursor-pointer transition-all ${selectedElement === 'visitor' ? 'bg-[#512da8]/10 ring-2 ring-[#512da8] ring-inset' : ''}`}
                  style={{ 
                    top: `${layout.visitor.top}mm`, 
                    left: `${layout.visitor.left}mm`,
                    right: '25mm'
                  }}
                  onClick={() => isDesignMode && setSelectedElement('visitor')}
                >
                  <span className="pb-1" style={{ fontSize: `${layout.visitor.fontSize - 3}pt` }}>Superintendente de circuito:</span>
                  <div 
                    className="flex-1 border-b border-black border-dotted font-bold px-3 pb-0.5 flex items-end overflow-hidden whitespace-nowrap"
                    style={{ fontSize: `${layout.visitor.fontSize}pt` }}
                  >
                    {visitorName}
                  </div>
                </div>

                <div 
                  className={`absolute h-[8mm] flex items-end gap-2 cursor-pointer transition-all ${selectedElement === 'visitDate' ? 'bg-[#512da8]/10 ring-2 ring-[#512da8] ring-inset' : ''}`}
                  style={{ 
                    top: `${layout.visitDate.top}mm`, 
                    left: `${layout.visitDate.left}mm`,
                    right: '25mm'
                  }}
                  onClick={() => isDesignMode && setSelectedElement('visitDate')}
                >
                  <span className="pb-1" style={{ fontSize: `${layout.visitDate.fontSize - 3}pt` }}>Data da visita:</span>
                  <div 
                    className="flex-1 border-b border-black border-dotted font-bold px-3 pb-0.5 flex items-end overflow-hidden whitespace-nowrap"
                    style={{ fontSize: `${layout.visitDate.fontSize}pt` }}
                  >
                    {data}
                  </div>
                </div>

                           <div 
                  className={`absolute flex flex-col items-center cursor-pointer transition-all ${selectedElement === 'signature' ? 'bg-[#512da8]/10 ring-2 ring-[#512da8] ring-inset' : ''}`}
                  style={{ 
                    bottom: `${layout.signature.bottom}mm`, 
                    right: `${layout.signature.right}mm`,
                    width: `${layout.signature.width}mm`
                  }}
                  onClick={() => isDesignMode && setSelectedElement('signature')}
                >
                  <span className="mb-0.5" style={{ fontSize: `${layout.signature.fontSize + 1}pt` }}>Seu irmão,</span>
                  
                  <div className="w-full relative flex flex-col items-center group">
                    <div className="absolute -left-12 top-0 flex flex-col gap-2 print:hidden opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                        className="p-1.5 bg-white shadow-md rounded-full text-[#512da8] hover:bg-gray-50 border border-gray-100"
                        title="Alterar Assinatura"
                      >
                        <Upload size={14} />
                      </button>
                    </div>
 
                    <div className="h-10 w-full relative flex items-center justify-center">
                      {signatureImage ? (
                        <div className="h-full w-full relative">
                          <Image 
                            src={signatureImage} 
                            alt="Assinatura" 
                            fill 
                            className="object-contain"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      ) : (
                        <input 
                          type="text"
                          value={signatureName}
                          onChange={(e) => setSignatureName(e.target.value)}
                          className="font-signature text-[#004aad] text-center bg-transparent border-none outline-none w-full"
                          style={{ 
                            fontFamily: 'var(--font-signature), "Dancing Script", cursive',
                            fontSize: '32px'
                          }}
                        />
                      )}
                    </div>
                    <div className="w-full border-b border-black border-dotted"></div>
                  </div>
                </div>

                <div className="absolute bottom-[10mm] left-[15mm] right-[15mm] flex justify-between text-[9pt] font-sans text-gray-400 print:text-black">
                  <span>S-302-T</span>
                  <span>12/14</span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-4">
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
              {generating ? 'Gerando PDF...' : 'Baixar PDF Preenchido'}
            </button>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-800 text-sm flex gap-3">
            <div className="shrink-0 mt-0.5">⚠️</div>
            <p>
              Este recurso preenche o formulário oficial S-302-T. Se os dados não aparecerem nos locais corretos, 
              pode ser necessário ajustar as coordenadas de impressão no modo Design.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
