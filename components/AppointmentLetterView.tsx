'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { 
  ChevronLeft, 
  ChevronRight,
  Loader2,
  Printer,
  FileDown,
  X,
  Image as ImageIcon,
  Trash2,
  Upload,
  Maximize2,
  Minimize2,
  RotateCcw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, auth } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, getDocs, limit, setDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '@/utils/firestore';
import { toJpeg } from 'html-to-image';
import { jsPDF } from 'jspdf';
import ImageCropper from './ImageCropper';

interface AppointmentLetterViewProps {
  userId: string;
  congregation: {
    nome: string;
    numero: string;
    cidade: string;
    estado: string;
    endereco?: string;
    coordenador?: string;
    cep?: string;
  };
  visitDate: string;
  onBack: () => void;
}

interface LetterData {
  ancianosDesignados: string[];
  servosDesignados: string[];
  irmaosRemovidos: string[];
}

export default function AppointmentLetterView({ userId, congregation, visitDate, onBack }: AppointmentLetterViewProps) {
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [personalData, setPersonalData] = useState<any>(null);
  const [letterData, setLetterData] = useState<LetterData>({
    ancianosDesignados: ['', '', '', ''],
    servosDesignados: ['', '', '', ''],
    irmaosRemovidos: ['', '', '', '']
  });
  const [letterDate, setLetterDate] = useState<Date>(new Date());
  const [isDateFocused, setIsDateFocused] = useState(false);
  const [signatureName, setSignatureName] = useState('');
  const [signatureImage, setSignatureImage] = useState<string | null>(null);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const letterRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [zoom, setZoom] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('progcir_appointment_letter_zoom');
      return saved ? parseInt(saved, 10) : 100;
    }
    return 100;
  });
  const [showScrollArrows, setShowScrollArrows] = useState(false);

  useEffect(() => {
    sessionStorage.setItem('progcir_appointment_letter_zoom', zoom.toString());
  }, [zoom]);

  const scrollContainer = (direction: 'left' | 'right') => {
    if (!containerRef.current) return;
    const scrollAmount = containerRef.current.offsetWidth * 0.8;
    containerRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth'
    });
  };

  useEffect(() => {
    const updateScale = () => {
      if (!containerRef.current) return;
      
      // Only auto-calculate if not in session already
      if (sessionStorage.getItem('progcir_appointment_letter_zoom')) return;

      const containerWidth = containerRef.current.offsetWidth;
      
      // A4 width in pixels at 96dpi is ~794px (210mm)
      const a4WidthPx = 794;
      
      // Check if it's 1080p range (approx 1920 width)
      const is1080p = window.innerWidth >= 1800 && window.innerWidth <= 2000;
      
      if (is1080p) {
        setZoom(125); // 125% as requested (25% zoom)
      } else {
        // Calculate auto scale to fit the container with some padding
        const newScale = Math.max(1, Math.min(1.5, (containerWidth - 32) / a4WidthPx));
        setZoom(Math.round(newScale * 100));
      }

      // Check if scroll arrows should be shown
      setShowScrollArrows(containerWidth < a4WidthPx);
    };

    const observer = new ResizeObserver(updateScale);
    if (containerRef.current) observer.observe(containerRef.current);
    updateScale();

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      if (!userId) return;
      
      // Wait for auth.currentUser to be ready and match userId
      if (!auth.currentUser || auth.currentUser.uid !== userId) {
        let attempts = 0;
        while ((!auth.currentUser || auth.currentUser.uid !== userId) && attempts < 20) {
          await new Promise(resolve => setTimeout(resolve, 100));
          attempts++;
        }
        if (!auth.currentUser || auth.currentUser.uid !== userId) return;
      }

      try {
        // Fetch personal data
        const pdRef = doc(db, 'personal_data', userId);
        const pdSnap = await getDoc(pdRef);
        if (pdSnap.exists()) {
          const data = pdSnap.data();
          setPersonalData(data);
          setSignatureName(data.nome || '');
          setSignatureImage(data.signatureImage || null);
        } else {
          // Fallback
          const q = query(collection(db, 'personal_data'), where('userId', '==', userId), limit(1));
          const snap = await getDocs(q);
          if (!snap.empty) {
            const data = snap.docs[0].data();
            setPersonalData(data);
            setSignatureName(data.nome || '');
            setSignatureImage(data.signatureImage || null);
          }
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, 'appointment_letter');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [userId, congregation.nome, visitDate]);

  useEffect(() => {
    // No longer needed to set string date here, we use Date object
  }, []);

  const handlePrint = () => {
    window.print();
  };

  const handleExportPDF = async () => {
    const element = document.getElementById('appointment-letter-container');
    if (!element) return;

    // Simple date format for filename: DD-MM-YYYY
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    const dateStr = `${day}-${month}-${year}`;
    
    const filename = `Carta_Designacao_${congregation.nome}_${dateStr}.pdf`;

    setGenerating(true);
    try {
      // Ensure fonts are loaded before capture
      try {
        // Load Dancing Script specifically
        await document.fonts.load('16px "Dancing Script"');
        const font = new FontFace('Dancing Script', 'url(https://fonts.gstatic.com/s/dancingscript/v25/If2cXTr6fe34-3S3SM1uQ_Lp.woff2)');
        await font.load();
        document.fonts.add(font);
      } catch (e) {
        console.warn('Erro ao carregar fonte para PDF:', e);
      }
      
      // Wait for all fonts and add a small safety buffer
      await document.fonts.ready;
      await new Promise(resolve => setTimeout(resolve, 500));

      const dataUrl = await toJpeg(element, {
        quality: 0.85,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        width: 793.7, // 210mm at 96dpi
        height: 1122.5, // 297mm at 96dpi
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

      const scale = 0.95;
      const w = 210 * scale;
      const h = 297 * scale;
      const x = (210 - w) / 2;
      const y = (297 - h) / 2;

      pdf.addImage(dataUrl, 'JPEG', x, y, w, h, undefined, 'FAST');
      pdf.save(filename);
    } catch (error) {
      console.error('Erro ao exportar PDF:', error);
    } finally {
      setGenerating(false);
    }
  };

  const updateField = (type: keyof LetterData, index: number, value: string) => {
    setLetterData(prev => {
      const newData = { ...prev };
      newData[type][index] = value;
      return newData;
    });
  };

  const formatLongDate = (date: Date) => {
    return date.toLocaleDateString('pt-BR', { 
      weekday: 'long', 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
    });
  };

  const formatShortDate = (date: Date) => {
    return date.toLocaleDateString('pt-BR', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
    });
  };

  const handleDateInputChange = (value: string) => {
    // Allow user to type freely while focused
    // We'll only try to parse it on blur or if it matches dd/mm/yyyy
    const parts = value.split('/');
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2], 10);
      if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
        const newDate = new Date(year, month, day);
        if (!isNaN(newDate.getTime())) {
          setLetterDate(newDate);
        }
      }
    }
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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-4">
        <Loader2 className="w-12 h-12 text-[#512da8] animate-spin" />
        <p className="text-gray-500 font-medium">Carregando carta...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 w-full pb-10 flex flex-col items-center print:space-y-0 print:pb-0 print:block bg-gray-50 min-h-screen">
      {/* Header Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between print:hidden bg-white/80 backdrop-blur-md p-4 rounded-2xl sticky top-0 z-10 border border-gray-100 shadow-sm w-full max-w-7xl gap-4 mt-4">
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <button 
            onClick={onBack}
            className="p-2 hover:bg-gray-100 rounded-full transition-all text-[#512da8] bg-white shadow-sm border border-gray-200 flex-shrink-0"
          >
            <ChevronLeft size={24} strokeWidth={2.5} />
          </button>
          <div className="min-w-0">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 leading-tight truncate">Carta de Designação/Cancelamento</h2>
            <p className="text-[10px] sm:text-xs text-gray-500 font-medium uppercase tracking-wider truncate">{congregation.nome} • {visitDate}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-center sm:justify-end">
          {/* Zoom Controls */}
          <div className="flex items-center gap-1 sm:gap-2 bg-gray-100 p-1 rounded-xl border border-gray-200">
            <button 
              onClick={() => setZoom(Math.max(25, zoom - 25))}
              className="p-1.5 hover:bg-white rounded-lg transition-all text-gray-500 hover:text-[#512da8] disabled:opacity-30"
              disabled={zoom <= 25}
              title="Diminuir zoom"
            >
              <Minimize2 size={16} />
            </button>
            <div className="min-w-[45px] sm:min-w-[60px] text-center">
              <span className="text-[10px] sm:text-xs font-bold text-gray-600">{zoom}%</span>
            </div>
            <button 
              onClick={() => setZoom(Math.min(200, zoom + 25))}
              className="p-1.5 hover:bg-white rounded-lg transition-all text-gray-500 hover:text-[#512da8] disabled:opacity-30"
              disabled={zoom >= 200}
              title="Aumentar zoom"
            >
              <Maximize2 size={16} />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={handleExportPDF}
              disabled={generating}
              className="bg-[#512da8] text-white px-3 sm:px-4 py-2 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 hover:opacity-90 transition-all shadow-sm disabled:opacity-50"
            >
              {generating ? <Loader2 size={16} className="animate-spin" /> : <FileDown size={16} />}
              <span>{generating ? '...' : 'Baixar PDF'}</span>
            </button>
            <button 
              onClick={handlePrint}
              className="bg-[#512da8] text-white px-3 sm:px-4 py-2 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 hover:opacity-90 transition-all shadow-sm"
            >
              <Printer size={16} />
              <span className="hidden sm:inline">Imprimir</span>
            </button>
          </div>
        </div>
      </div>

      {/* Letter Content */}
      <div className="relative w-full max-w-7xl mx-auto">
        {/* Mobile Scroll Arrows */}
        <AnimatePresence>
          {showScrollArrows && (
            <>
              <motion.button
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                onClick={() => scrollContainer('left')}
                className="absolute left-2 top-1/2 -translate-y-1/2 z-20 bg-white/80 backdrop-blur-sm p-2 rounded-full shadow-lg border border-gray-200 text-[#512da8] md:hidden"
                aria-label="Rolar para esquerda"
              >
                <ChevronLeft size={24} />
              </motion.button>
              <motion.button
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                onClick={() => scrollContainer('right')}
                className="absolute right-2 top-1/2 -translate-y-1/2 z-20 bg-white/80 backdrop-blur-sm p-2 rounded-full shadow-lg border border-gray-200 text-[#512da8] md:hidden"
                aria-label="Rolar para direita"
              >
                <ChevronRight size={24} />
              </motion.button>
            </>
          )}
        </AnimatePresence>

        <div 
          ref={containerRef}
          className="bg-white shadow-xl rounded-lg overflow-auto border border-gray-200 print:shadow-none print:border-none w-full print:max-w-none print:w-full print:m-0 print:p-0 flex flex-col items-start custom-scrollbar scroll-smooth"
        >
          <div 
            className="flex flex-col items-center py-10 print:py-0 mx-auto"
            style={{ 
              width: `${(210 * zoom) / 100}mm`,
              minWidth: '100%',
              transition: 'width 0.2s ease-out'
            }}
          >
            <div 
              id="appointment-letter-container"
              className="bg-white print:min-h-0 text-black print:m-0 flex flex-col print:w-[210mm] print:h-[297mm] print:fixed print:top-0 print:left-0 print:z-[100] flex-shrink-0"
              style={{ 
                fontFamily: "'Times New Roman', Times, serif",
                padding: '12.7mm',
                width: '210mm',
                minWidth: '210mm',
                height: '297mm',
                overflow: 'visible',
                boxSizing: 'border-box',
                transform: `scale(${zoom / 100})`,
                transformOrigin: 'top center',
                marginBottom: `${(zoom / 100 - 1) * 297}mm`,
                transition: 'transform 0.2s ease-out, margin-bottom 0.2s ease-out'
              }}
            >
          <article 
            ref={letterRef}
            className="w-full h-full flex flex-col"
          >
            {/* Letter Header */}
            <header className="text-center mb-4">
              <h2 className="font-bold text-2xl mb-1">
                {personalData?.nome || 'Nome do Viajante'} {personalData?.circuito || ''}
              </h2>
              <p className="text-[11px] uppercase tracking-tight">
                {personalData?.endereco || ''}{personalData?.cidade ? `, ${personalData.cidade}` : ''}{personalData?.uf ? `-${personalData.uf}` : ''} CEP: {personalData?.cep || ''}
              </p>
            </header>

            {/* Date */}
            <div className="text-right mb-6">
              <input 
                type="text"
                value={isDateFocused ? formatShortDate(letterDate) : formatLongDate(letterDate)}
                onChange={(e) => handleDateInputChange(e.target.value)}
                onFocus={() => setIsDateFocused(true)}
                onBlur={() => setIsDateFocused(false)}
                className="text-[15px] text-right bg-transparent border-none outline-none w-full print:placeholder-transparent"
                style={{ fontFamily: "'Times New Roman', Times, serif" }}
              />
            </div>

            {/* Congregation & Recipient Info */}
            <div className="grid grid-cols-2 mb-10">
              <div className="space-y-0.5">
                <p className="font-bold uppercase text-[15px]">CONGREGAÇÃO: {congregation.nome}</p>
                <p className="text-[15px]">{congregation.coordenador || 'Coordenador do Corpo de Anciãos'}</p>
                <p className="text-[15px]">{congregation.endereco || 'Endereço da congregação'}</p>
                <p className="text-[15px]">{congregation.cidade} - {congregation.estado}</p>
                <p className="text-[15px]">{congregation.cep || ''}</p>
              </div>
              <div className="text-left pt-0 pl-12">
                <p className="font-bold text-[15px] uppercase">AO CORPO DE ANCIÃOS</p>
                <p className="text-[15px] italic">Ref.: Designações e cancelamentos de anciãos e servos ministeriais</p>
              </div>
            </div>

            {/* Salutation */}
            <div className="mb-6">
              <p className="text-[15px] mt-[-26px]">Prezados Irmãos:</p>
            </div>

            {/* Content Sections */}
            <div className="space-y-12 text-[15px] leading-snug flex-1 mt-[-17px]">
              <section>
                <p className="mb-1">Confirmo que fiz a(s) seguinte(s) designação(ões) de <strong className="font-bold">ancião(s)</strong>:</p>
                <div className="space-y-0">
                  {letterData.ancianosDesignados.map((name, i) => (
                    <div key={i} className="border-b border-dotted border-[#bbb] h-[1.4rem] mb-[0.1rem] w-full flex items-end">
                      <input 
                        type="text"
                        value={name}
                        onChange={(e) => updateField('ancianosDesignados', i, e.target.value)}
                        className="w-full bg-transparent outline-none text-[15px] border-none p-0 h-full print:placeholder-transparent"
                        placeholder={i === 0 ? "Nome do irmão..." : ""}
                      />
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <p className="mb-1 mt-[-30px]">Confirmo que fiz a(s) seguinte(s) designação(ões) de <strong className="font-bold">servo(s) ministerial(is)</strong>:</p>
                <div className="space-y-0">
                  {letterData.servosDesignados.map((name, i) => (
                    <div key={i} className="border-b border-dotted border-[#bbb] h-[1.4rem] mb-[0.1rem] w-full flex items-end">
                      <input 
                        type="text"
                        value={name}
                        onChange={(e) => updateField('servosDesignados', i, e.target.value)}
                        className="w-full bg-transparent outline-none text-[15px] border-none p-0 h-full print:placeholder-transparent"
                        placeholder={i === 0 ? "Nome do irmão..." : ""}
                      />
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <p className="mb-1 mt-[-30px]">Confirmo que <strong className="font-bold">cancelei</strong> o(s) seguinte(s) irmão(s) de servir como ancião ou servo ministerial:</p>
                <div className="space-y-0">
                  {letterData.irmaosRemovidos.map((name, i) => (
                    <div key={i} className="border-b border-dotted border-[#bbb] h-[1.4rem] mb-[0.1rem] w-full flex items-end">
                      <input 
                        type="text"
                        value={name}
                        onChange={(e) => updateField('irmaosRemovidos', i, e.target.value)}
                        className="w-full bg-transparent outline-none text-[15px] border-none p-0 h-full print:placeholder-transparent"
                        placeholder={i === 0 ? "Nome do irmão..." : ""}
                      />
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <p className="text-[15px] mt-[-30px]">Aceitem meu cordial amor cristão.</p>
              </section>
            </div>

            {/* Closing */}
            <div className="mt-8 relative group">
              <div className="flex flex-col items-end mb-[58px] pr-[5mm]">
                <div className="w-full max-w-[450px] px-4 text-center relative">
                  <p className="text-[15px] mt-0 mb-[18px] text-left pl-4">Seu irmão,</p>
                  {/* Signature Block */}
                  <div className="inline-block relative w-full flex flex-col items-center overflow-visible">
                    {/* Signature Upload Controls removed */}

                    {signatureImage && signatureImage.length > 5 && (signatureImage.startsWith('http') || signatureImage.startsWith('data:')) ? (
                      <div 
                        className="h-16 flex items-center justify-center mb-[-10px] relative w-full overflow-visible transition-transform"
                        style={{ 
                          transform: `translateY(${personalData?.signatureOffset || 0}px)`
                        }}
                      >
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
                        className="font-signature text-[#004aad] leading-none mb-[-4px] text-center bg-transparent border-none outline-none w-full px-2"
                        style={{ 
                          fontFamily: 'var(--font-signature), "Dancing Script", cursive',
                          fontSize: signatureName.length > 25 ? '24px' : (signatureName.length > 18 ? '28px' : '32px')
                        }}
                      />
                    )}
                    <div className="border-t border-black w-full mx-auto mb-0"></div>
                    <p className="font-bold text-[11px] mt-[5px] uppercase tracking-wider mb-0 text-center bg-transparent border-none outline-none w-full">
                      {personalData?.nome || 'Nome do Viajante'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </article>
        </div>
      </div>
    </div>
  </div>

      {/* Signature Font Import */}
      <style jsx global>{`
        @media print {
          @page {
            margin: 0;
            size: A4 portrait;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            height: 297mm !important;
            width: 210mm !important;
            overflow: hidden !important;
            background: white !important;
          }
          #appointment-letter-container {
            width: 210mm !important;
            height: 297mm !important;
            margin: 0 !important;
            padding: 12.7mm !important;
            overflow: hidden !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            box-sizing: border-box !important;
            background: white !important;
            /* Reset scale for printing */
            transform: scale(0.95) !important;
            transform-origin: top center !important;
          }
          body {
            background-color: white !important;
          }
          .print-hidden {
            display: none !important;
          }
          input::placeholder {
            color: transparent;
          }
          input {
            border: none !important;
          }
        }
      `}</style>
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
