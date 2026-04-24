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
  FileDown,
  ChevronDown,
  Save
} from 'lucide-react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'motion/react';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { db, auth } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { toJpeg, toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { handleFirestoreError, OperationType } from '@/utils/firestore';

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
  
  // Settings/State for Visual Preview
  const [scale, setScale] = useState(1);
  const [showScrollArrows, setShowScrollArrows] = useState(false);
  const [showPdfMenu, setShowPdfMenu] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const pdfMenuRef = useRef<HTMLDivElement>(null);

  // Signature States
  const [signatureName, setSignatureName] = useState('');
  const [signatureImage, setSignatureImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const updateScale = () => {
      if (!containerRef.current) return;
      const containerWidth = containerRef.current.offsetWidth;
      
      // A5 landscape width in pixels at 96dpi is ~794px
      const a5WidthPx = 794;
      
      const newScale = Math.max(0.4, Math.min(1.2, (containerWidth - 32) / a5WidthPx));
      setScale(newScale);

      const scaledWidth = a5WidthPx * newScale;
      setShowScrollArrows(containerWidth < scaledWidth);
    };

    const observer = new ResizeObserver(updateScale);
    if (containerRef.current) observer.observe(containerRef.current);
    updateScale();

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pdfMenuRef.current && !pdfMenuRef.current.contains(event.target as Node)) {
        setShowPdfMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchPersonalData = async () => {
      try {
        const docRef = doc(db, 'personal_data', userId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const pData = docSnap.data();
          setPersonalData(pData);
          if (!signatureName) setSignatureName(pData.nome || '');
          setSignatureImage(pData.signatureImage || null);
        }
      } catch (error) {
        console.error('Error fetching personal data:', error);
      }
    };
    fetchPersonalData();
  }, [userId, signatureName]);

  const scrollContainer = (direction: 'left' | 'right') => {
    if (!containerRef.current) return;
    const scrollAmount = containerRef.current.offsetWidth * 0.8;
    containerRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth'
    });
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

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadOriginalPDF = async () => {
    setGenerating(true);
    try {
      const response = await fetch('/S-302_T.pdf');
      if (!response.ok) {
        throw new Error('Erro ao carregar o modelo PDF S-302-T');
      }
      const pdfBytes = await response.arrayBuffer();
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const pages = pdfDoc.getPages();
      const firstPage = pages[0];
      const { height } = firstPage.getSize();
      const font = await pdfDoc.embedFont(StandardFonts.TimesRoman);
      const boldFont = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);

      const drawText = (text: string, x: number, y: number, size = 10, isBold = false) => {
        if (!text) return;
        firstPage.drawText(text, {
          x,
          y: height - y,
          size,
          font: isBold ? boldFont : font,
          color: rgb(0, 0, 0),
        });
      };

      const mmToPt = 2.83465;

      // 1. Congregação
      const fullCongName = (congregacao.cidade && congregacao.cidade.trim().toLowerCase() !== congregacao.nome.trim().toLowerCase())
        ? `${congregacao.nome} — ${congregacao.cidade.toUpperCase()} ${congregacao.estado}` 
        : `${congregacao.nome} — ${congregacao.estado}`;
      drawText(fullCongName, 100 + (7 * mmToPt), 145 - (10 * mmToPt), 14, true);

      // 2. Visitante
      const visitorName = substituteName ? `${substituteName} (SCS)` : (personalData?.nome || '');
      drawText(visitorName, 130 + (28 * mmToPt), 185 - (16 * mmToPt), 14, true);

      // 3. Data da Visita
      drawText(data, 100 + (7 * mmToPt), 225 - (22.0 * mmToPt), 14, true);

      // 4. Assinatura Image
      if (signatureImage) {
        try {
          const imageBytes = await fetch(signatureImage).then(res => res.arrayBuffer());
          let embeddedImage;
          if (signatureImage.includes('png')) {
            embeddedImage = await pdfDoc.embedPng(imageBytes);
          } else {
            embeddedImage = await pdfDoc.embedJpg(imageBytes);
          }
          
          const targetHeight = 12 * mmToPt;
          const targetWidth = (embeddedImage.width / embeddedImage.height) * targetHeight;
          
          firstPage.drawImage(embeddedImage, {
            x: 120 + (13 * mmToPt),
            y: height - (225 - (22 * mmToPt)) - (targetHeight / 2),
            width: targetWidth,
            height: targetHeight,
          });
        } catch (e) {
          console.error('Erro ao processar imagem da assinatura:', e);
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

  const handleSaveCapturePDF = async () => {
    const element = document.getElementById('s302-paper-preview');
    if (!element) return;

    setGenerating(true);
    try {
      const dataUrl = await toJpeg(element, {
        quality: 0.95,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        width: 794, 
        height: 559, // A5 landscape height at 96dpi
        style: {
          margin: '0',
          boxShadow: 'none',
          borderRadius: '0',
          transform: 'scale(1)',
          transformOrigin: 'top left'
        }
      });

      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a5',
        compress: true
      });

      const scaleFactor = 0.98;
      const w = 210 * scaleFactor;
      const h = 148 * scaleFactor;
      const x = (210 - w) / 2;
      const y = (148 - h) / 2;

      pdf.addImage(dataUrl, 'JPEG', x, y, w, h, undefined, 'FAST');
      pdf.save(`S-302_ProgCir_${congregacao.nome.replace(/\s+/g, '_')}.pdf`);
    } catch (error) {
      console.error('Erro ao capturar preview:', error);
    } finally {
      setGenerating(false);
    }
  };

  const currentVisitorName = substituteName ? `${substituteName} (SCS)` : (personalData?.nome || '');

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center pb-20 print:bg-white print:pb-0">
      {/* Toolbar */}
      <div className="w-full max-w-7xl px-4 py-4 sticky top-0 z-30 print:hidden">
        <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow-lg border border-gray-100 p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4 w-full sm:w-auto">
            <button 
              onClick={onBack}
              className="p-2 hover:bg-gray-100 rounded-full transition-all text-[#512da8] bg-white shadow-sm border border-gray-200"
            >
              <ChevronLeft size={24} strokeWidth={2.5} />
            </button>
            <div>
              <h2 className="text-xl font-bold text-gray-900 leading-tight">S-302 Aviso de Visitas</h2>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">{congregacao.nome} • {data}</p>
            </div>
          </div>

          <div className="flex items-center bg-gray-100 rounded-xl p-1 gap-1">
            <button
              onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
              disabled={currentIndex === 0}
              className="p-1.5 rounded-lg hover:bg-white transition-all text-gray-600 disabled:opacity-30"
              title="Anterior"
            >
              <ChevronsLeft size={18} />
            </button>
            <div className="px-3 flex items-center gap-2">
              <span className="text-sm font-bold text-gray-900">{currentIndex + 1}</span>
              <span className="text-gray-400 text-xs text-center min-w-[20px]">/ {events.length}</span>
            </div>
            <button
              onClick={() => setCurrentIndex(prev => Math.min(events.length - 1, prev + 1))}
              disabled={currentIndex === events.length - 1}
              className="p-1.5 rounded-lg hover:bg-white transition-all text-gray-600 disabled:opacity-30"
              title="Próximo"
            >
              <ChevronsRight size={18} />
            </button>
          </div>

          <div className="flex gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-none" ref={pdfMenuRef}>
              <button 
                onClick={() => setShowPdfMenu(!showPdfMenu)}
                disabled={generating}
                className="w-full bg-[#7B1FA2] text-white px-4 py-2 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-all shadow-sm disabled:opacity-50"
              >
                {generating ? <Loader2 size={16} className="animate-spin" /> : <FileDown size={16} />}
                <span>PDF</span>
                <ChevronDown size={14} className={`transition-transform duration-200 ${showPdfMenu ? 'rotate-180' : ''}`} />
              </button>
              
              {showPdfMenu && (
                <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  className="absolute top-full right-0 mt-2 bg-white border border-gray-100 rounded-2xl shadow-xl py-2 min-w-[180px] z-20 overflow-hidden"
                >
                  <button
                    onClick={() => {
                      handleDownloadOriginalPDF();
                      setShowPdfMenu(false);
                    }}
                    className="w-full text-left px-4 py-3 hover:bg-indigo-50 text-sm font-bold text-gray-700 flex items-center gap-3 transition-colors"
                  >
                    <FileDown size={18} className="text-[#7B1FA2]" />
                    PDF Original
                  </button>
                  <button
                    onClick={() => {
                      handleSaveCapturePDF();
                      setShowPdfMenu(false);
                    }}
                    className="w-full text-left px-4 py-3 hover:bg-indigo-50 text-sm font-bold text-gray-700 flex items-center gap-3 transition-colors"
                  >
                    <FileDown size={18} className="text-[#7B1FA2]" />
                    PDF ProgCir
                  </button>
                </motion.div>
              )}
            </div>
            <button 
              onClick={handlePrint}
              className="flex-1 sm:flex-none bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all shadow-sm"
            >
              <Printer size={16} />
              <span className="hidden sm:inline">Imprimir</span>
            </button>
          </div>
        </div>
      </div>

      {/* Preview Area */}
      <div className="relative w-full max-w-7xl mx-auto flex flex-col items-center">
        {/* Mobile Scroll Arrows */}
        <AnimatePresence>
          {showScrollArrows && (
            <>
              <motion.button
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                onClick={() => scrollContainer('left')}
                className="absolute left-2 top-1/2 -translate-y-1/2 z-20 bg-white/80 backdrop-blur-sm p-3 rounded-full shadow-lg border border-gray-200 text-[#512da8] md:hidden"
              >
                <ChevronLeft size={24} />
              </motion.button>
              <motion.button
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                onClick={() => scrollContainer('right')}
                className="absolute right-2 top-1/2 -translate-y-1/2 z-20 bg-white/80 backdrop-blur-sm p-3 rounded-full shadow-lg border border-gray-200 text-[#512da8] md:hidden"
              >
                <ChevronRight size={24} />
              </motion.button>
            </>
          )}
        </AnimatePresence>

        <div 
          ref={containerRef}
          className="w-full overflow-x-auto custom-scrollbar scroll-smooth flex justify-center p-4 print:p-0 print:overflow-visible"
        >
          <div 
            style={{ 
              width: `${210 * scale}mm`, 
              height: `${148 * scale}mm`,
              minWidth: 'min-content'
            }}
            className="print:w-full print:h-auto"
          >
            <div 
              id="s302-paper-preview"
              className="bg-white shadow-2xl print:shadow-none mx-auto origin-top-left transition-transform duration-200 flex flex-col"
              style={{
                width: '210mm',
                height: '148mm',
                padding: '12mm 15mm',
                fontFamily: '"Times New Roman", Times, serif',
                transform: `scale(${scale})`,
                color: '#000000',
                boxSizing: 'border-box'
              }}
            >
              {/* Header Titles */}
              <div className="text-center mb-4">
                <h1 className="text-[16pt] font-bold uppercase tracking-tight leading-tight mb-4">
                  AVISO SOBRE A VISITA DO SUPERINTENDENTE DE CIRCUITO
                </h1>
              </div>

              {/* Main Text Body */}
              <div className="text-[12pt] leading-snug mb-4">
                <p className="mb-2">Prezados Irmãos:</p>
                <p className="indent-8">
                  Por favor notem os seguintes arranjos para a próxima visita do superintendente de circuito. Informe a congregação e depois coloque este aviso no quadro de anúncios.
                </p>
              </div>

              {/* Form Fields */}
              <div className="space-y-4 mt-2">
                <div className="flex items-end gap-2">
                  <span className="text-[12pt] whitespace-nowrap">Congregação:</span>
                  <div className="flex-grow border-b border-black border-dotted pb-0.5 pl-4 text-[13pt] font-bold text-[#00008b]">
                    {congregacao.nome} — {congregacao.cidade.toUpperCase()} {congregacao.estado}
                  </div>
                </div>

                <div className="flex items-end gap-2">
                  <span className="text-[12pt] whitespace-nowrap">Superintendente de circuito:</span>
                  <div className="flex-grow border-b border-black border-dotted pb-0.5 pl-4 text-[13pt] font-bold text-[#00008b]">
                    {currentVisitorName}
                  </div>
                </div>

                <div className="flex items-end gap-2">
                  <span className="text-[12pt] whitespace-nowrap">Data da visita:</span>
                  <div className="flex-grow border-b border-black border-dotted pb-0.5 pl-4 text-[13pt] font-bold text-[#00008b]">
                    {data}
                  </div>
                </div>
              </div>

              {/* Signature Area */}
              <div className="mt-auto mb-4 self-end w-[220px] flex flex-col items-center">
                <p className="text-[12pt] mb-1 text-center w-full">Seu irmão,</p>
                
                <div 
                  className="relative w-full flex flex-col items-center group cursor-pointer"
                  onClick={() => !signatureImage && fileInputRef.current?.click()}
                >
                  <div className="absolute -left-8 top-0 flex flex-col gap-2 print:hidden opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                      className="p-1 bg-white shadow-md rounded-full text-indigo-600 hover:bg-indigo-50 border border-gray-100"
                    >
                      <Upload size={12} />
                    </button>
                    {signatureImage && (
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleRemoveSignature(); }}
                        className="p-1 bg-white shadow-md rounded-full text-red-600 hover:bg-red-50 border border-gray-100"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>

                  {signatureImage ? (
                    <div className="h-12 w-full relative mb-1">
                      <Image 
                        src={signatureImage} 
                        alt="Assinatura" 
                        fill 
                        className="object-contain"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  ) : (
                    <div className="h-12 flex items-center justify-center w-full">
                      <input 
                        type="text"
                        value={signatureName}
                        onChange={(e) => setSignatureName(e.target.value)}
                        className="font-signature text-[#004aad] leading-none text-center bg-transparent border-none outline-none w-full"
                        style={{ 
                          fontFamily: 'var(--font-signature), cursive',
                          fontSize: '22pt'
                        }}
                        placeholder="Nome..."
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  )}
                  <div className="border-b border-black border-dotted w-full mb-1"></div>
                  <p className="text-[10pt] font-bold uppercase">{personalData?.nome || ''}</p>
                  
                  <input 
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="flex justify-between items-end text-[9pt] font-bold">
                <span>S-302-T</span>
                <span>12/14</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @page {
          size: A5 landscape;
          margin: 0;
        }
        @media print {
          body * {
            visibility: hidden;
          }
          #s302-paper-preview, #s302-paper-preview * {
            visibility: visible;
          }
          #s302-paper-preview {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            margin: 0 !important;
            padding: 12mm 15mm !important;
            width: 210mm !important;
            height: 148mm !important;
            transform: none !important;
            box-shadow: none !important;
          }
          .print-hidden {
            display: none !important;
          }
        }
      `}} />
    </div>
  );
}

