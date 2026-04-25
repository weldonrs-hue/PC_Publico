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
  GripVertical,
  RotateCcw,
  Save
} from 'lucide-react';
import Image from 'next/image';
import { motion } from 'motion/react';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

import { toPng } from 'html-to-image';

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

interface Positions {
  congregacao: { x: number; y: number };
  visitante: { x: number; y: number };
  data: { x: number; y: number };
  assinatura: { x: number; y: number };
}

const DEFAULT_POSITIONS: Positions = {
  congregacao: { x: 25, y: 54 },
  visitante: { x: 25, y: 70 },
  data: { x: 25, y: 86 },
  assinatura: { x: 105, y: 105 } // Adjusted to be roughly where it was
};

export default function S302NoticeView({ events, initialIndex, userId, onBack }: S302NoticeViewProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const currentEvent = events[currentIndex];
  const { congregacao, data, substituteName } = currentEvent;

  const [loading, setLoading] = useState(false);
  const [personalData, setPersonalData] = useState<any>(null);
  const [generating, setGenerating] = useState(false);
  
  // Signature States (Similar to AppointmentLetterView)
  const [signatureName, setSignatureName] = useState('');
  const [signatureImage, setSignatureImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Drag and Drop Positions State
  const [positions, setPositions] = useState<Positions>(DEFAULT_POSITIONS);
  const [isSavingPositions, setIsSavingPositions] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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

        // Fetch S302 positions
        const configRef = doc(db, 's302_configs', userId);
        const configSnap = await getDoc(configRef);
        if (configSnap.exists()) {
          const configData = configSnap.data();
          if (configData.positions) {
            setPositions(configData.positions);
          }
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };
    fetchPersonalData();
  }, [userId]);

  const handleSavePositions = async () => {
    setIsSavingPositions(true);
    try {
      await setDoc(doc(db, 's302_configs', userId), {
        userId,
        positions,
        updatedAt: new Date().toISOString()
      });
      alert('Posições salvas com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar posições:', error);
      alert('Erro ao salvar posições. Tente novamente.');
    } finally {
      setIsSavingPositions(false);
    }
  };

  const resetPositions = () => {
    if (confirm('Deseja realmente restaurar as posições originais?')) {
      setPositions(DEFAULT_POSITIONS);
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
      // Ensure fonts are loaded before generation
      try {
        await document.fonts.load('16px "Dancing Script"');
        const font = new FontFace('Dancing Script', 'url(https://fonts.gstatic.com/s/dancingscript/v25/If2cXTr6fe34-3S3SM1uQ_Lp.woff2)');
        await font.load();
        document.fonts.add(font);
      } catch (e) {
        console.warn('Erro ao carregar fonte para PDF:', e);
      }
      await document.fonts.ready;
      await new Promise(resolve => setTimeout(resolve, 500));

      const response = await fetch('/S-302_T.pdf');
      if (!response.ok) {
        throw new Error('Erro ao carregar o modelo PDF S-302-T');
      }
      const pdfBytes = await response.arrayBuffer();
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const pages = pdfDoc.getPages();
      const firstPage = pages[0];
      
      // Force A5 Landscape (210mm x 148mm)
      const mmToPt = 2.83465;
      const pageWidth = 210 * mmToPt;
      const pageHeight = 148 * mmToPt;
      firstPage.setSize(pageWidth, pageHeight);
      
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

      // Coordinates for S-302-T
      const fullCongName = (congregacao.cidade && congregacao.cidade.trim().toLowerCase() !== congregacao.nome.trim().toLowerCase())
        ? `${congregacao.nome}, ${congregacao.cidade}` 
        : congregacao.nome;
      
      // Use custom positions
      
      // Congregação
      drawText(fullCongName, positions.congregacao.x * mmToPt, positions.congregacao.y * mmToPt + (6 * mmToPt), 11, true);

      // Visitante
      const visitorName = substituteName ? `${substituteName} (SCS)` : (personalData?.nome || '');
      
      // Lógica de redução de fonte para caber em 60mm
      const maxWidthPt = 60 * mmToPt;
      let visitorFontSize = 11;
      let textWidth = boldFont.widthOfTextAtSize(visitorName, visitorFontSize);
      
      while (textWidth > maxWidthPt && visitorFontSize > 6) {
        visitorFontSize -= 0.5;
        textWidth = boldFont.widthOfTextAtSize(visitorName, visitorFontSize);
      }
      
      drawText(visitorName, positions.visitante.x * mmToPt, positions.visitante.y * mmToPt + (6 * mmToPt), visitorFontSize, true);

      // Data da Visita
      drawText(data, positions.data.x * mmToPt, positions.data.y * mmToPt + (6 * mmToPt), 11, true);

      // Assinatura
      if (signatureImage) {
        try {
          const imageBytes = await fetch(signatureImage).then(res => res.arrayBuffer());
          let embeddedImage;
          if (signatureImage.includes('png')) {
            embeddedImage = await pdfDoc.embedPng(imageBytes);
          } else {
            embeddedImage = await pdfDoc.embedJpg(imageBytes);
          }
          
          const targetHeight = 11 * mmToPt;
          const targetWidth = (embeddedImage.width / embeddedImage.height) * targetHeight;
          
          firstPage.drawImage(embeddedImage, {
            x: positions.assinatura.x * mmToPt,
            y: height - (positions.assinatura.y * mmToPt + (15 * mmToPt)), // Mirror vertical
            width: targetWidth,
            height: targetHeight,
          });
        } catch (e) {
          console.error('Erro ao processar imagem da assinatura:', e);
          await captureSignature();
        }
      } else {
        await captureSignature();
      }

      async function captureSignature() {
        const sigElement = document.getElementById('s302-signature');
        if (!sigElement) return;

        try {
          // Temporarily hide controls
          const controls = sigElement.querySelector('.absolute');
          if (controls) (controls as HTMLElement).style.display = 'none';

          // Small delay to ensure rendering is complete after font load
          await new Promise(resolve => setTimeout(resolve, 200));

          const dataUrl = await toPng(sigElement, {
            backgroundColor: undefined,
            pixelRatio: 2,
            quality: 1,
            style: {
              background: 'transparent'
            }
          });

          if (controls) (controls as HTMLElement).style.display = '';

          const imageBytes = await fetch(dataUrl).then(res => res.arrayBuffer());
          const embeddedImage = await pdfDoc.embedPng(imageBytes);
          
          const targetHeight = 14 * mmToPt; 
          const targetWidth = (embeddedImage.width / embeddedImage.height) * targetHeight;
          
          firstPage.drawImage(embeddedImage, {
            x: positions.assinatura.x * mmToPt,
            y: height - (positions.assinatura.y * mmToPt + (15 * mmToPt)), 
            width: targetWidth,
            height: targetHeight,
          });
        } catch (e) {
          console.error('Erro ao capturar assinatura via html-to-image:', e);
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
      </div>

      <div className="max-w-4xl mx-auto p-4 space-y-6">
        {/* Info Card */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden"
        >
          <div className="bg-[#512da8] p-4 text-white flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center bg-white/10 rounded-xl p-1 gap-1 w-full sm:w-auto justify-between sm:justify-start">
              <button 
                onClick={() => setCurrentIndex(initialIndex)}
                className="px-3 py-1.5 rounded-lg text-[10px] font-bold hover:bg-white/20 transition-colors uppercase"
                title="Voltar ao evento selecionado originalmente"
              >
                Início
              </button>
              
              <div className="w-px h-4 bg-white/20 mx-1" />

              <button
                onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                disabled={currentIndex === 0}
                className="p-1.5 rounded-lg hover:bg-white/20 transition-all text-white disabled:opacity-30 disabled:cursor-not-allowed"
                title="Anterior"
              >
                <ChevronsLeft size={18} />
              </button>
              
              <div className="w-px h-4 bg-white/20 mx-1" />

              <div className="px-4 flex flex-col items-center min-w-[100px]">
                <span className="text-[9px] text-white/60 font-bold uppercase tracking-widest leading-none mb-0.5">
                  Evento
                </span>
                <span className="text-sm font-bold leading-none">
                  {currentIndex + 1} <span className="text-white/30 font-medium mx-1">/</span> {events.length}
                </span>
              </div>

              <div className="w-px h-4 bg-white/20 mx-1" />

              <button
                onClick={() => setCurrentIndex(prev => Math.min(events.length - 1, prev + 1))}
                disabled={currentIndex === events.length - 1}
                className="p-1.5 rounded-lg hover:bg-white/20 transition-all text-white disabled:opacity-30 disabled:cursor-not-allowed"
                title="Próximo"
              >
                <ChevronsRight size={18} />
              </button>
            </div>

            <div className="flex gap-2 shrink-0">
              <button 
                onClick={handleSavePositions}
                disabled={isSavingPositions}
                className="bg-emerald-600 text-white px-4 py-1.5 rounded-lg font-bold text-sm hover:bg-emerald-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                title="Salvar posições dos campos"
              >
                {isSavingPositions ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                SALVAR POSIÇÕES
              </button>
              <button 
                onClick={resetPositions}
                className="bg-white/20 text-white px-4 py-1.5 rounded-lg font-bold text-sm hover:bg-white/30 transition-colors flex items-center gap-2"
                title="Restaurar posições originais"
              >
                <RotateCcw size={16} />
                RESETAR
              </button>
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
              ref={containerRef}
              className="bg-white shadow-2xl print:shadow-none min-w-[210mm] w-[210mm] h-[148mm] relative font-serif-document text-black border border-gray-200 print:border-none shrink-0 overflow-hidden"
              style={{ 
                backgroundImage: 'url(/S302.png)',
                backgroundSize: '100% 100%',
                backgroundRepeat: 'no-repeat'
              }}
            >
              <div className="absolute inset-0 pointer-events-none print:hidden opacity-20 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px]"></div>

              {/* Congregação */}
              <motion.div 
                drag
                dragMomentum={false}
                dragConstraints={containerRef}
                onDragEnd={(_, info) => {
                  setPositions(prev => ({
                    ...prev,
                    congregacao: { x: prev.congregacao.x + info.offset.x / (containerRef.current?.offsetWidth! / 210), y: prev.congregacao.y + info.offset.y / (containerRef.current?.offsetHeight! / 148) }
                  }));
                }}
                style={{
                  position: 'absolute',
                  left: `${positions.congregacao.x}mm`,
                  top: `${positions.congregacao.y}mm`,
                  width: '160mm',
                  height: '8mm'
                }}
                className="flex items-end cursor-move group"
              >
                <div className="absolute -left-6 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity print:hidden">
                  <GripVertical size={16} className="text-gray-400" />
                </div>
                <div className="flex-1 font-bold text-[15pt] px-3 pb-0.5 flex items-end overflow-hidden whitespace-nowrap">
                  {fullCongName}
                </div>
              </motion.div>

              {/* Visitante */}
              <motion.div 
                drag
                dragMomentum={false}
                dragConstraints={containerRef}
                onDragEnd={(_, info) => {
                  setPositions(prev => ({
                    ...prev,
                    visitante: { x: prev.visitante.x + info.offset.x / (containerRef.current?.offsetWidth! / 210), y: prev.visitante.y + info.offset.y / (containerRef.current?.offsetHeight! / 148) }
                  }));
                }}
                style={{
                  position: 'absolute',
                  left: `${positions.visitante.x}mm`,
                  top: `${positions.visitante.y}mm`,
                  width: '160mm',
                  height: '8mm'
                }}
                className="flex items-end cursor-move group"
              >
                <div className="absolute -left-6 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity print:hidden">
                  <GripVertical size={16} className="text-gray-400" />
                </div>
                <div className="flex-1 font-bold text-[15pt] px-3 pb-0.5 flex items-end overflow-hidden whitespace-nowrap">
                  {visitorName}
                </div>
              </motion.div>

              {/* Data da Visita */}
              <motion.div 
                drag
                dragMomentum={false}
                dragConstraints={containerRef}
                onDragEnd={(_, info) => {
                  setPositions(prev => ({
                    ...prev,
                    data: { x: prev.data.x + info.offset.x / (containerRef.current?.offsetWidth! / 210), y: prev.data.y + info.offset.y / (containerRef.current?.offsetHeight! / 148) }
                  }));
                }}
                style={{
                  position: 'absolute',
                  left: `${positions.data.x}mm`,
                  top: `${positions.data.y}mm`,
                  width: '160mm',
                  height: '8mm'
                }}
                className="flex items-end cursor-move group"
              >
                <div className="absolute -left-6 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity print:hidden">
                  <GripVertical size={16} className="text-gray-400" />
                </div>
                <div className="flex-1 font-bold text-[15pt] px-3 pb-0.5 flex items-end overflow-hidden whitespace-nowrap">
                  {data}
                </div>
              </motion.div>

              {/* Assinatura Field */}
              <motion.div 
                drag
                dragMomentum={false}
                dragConstraints={containerRef}
                onDragEnd={(_, info) => {
                  setPositions(prev => ({
                    ...prev,
                    assinatura: { x: prev.assinatura.x + info.offset.x / (containerRef.current?.offsetWidth! / 210), y: prev.assinatura.y + info.offset.y / (containerRef.current?.offsetHeight! / 148) }
                  }));
                }}
                id="s302-signature"
                style={{
                  position: 'absolute',
                  left: `${positions.assinatura.x}mm`,
                  top: `${positions.assinatura.y}mm`,
                  width: '80mm'
                }}
                className="flex flex-col items-center cursor-move group"
              >
                <div className="absolute -left-6 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity print:hidden">
                  <GripVertical size={16} className="text-gray-400" />
                </div>
                <div className="w-full relative flex flex-col items-center">
                  <div className="absolute -right-12 top-0 flex flex-col gap-2 print:hidden opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="p-1.5 bg-white shadow-md rounded-full text-[#512da8] hover:bg-gray-50 border border-gray-100"
                      title="Alterar Assinatura"
                    >
                      <Upload size={14} />
                    </button>
                    <input 
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </div>

                  <div className="h-14 w-full relative mb-1 flex items-center justify-center">
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
                  <span className="mt-1 text-[11pt] font-bold uppercase tracking-tight text-center">
                    {personalData?.nome || ''}
                  </span>
                </div>
              </motion.div>
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
            pode ser necessário ajustar as coordenadas de impressão.
          </p>
        </div>
      </div>
    </div>
  );
}
