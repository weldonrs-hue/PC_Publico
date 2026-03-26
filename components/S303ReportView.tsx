'use client';

import { useState, useEffect } from 'react';
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
  const [personalData, setPersonalData] = useState<any>(null);

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
          setReportText(reportSnap.data().relatorio || '');
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, 's303_report');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [userId, congregation.nome, visitDate]);

  const handleSave = async () => {
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
      // Success feedback can be added here if needed, avoiding alert()
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 's303_report_save');
    } finally {
      setSaving(false);
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

      // Helper to draw centered text with auto-scaling
      const drawCentered = (text: string, startX: number, width: number, y: number, isBold = false) => {
        if (!text) return;
        let currentFontSize = fontSize;
        let textWidth = (isBold ? boldFont : font).widthOfTextAtSize(text, currentFontSize);
        
        // Auto-scale
        while (textWidth > width && currentFontSize > 5) {
          currentFontSize -= 0.5;
          textWidth = (isBold ? boldFont : font).widthOfTextAtSize(text, currentFontSize);
        }
        
        const x = startX + (width - textWidth) / 2;
        firstPage.drawText(text, {
          x,
          y: height - y,
          size: currentFontSize,
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

      // Space widths in points (1mm = 2.83465 pts)
      const w60 = 170.08;
      const w80 = 226.77;
      const w65 = 184.25;
      const w15 = 42.52;
      const w77 = 218.27;

      // Row 1
      drawCentered(congregation.numero, 145 - xOffset, w60, 128 - yOffset - yOffsetRow1, true);
      drawCentered(visitDate, 415 - xOffset, w80, 128 - yOffset - yOffsetRow1, true);

      // Row 2
      drawCentered(congregation.nome, 145 - xOffset, w65, 153 - yOffset - yOffsetRow2, true);
      drawCentered(congregation.cidade, 335 - xOffset, w60, 153 - yOffset - yOffsetRow2, true);
      drawCentered(congregation.estado, 525 - xOffset, w15, 153 - yOffset - yOffsetRow2, true);

      // Row 3
      drawCentered(personalData?.nome || '', 110 - xOffset, w77, 178 - yOffset - yOffsetRow3, true);
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
    <div className="space-y-6">
      <style jsx global>{`
        @media print {
          @page {
            size: landscape;
            margin: 0;
          }
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
        }
      `}</style>

      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-2 hover:bg-gray-100 rounded-full transition-all text-[#512da8] bg-white shadow-md border border-gray-200"
          >
            <ChevronLeft size={28} strokeWidth={3} />
          </button>
          <h2 className="text-2xl font-bold text-gray-800">S-303 Relatório sobre a visita</h2>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={handleSave}
            disabled={saving}
            className="bg-[#512da8] text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-[#4527a0] transition-all disabled:opacity-50"
          >
            {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
            Salvar
          </button>
          <button 
            onClick={handleFillOriginalPDF}
            className="bg-white text-gray-700 border border-gray-200 px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-gray-50 transition-all"
          >
            <FileDown size={18} />
            PDF Original
          </button>
          <button 
            onClick={handlePrint}
            className="bg-white text-gray-700 border border-gray-200 px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-gray-50 transition-all"
          >
            <Printer size={18} />
            Imprimir
          </button>
        </div>
      </div>

      <div className="bg-white shadow-xl rounded-2xl overflow-x-auto border border-gray-200 print:shadow-none print:border-none print:overflow-visible">
        <div id="s303-report-container" className="p-[15mm] bg-white w-[297mm] min-h-[210mm] mx-auto text-black font-serif leading-tight print:p-[15mm] print:m-0 shadow-2xl print:shadow-none relative">
          <h1 className="text-center text-[18px] font-bold mb-[10mm] uppercase tracking-tight">
            RELATÓRIO SOBRE A VISITA DO SUPERINTENDENTE DE CIRCUITO À CONGREGAÇÃO
          </h1>

          <div className="space-y-[6mm] text-[13px]">
            {/* Row 1 */}
            <div className="flex items-end gap-[2mm]">
              <span className="whitespace-nowrap">Número da congregação:</span>
              <div className="flex-[0.4] border-b border-black pb-0.5 px-2 font-sans font-medium min-w-[50mm]">
                {congregation.numero}
              </div>
              <span className="whitespace-nowrap ml-[4mm]">Datas em que visitou:</span>
              <div className="flex-[0.6] border-b border-black pb-0.5 px-2 font-sans font-medium">
                {visitDate}
              </div>
            </div>

            {/* Row 2 */}
            <div className="flex items-end gap-[2mm]">
              <span className="whitespace-nowrap">Nome da congregação:</span>
              <div className="flex-[0.45] border-b border-black pb-0.5 px-2 font-sans font-medium">
                {congregation.nome}
              </div>
              <span className="whitespace-nowrap ml-[4mm]">Cidade:</span>
              <div className="flex-[0.35] border-b border-black pb-0.5 px-2 font-sans font-medium">
                {congregation.cidade}
              </div>
              <span className="whitespace-nowrap ml-[4mm]">Província ou estado:</span>
              <div className="flex-[0.2] border-b border-black pb-0.5 px-2 font-sans font-medium">
                {congregation.estado}
              </div>
            </div>

            {/* Row 3 */}
            <div className="flex items-end gap-[2mm]">
              <span className="whitespace-nowrap">Sup. de circuito:</span>
              <div className="flex-[0.65] border-b border-black pb-0.5 px-2 font-sans font-medium">
                {personalData?.nome || ''}
              </div>
              <span className="whitespace-nowrap ml-[4mm]">Número do circuito:</span>
              <div className="flex-[0.35] border-b border-black pb-0.5 px-2 font-sans font-medium">
                {personalData?.circuito || ''}
              </div>
            </div>

            {/* Thick Line */}
            <div className="border-t-[1.5pt] border-black pt-[4mm] mt-[2mm]">
              <p className="text-[13px] mb-[4mm]">
                Descreva brevemente o espírito da congregação e que encorajamento ou conselhos foram dados:
              </p>
              <div className="relative">
                <textarea 
                  value={reportText}
                  onChange={(e) => setReportText(e.target.value)}
                  className="w-full min-h-[100mm] p-0 border-none font-serif text-[14px] leading-[1.6] focus:outline-none focus:ring-0 print:hidden resize-none"
                  placeholder="Digite o relatório aqui..."
                />
                <div className="hidden print:block whitespace-pre-wrap font-serif text-[14px] leading-[1.6] min-h-[100mm]">
                  {reportText}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="pt-[10mm] space-y-[4mm] text-[12px] leading-snug">
              <p>
                (Antes de terminar a visita à congregação no domingo, e numa hora que não interfira na programação de serviço de campo, 
                considere este relatório com a comissão de serviço da congregação. Deixe uma cópia com o coordenador do corpo de anciãos 
                para que todos os anciãos a leiam e para que a recapitulem na próxima reunião trimestral dos anciãos.)
              </p>
              <p className="font-bold text-[11px] pt-[2mm]">
                S-303-T 1/25
              </p>
            </div>
          </div>
        </div>
      </div>

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
