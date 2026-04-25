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
  Trash2
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
  }, [userId]);

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

      // Coordinates for S-302-T (Corrected based on user feedback)
      // 1. Congregação: direita 2mm (em relação aos 5mm anteriores = 7mm), elevar 10mm
      const fullCongName = (congregacao.cidade && congregacao.cidade.trim().toLowerCase() !== congregacao.nome.trim().toLowerCase())
        ? `${congregacao.nome}, ${congregacao.cidade}` 
        : congregacao.nome;
      drawText(fullCongName, 100 + (7 * mmToPt), 145 - (10 * mmToPt), 11, true);

      // 2. Visitante: direita 10mm (em relação aos 10mm anteriores = 20mm), descer 2mm (em relação à elevação de 18mm = elevar 16mm)
      // Agora mais 5mm para a direita = 25mm. Depois mais 3mm = 28mm
      const visitorName = substituteName ? `${substituteName} (SCS)` : (personalData?.nome || '');
      
      // Lógica de redução de fonte para caber em 60mm
      const maxWidthPt = 60 * mmToPt;
      let visitorFontSize = 11;
      let textWidth = boldFont.widthOfTextAtSize(visitorName, visitorFontSize);
      
      while (textWidth > maxWidthPt && visitorFontSize > 6) {
        visitorFontSize -= 0.5;
        textWidth = boldFont.widthOfTextAtSize(visitorName, visitorFontSize);
      }
      
      drawText(visitorName, 100 + (28 * mmToPt), 185 - (16 * mmToPt), visitorFontSize, true);

      // 3. Data da Visita: direita 2mm (em relação aos 5mm anteriores = 7mm), descer 2mm (em relação à elevação de 25mm = elevar 23mm)
      // Histórico: Turno 9 (21mm) -> Turno 10 (subir 0,5mm = 21,5mm) -> Turno 11 (subir 0,5mm = 22mm)
      drawText(data, 100 + (7 * mmToPt), 225 - (22.0 * mmToPt), 11, true);

      // 4. Assinatura: direita 3mm (em relação aos 10mm anteriores = 13mm), descer 3mm (em relação à posição anterior = 225 - 7mm)
      // Histórico: Turno 9 (5mm) -> Turno 10 (subir 0,5mm = 5,5mm) -> Turno 11 (subir 0,5mm = 6mm)
      // Usar a mesma fonte (Dancing Script) e cor azul (#004aad) da carta de designação
      
      if (signatureImage) {
        try {
          const imageBytes = await fetch(signatureImage).then(res => res.arrayBuffer());
          let embeddedImage;
          if (signatureImage.includes('png')) {
            embeddedImage = await pdfDoc.embedPng(imageBytes);
          } else {
            embeddedImage = await pdfDoc.embedJpg(imageBytes);
          }
          
          const targetHeight = 9 * mmToPt;
          const targetWidth = (embeddedImage.width / embeddedImage.height) * targetHeight;
          
          firstPage.drawImage(embeddedImage, {
            x: 100 + (13 * mmToPt),
            y: height - (225 - (6.0 * mmToPt)) - (targetHeight / 2),
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
          
          const targetHeight = 11 * mmToPt; // Slightly larger because it includes the name below
          const targetWidth = (embeddedImage.width / embeddedImage.height) * targetHeight;
          
          firstPage.drawImage(embeddedImage, {
            x: 100 + (13 * mmToPt),
            y: height - (225 - (6.0 * mmToPt)) - (targetHeight / 2),
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
              style={{ 
                backgroundImage: 'url(/S302.png)',
                backgroundSize: '100% 100%',
                backgroundRepeat: 'no-repeat'
              }}
            >
              <div className="absolute top-[48mm] left-[25mm] right-[25mm] space-y-[4.5mm]">
                <div className="pt-[6mm] space-y-[8mm]">
                  <div className="flex items-end gap-2 h-[8mm]">
                    <div className="flex-1 border-b border-black border-dotted font-bold text-[15pt] px-3 pb-0.5 flex items-end overflow-hidden whitespace-nowrap">
                      {fullCongName}
                    </div>
                  </div>

                  <div className="flex items-end gap-2 h-[8mm]">
                    <div className="flex-1 border-b border-black border-dotted font-bold text-[15pt] px-3 pb-0.5 flex items-end overflow-hidden whitespace-nowrap">
                      {visitorName}
                    </div>
                  </div>

                  <div className="flex items-end gap-2 h-[8mm]">
                    <div className="flex-1 border-b border-black border-dotted font-bold text-[15pt] px-3 pb-0.5 flex items-end overflow-hidden whitespace-nowrap">
                      {data}
                    </div>
                  </div>
                </div>
              </div>

              <div className="absolute bottom-[25mm] right-[25mm] w-[80mm] flex flex-col items-center">
                <div className="w-full relative flex flex-col items-center group">
                  <div className="absolute -left-12 top-0 flex flex-col gap-2 print:hidden opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="p-1.5 bg-white shadow-md rounded-full text-[#512da8] hover:bg-gray-50 border border-gray-100"
                      title="Alterar Assinatura"
                    >
                      <Upload size={14} />
                    </button>
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
                  <div className="w-full border-b border-black border-dotted"></div>
                  <span className="mt-1 text-[11pt] font-bold uppercase tracking-tight text-center">
                    {personalData?.nome || ''}
                  </span>
                </div>
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
            pode ser necessário ajustar as coordenadas de impressão.
          </p>
        </div>
      </div>
    </div>
  );
}
