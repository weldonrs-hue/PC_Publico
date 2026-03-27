'use client';

import { useState, useEffect, useRef } from 'react';
import { 
  ChevronLeft, 
  Save, 
  Loader2,
  Printer,
  FileDown
} from 'lucide-react';
import { motion } from 'motion/react';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '@/utils/firestore';

interface S303ReportViewProps {
  userId: string;
  congregation: {
    nome: string;
    numero: string;
    cidade: string;
    estado: string;
  };
  visitDate: string;
  onBack: () => void;
}

export default function S303ReportView({ userId, congregation, visitDate, onBack }: S303ReportViewProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reportText, setReportText] = useState('');
  const [initialReportText, setInitialReportText] = useState('');
  const [reportFontSize, setReportFontSize] = useState(14);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [personalData, setPersonalData] = useState<any>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const isDirty = reportText !== initialReportText;

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch personal data
        const pdRef = doc(db, 'personal_data', userId);
        const pdSnap = await getDoc(pdRef);
        if (pdSnap.exists()) {
          setPersonalData(pdSnap.data());
        } else {
          // Fallback
          const q = query(collection(db, 'personal_data'), where('userId', '==', userId), limit(1));
          const snap = await getDocs(q);
          if (!snap.empty) {
            setPersonalData(snap.docs[0].data());
          }
        }

        // Fetch existing report
        const reportId = `${userId}_${congregation.nome}_${visitDate.replace(/\//g, '-')}`;
        const reportRef = doc(db, 's303_reports', reportId);
        const reportSnap = await getDoc(reportRef);
        if (reportSnap.exists()) {
          const text = reportSnap.data().relatorio || '';
          setReportText(text);
          setInitialReportText(text);
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, 's303_report');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [userId, congregation.nome, visitDate]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const adjustFontSize = () => {
      // Check for overflow
      if (textarea.scrollHeight > textarea.clientHeight) {
        if (reportFontSize > 8) {
          // Shrink more aggressively if overflow is large
          const overflowRatio = textarea.scrollHeight / textarea.clientHeight;
          const step = overflowRatio > 1.2 ? 0.5 : 0.2;
          setReportFontSize(prev => Math.max(8, prev - step));
        }
      } else if (reportFontSize < 14) {
        // Grow back if there's enough space
        // We use a small buffer (5px) to avoid flickering
        // If we have more than 10px of space, we can try to grow
        if (textarea.clientHeight - textarea.scrollHeight > 10) {
          setReportFontSize(prev => Math.min(14, prev + 0.3));
        }
      }
    };

    // Use requestAnimationFrame to ensure DOM is updated before measuring
    const timeoutId = setTimeout(adjustFontSize, 10);
    return () => clearTimeout(timeoutId);
  }, [reportText, reportFontSize]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    const textarea = textareaRef.current;
    
    if (textarea) {
      // Temporary update to check overflow at min font size
      if (reportFontSize <= 8 && textarea.scrollHeight > textarea.clientHeight && newText.length > reportText.length) {
        // Don't allow more text if we're at min font and overflowing
        return;
      }
    }
    
    setReportText(newText);
  };

  const handleSave = async (shouldExit = false) => {
    setSaving(true);
    try {
      const reportId = `${userId}_${congregation.nome}_${visitDate.replace(/\//g, '-')}`;
      await setDoc(doc(db, 's303_reports', reportId), {
        userId,
        congregacao: congregation.nome,
        dataVisita: visitDate,
        relatorio: reportText,
        updatedAt: new Date().toISOString()
      });
      setInitialReportText(reportText);
      if (shouldExit) {
        onBack();
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 's303_report_save');
    } finally {
      setSaving(false);
      setShowConfirmDialog(false);
    }
  };

  const handleBack = () => {
    if (isDirty) {
      setShowConfirmDialog(true);
    } else {
      onBack();
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleSavePDF = async () => {
    const element = document.getElementById('s303-report-container');
    if (!element) return;

    const filename = `S-303 - ${congregation.nome} - ${visitDate.replace(/\//g, '-')}.pdf`;

    try {
      const { toPng } = await import('html-to-image');
      const { jsPDF } = await import('jspdf');

      const dataUrl = await toPng(element, {
        quality: 1.0,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
      });

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const imgProps = pdf.getImageProperties(dataUrl);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

      pdf.addImage(dataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(filename);
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
    }
  };

  const handleFillOriginalPDF = async () => {
    try {
      const { PDFDocument, rgb, StandardFonts } = await import('pdf-lib');
      
      // Fetch the original PDF
      const existingPdfBytes = await fetch('/S-303.pdf').then(res => res.arrayBuffer());
      
      // Load the PDF
      const pdfDoc = await PDFDocument.load(existingPdfBytes);
      const pages = pdfDoc.getPages();
      const firstPage = pages[0];
      const { width, height } = firstPage.getSize();

      // Use a standard font
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const fontSize = 10;

      // Helper to draw text
      const draw = (text: string, x: number, y: number, isBold = false) => {
        if (!text) return;
        firstPage.drawText(text, {
          x,
          y: height - y, // Convert from top-left to bottom-left
          size: fontSize,
          font: isBold ? boldFont : font,
          color: rgb(0, 0, 0),
        });
      };

      // Coordinates (estimated in points from top-left)
      // Elevating by 23mm (Net result after elevating 20mm and raising 3mm)
      const yOffset = 65.2;
      const xOffset = 5.67; // 2mm general left shift
      
      const yOffsetRow1 = 1.42; // +0.5mm
      const yOffsetRow2 = 4.25; // 0.5mm (prev) + 1mm (new) = 1.5mm total
      const yOffsetRow3 = 5.66; // 1mm (prev) + 1mm (new) = 2mm total
      
      const xOffsetReport = 8.5; // 3mm left shift for report
      const yOffsetReport = 5.67; // 2mm up shift for report

      // Row 1
      draw(congregation.numero, 145 - xOffset, 128 - yOffset - yOffsetRow1, true);
      draw(visitDate, 415 - xOffset, 128 - yOffset - yOffsetRow1, true);

      // Row 2
      draw(congregation.nome, 145 - xOffset, 153 - yOffset - yOffsetRow2, true);
      draw(congregation.cidade, 335 - xOffset, 153 - yOffset - yOffsetRow2, true);
      draw(congregation.estado, 525 - xOffset, 153 - yOffset - yOffsetRow2, true);

      // Row 3
      draw(personalData?.nome || '', 110 - xOffset, 178 - yOffset - yOffsetRow3, true);
      draw(personalData?.circuito || '', 385 - xOffset, 178 - yOffset - yOffsetRow3, true);

      // Report Text (with wrapping and newline support)
      const maxWidth = 500;
      const startX = 60 - xOffset - xOffsetReport;
      const startY = 225 - yOffset - yOffsetReport;
      const lineHeight = 14;
      
      const paragraphs = reportText.split('\n');
      let currentY = startY;

      for (const paragraph of paragraphs) {
        const words = paragraph.split(' ');
        let line = '';

        for (const word of words) {
          const testLine = line + word + ' ';
          const testWidth = font.widthOfTextAtSize(testLine, fontSize);
          if (testWidth > maxWidth) {
            draw(line, startX, currentY);
            line = word + ' ';
            currentY += lineHeight;
          } else {
            line = testLine;
          }
        }
        draw(line, startX, currentY);
        currentY += lineHeight; // Extra space for paragraph
      }

      // Serialize the PDF to bytes (a Uint8Array)
      const pdfBytes = await pdfDoc.save();

      // Trigger download
      const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `S-303_Preenchido_${congregation.nome}.pdf`;
      link.click();
      URL.revokeObjectURL(url);

    } catch (error) {
      console.error('Erro ao preencher PDF original:', error);
      // Fallback to the HTML-to-PDF if something fails
      handleSavePDF();
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="animate-spin text-[#512da8] mb-4" size={48} />
        <p className="text-gray-500 font-medium">Carregando relatório...</p>
      </div>
    );
  }

  return (
    <div className="space-y-[15mm] w-full px-[15mm] pb-[15mm] flex flex-col items-center">
      <div className="flex items-center justify-between print:hidden bg-white/80 backdrop-blur-md p-4 rounded-2xl sticky top-0 z-10 border border-gray-100 shadow-sm w-full max-w-[1300px]">
        <div className="flex items-center gap-4">
          <button 
            onClick={handleBack}
            className="p-2 hover:bg-gray-100 rounded-full transition-all text-[#512da8] bg-white shadow-sm border border-gray-200"
          >
            <ChevronLeft size={24} strokeWidth={2.5} />
          </button>
          <div>
            <h2 className="text-xl font-bold text-gray-900 leading-tight">S-303 Relatório</h2>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">{congregation.nome} • {visitDate}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={handleFillOriginalPDF}
            className="bg-white text-gray-700 border border-gray-200 px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-gray-50 transition-all shadow-sm"
          >
            <FileDown size={16} />
            <span className="hidden sm:inline">PDF Original</span>
          </button>
          <button 
            onClick={handlePrint}
            className="bg-white text-gray-700 border border-gray-200 px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-gray-50 transition-all shadow-sm"
          >
            <Printer size={16} />
            <span className="hidden sm:inline">Imprimir</span>
          </button>
        </div>
      </div>

      <div className="bg-white shadow-xl rounded-lg overflow-hidden border border-gray-200 print:shadow-none print:border-none w-full max-w-[1300px]">
        <div 
          id="s303-report-container" 
          className="bg-white w-full min-h-[148mm] mx-auto text-black print:m-0 flex flex-col"
          style={{ 
            fontFamily: "'Arimo', Arial, Helvetica, sans-serif",
            padding: '12mm 15mm'
          }}
        >
          <header className="mb-6">
            <h1 className="text-center font-bold text-[15px] uppercase tracking-wide">
              RELATÓRIO SOBRE A VISITA DO SUPERINTENDENTE DE CIRCUITO À CONGREGAÇÃO
            </h1>
          </header>

          <section className="flex flex-col flex-grow">
            {/* Row 1 */}
            <div className="flex items-baseline mb-[0.8rem]">
              <label className="text-[13px] whitespace-nowrap">Número da congregação:</label>
              <div className="border-b border-black flex-[0.7] h-[1.2rem] ml-[0.4rem] px-2 text-[13px] font-medium">
                {congregation.numero}
              </div>
              <label className="text-[13px] whitespace-nowrap ml-4">Datas em que visitou:</label>
              <div className="border-b border-black flex-1 h-[1.2rem] ml-[0.4rem] px-2 text-[13px] font-medium">
                {visitDate}
              </div>
            </div>

            {/* Row 2 */}
            <div className="flex items-baseline mb-[0.8rem]">
              <label className="text-[13px] whitespace-nowrap">Nome da congregação:</label>
              <div className="border-b border-black flex-[0.8] h-[1.2rem] ml-[0.4rem] px-2 text-[13px] font-medium">
                {congregation.nome}
              </div>
              <label className="text-[13px] whitespace-nowrap ml-4">Cidade:</label>
              <div className="border-b border-black flex-[0.6] h-[1.2rem] ml-[0.4rem] px-2 text-[13px] font-medium">
                {congregation.cidade}
              </div>
              <label className="text-[13px] whitespace-nowrap ml-4">Província ou estado:</label>
              <div className="border-b border-black flex-[0.2] h-[1.2rem] ml-[0.4rem] px-2 text-[13px] font-medium">
                {congregation.estado}
              </div>
            </div>

            {/* Row 3 */}
            <div className="flex items-baseline mb-[0.8rem]">
              <label className="text-[13px] whitespace-nowrap">Sup. de circuito:</label>
              <div className="border-b border-black flex-[0.8] h-[1.2rem] ml-[0.4rem] px-2 text-[13px] font-medium">
                {personalData?.nome || ''}
              </div>
              <label className="text-[13px] whitespace-nowrap ml-4">Número do circuito:</label>
              <div className="border-b border-black flex-[0.6] h-[1.2rem] ml-[0.4rem] px-2 text-[13px] font-medium">
                {personalData?.circuito || ''}
              </div>
            </div>

            {/* Bold Divider */}
            <div className="border-t-2 border-black mt-1 mb-3"></div>

            {/* Description Label */}
            <p className="text-[13px] mt-[0.5rem] mb-[0.5rem]">
              Descreva brevemente o espírito da congregação e que encorajamento ou conselhos foram dados:
            </p>

            <div className="relative flex-grow">
              <textarea 
                ref={textareaRef}
                value={reportText}
                onChange={handleTextChange}
                className="w-full h-[58mm] p-0 border-none font-sans leading-[1.6] focus:outline-none focus:ring-0 print:hidden resize-none bg-transparent overflow-hidden"
                placeholder="Digite o relatório aqui..."
                style={{ 
                  fontFamily: "'Arimo', Arial, Helvetica, sans-serif",
                  fontSize: `${reportFontSize}px`
                }}
              />
              <div 
                className="hidden print:block whitespace-pre-wrap leading-[1.6] h-[58mm] overflow-hidden"
                style={{ 
                  fontFamily: "'Arimo', Arial, Helvetica, sans-serif",
                  fontSize: `${reportFontSize}px`
                }}
              >
                {reportText}
              </div>
            </div>
          </section>

          <footer className="mt-auto">
            <div className="text-[10.5px] line-height-[1.35] text-justify">
              (Antes de terminar a visita à congregação no domingo, e numa hora que não interfira na programação de serviço de campo, 
              considere este relatório com a comissão de serviço da congregação. Deixe uma cópia com o coordenador do corpo de anciãos 
              para que todos os anciãos a leiam e para que a recapitulem na próxima reunião trimestral dos anciãos.)
            </div>
            <div className="text-[15px] mt-4">
              S-303-T 1/25
            </div>
          </footer>
        </div>
      </div>

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full border border-gray-100"
          >
            <h3 className="text-2xl font-bold text-gray-900 mb-2">Salvar alterações?</h3>
            <p className="text-gray-600 mb-8 leading-relaxed">
              Você fez alterações no relatório. Deseja salvar antes de sair?
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => handleSave(true)}
                disabled={saving}
                className="w-full bg-[#512da8] text-white py-4 rounded-2xl font-bold text-lg hover:bg-[#4527a0] transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-100"
              >
                {saving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                Sim, salvar e sair
              </button>
              <button
                onClick={onBack}
                className="w-full bg-gray-50 text-gray-700 py-4 rounded-2xl font-bold text-lg hover:bg-gray-100 transition-all border border-gray-200"
              >
                Sair sem salvar
              </button>
              <button
                onClick={() => setShowConfirmDialog(false)}
                className="w-full text-gray-400 py-2 font-medium hover:text-gray-600 transition-all"
              >
                Cancelar
              </button>
            </div>
          </motion.div>
        </div>
      )}

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&display=swap');

        .font-serif {
          font-family: 'Libre Baskerville', serif !important;
        }

        @media print {
          @page {
            margin: 0;
            size: A4;
          }
          body {
            background-color: white !important;
          }
          .print\:hidden {
            display: none !important;
          }
          textarea {
            border: none !important;
            resize: none !important;
            overflow: visible !important;
          }
        }
      `}</style>
    </div>
  );
}
