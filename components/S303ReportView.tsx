'use client';

import { useState, useEffect, useRef } from 'react';
import { 
  ChevronLeft, 
  ChevronRight,
  Save, 
  Loader2,
  Printer,
  FileDown,
  Bold,
  Italic,
  Type,
  Palette,
  Plus,
  Minus,
  ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, auth } from '@/lib/firebase';
import { doc, getDoc, setDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '@/utils/firestore';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

interface S303ReportViewProps {
  userId: string;
  congregation: {
    nome: string;
    numero: string;
    cidade: string;
    estado: string;
  };
  visitDate: string;
  substituteName?: string;
  onBack: () => void;
}

export default function S303ReportView({ userId, congregation, visitDate, substituteName, onBack }: S303ReportViewProps) {
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportText, setReportText] = useState('');
  const [initialReportText, setInitialReportText] = useState('');
  const [reportFontSize, setReportFontSize] = useState(16);
  const [fontFamily, setFontFamily] = useState("'Arimo', Arial, Helvetica, sans-serif");
  const [textColor, setTextColor] = useState('#000000');
  const [showToolbar, setShowToolbar] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showFontPicker, setShowFontPicker] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [reportHeight, setReportHeight] = useState(90);
  
  const editableRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [personalData, setPersonalData] = useState<any>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);

  const [showPdfMenu, setShowPdfMenu] = useState(false);
  const pdfMenuRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [showScrollArrows, setShowScrollArrows] = useState(false);

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
      const containerWidth = containerRef.current.offsetWidth;
      
      // A4 landscape width in pixels at 96dpi is ~1123px (297mm)
      const a4WidthPx = 1123;
      
      // Calculate scale to fit the container with some padding
      // Scale up for desktop, but keep at least 1.0 for mobile to allow horizontal scrolling
      const newScale = Math.max(1, Math.min(1.4, (containerWidth - 32) / a4WidthPx));
      setScale(newScale);

      // Check if scroll arrows should be shown
      setShowScrollArrows(containerWidth < a4WidthPx);
    };

    const observer = new ResizeObserver(updateScale);
    if (containerRef.current) observer.observe(containerRef.current);
    updateScale();

    return () => observer.disconnect();
  }, []);

  const isDirty = reportText !== initialReportText;

  const AutoScalingHeaderData = ({ text, baseFontSize = 18 }: { text: string, baseFontSize?: number }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [fontSize, setFontSize] = useState(baseFontSize);

    useEffect(() => {
      if (!containerRef.current) return;
      
      const container = containerRef.current;
      let currentSize = baseFontSize;
      container.style.fontSize = `${currentSize}px`;
      
      // Small delay to allow browser to render and measure
      const timer = setTimeout(() => {
        while (container.scrollWidth > container.clientWidth && currentSize > 8) {
          currentSize -= 0.5;
          container.style.fontSize = `${currentSize}px`;
        }
        setFontSize(currentSize);
      }, 0);
      
      return () => clearTimeout(timer);
    }, [text, baseFontSize]);

    return (
      <div 
        ref={containerRef}
        className="border-b border-black flex-grow h-[1.2em] px-2 font-medium whitespace-nowrap overflow-hidden"
        style={{ fontSize: `${fontSize}px`, lineHeight: '1.2em' }}
      >
        {text}
      </div>
    );
  };

  // Handle clicks outside PDF menu to close it
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
    const handleSelectionChange = () => {
      const selection = window.getSelection();
      const hasSelection = selection && selection.toString().length > 0 && editableRef.current?.contains(selection.anchorNode);
      setShowToolbar(!!hasSelection);
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, []);

  // Sync contentEditable with state on load
  useEffect(() => {
    if (editableRef.current && reportText && !editableRef.current.innerHTML) {
      editableRef.current.innerHTML = reportText;
    }
  }, [loading, reportText]);

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
          setPersonalData(pdSnap.data());
        } else {
          // Fallback
          const q = query(collection(db, 'personal_data'), where('userId', '==', userId), limit(1));
          const snap = await getDocs(q);
          if (!snap.empty) {
            setPersonalData(snap.docs[0].data());
          }
        }

        // Fetch user role to check admin status
        const userRef = doc(db, 'users', userId);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const userData = userSnap.data();
          const adminEmails = ["weldonrs@gmail.com", "2283701@progcir.app", "2283701@progcir.com"];
          const userEmail = userData.email?.toLowerCase();
          setIsAdmin(userData.role === 'admin' || adminEmails.includes(userEmail));
        }

        // Fetch existing report
        const reportId = `${userId}_${congregation.nome}_${visitDate.replace(/\//g, '-')}`;
        const reportRef = doc(db, 's303_reports', reportId);
        const reportSnap = await getDoc(reportRef);
        if (reportSnap.exists()) {
          const data = reportSnap.data();
          const text = data.relatorio || '';
          setReportText(text);
          setInitialReportText(text);
          
          if (data.reportHeight) setReportHeight(data.reportHeight);
          
          if (data.textStyles) {
            if (data.textStyles.fontSize) setReportFontSize(data.textStyles.fontSize);
            // We still keep these for the "default" state if needed, 
            // but rich text will have its own tags
            if (data.textStyles.color) setTextColor(data.textStyles.color);
          }
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
    const editable = editableRef.current;
    if (!editable) return;

    const adjustFontSize = () => {
      const isOverflowing = editable.scrollHeight > editable.clientHeight;
      
      if (isOverflowing) {
        if (reportFontSize > 8) {
          setReportFontSize(prev => Math.max(8, prev - 0.4));
        }
      } else if (reportFontSize < 14) {
        const estimatedLineHeight = reportFontSize * 1.6;
        if (editable.clientHeight - editable.scrollHeight > estimatedLineHeight) {
          setReportFontSize(prev => Math.min(14, prev + 0.4));
        }
      }
    };

    const timeoutId = setTimeout(adjustFontSize, 50);
    return () => clearTimeout(timeoutId);
  }, [reportText, reportFontSize]);

  const handleTextChange = () => {
    if (editableRef.current) {
      setReportText(editableRef.current.innerHTML);
    }
  };

  const execCommand = (command: string, value: string | undefined = undefined) => {
    document.execCommand(command, false, value);
    handleTextChange();
    // Refocus to keep toolbar visible if needed
    editableRef.current?.focus();
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
        reportHeight,
        updatedAt: new Date().toISOString(),
        textStyles: {
          fontSize: reportFontSize,
          color: textColor
        }
      });
      setInitialReportText(reportText);
      if (shouldExit) {
        onBack();
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 's303_report_save');
    } finally {
      setSaving(false);
    }
  };

  const handleBack = async () => {
    if (isDirty) {
      await handleSave(true);
    } else {
      onBack();
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const getFormattedFilename = () => {
    // visitDate is usually "DD/MM/YYYY - DD/MM/YYYY"
    // We want the second date
    let secondDate = visitDate;
    if (visitDate.includes(' - ')) {
      const parts = visitDate.split(' - ');
      secondDate = parts[1] || parts[0];
    }
    return `S-303 (${secondDate}) ${congregation.nome}.pdf`;
  };

  const handleSavePDF = async () => {
    const element = document.getElementById('s303-report-container');
    if (!element) return;

    const filename = getFormattedFilename();

    setGenerating(true);
    try {
      // Use a fixed width/height for capture to ensure margins are preserved
      // 297mm is approx 1122.5px at 96dpi
      const dataUrl = await toPng(element, {
        quality: 1.0,
        pixelRatio: 3, // Higher quality for better text rendering
        backgroundColor: '#ffffff',
        width: 1122.5,
        height: 793.7,
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
        format: 'a4'
      });

      // Apply the 95% scale adjustment as requested by the user
      // This matches the browser's 95% print scale setting
      const scale = 0.95;
      const w = 297 * scale;
      const h = 210 * scale;
      const x = (297 - w) / 2;
      const y = (210 - h) / 2;

      pdf.addImage(dataUrl, 'PNG', x, y, w, h);
      pdf.save(filename);
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
    }
  };

  const handleFillOriginalPDF = async () => {
    setError(null);
    setGenerating(true);
    try {
      // Fetch the original PDF using a more robust path
      const pdfUrl = `${window.location.origin}/S-303.pdf`;
      const response = await fetch(pdfUrl);
      if (!response.ok) {
        throw new Error(`Erro ao baixar o PDF original (${response.status}): Verifique se /public/S-303.pdf existe.`);
      }
      const existingPdfBytes = await response.arrayBuffer();
      
      // Load the PDF
      const pdfDoc = await PDFDocument.load(existingPdfBytes);
      const pages = pdfDoc.getPages();
      const firstPage = pages[0];
      const { width, height } = firstPage.getSize();

      // Use Arial (Helvetica) as requested for the original PDF
      let selectedFont = StandardFonts.Helvetica;

      let fontToUse = selectedFont;
      const font = await pdfDoc.embedFont(fontToUse);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      
      // Convert reportFontSize (px) to PDF points (pt)
      // User requested: Decrease font size by increasing offset to -7
      const fontSize = Math.max(6, reportFontSize - 7);
      const pdfLineHeight = fontSize * 1.4;

      // Convert hex color to RGB
      const hexToRgb = (hex: string) => {
        const r = parseInt(hex.slice(1, 3), 16) / 255;
        const g = parseInt(hex.slice(3, 5), 16) / 255;
        const b = parseInt(hex.slice(5, 7), 16) / 255;
        return rgb(r, g, b);
      };
      const reportColor = hexToRgb(textColor);
      const blackColor = rgb(0, 0, 0);

      // Coordinates (estimated in points from top-left)
      const mmToPt = 2.83465;
      const expansionPt = 4 * mmToPt;

      // Helper to draw header text with auto-scaling
      const drawHeader = (text: string, x: number, y: number, maxWidth: number = 180, overrideSize?: number) => {
        if (!text) return;
        // User requested: if report font is 17, header should be 9 (offset of -8)
        // EXCEPT for specific fields where overrideSize is passed
        let size = overrideSize || Math.max(6, reportFontSize - 8); 
        while (font.widthOfTextAtSize(text, size) > maxWidth && size > 5) {
          size -= 0.5;
        }
        firstPage.drawText(text, {
          x,
          y: height - y,
          size,
          font: font,
          color: blackColor,
        });
      };

      // Helper to draw report text
      const drawReport = (text: string, x: number, y: number, isBoldText = false) => {
        if (!text) return;
        firstPage.drawText(text, {
          x,
          y: height - y,
          size: fontSize,
          font: isBoldText ? boldFont : font,
          color: blackColor, // Forced to black as requested
        });
      };

      // Elevating by 23mm (Net result after elevating 20mm and raising 3mm)
      const yOffset = 65.2;
      const xOffset = 5.67; // 2mm general left shift
      
      const yOffsetRow1 = 1.42; // +0.5mm
      const yOffsetRow2 = 4.25; // 0.5mm (prev) + 1mm (new) = 1.5mm total
      const yOffsetRow3 = 5.66; // 1mm (prev) + 1mm (new) = 2mm total
      
      const xOffsetReport = 8.5; // 3mm left shift for report
      const yOffsetReport = 5.67; // 2mm up shift for report

      // Row 1
      // User requested: 4 point reduction for "Número da congregação" and "Datas em que visitou"
      drawHeader(congregation.numero, 145 - xOffset, 128 - yOffset - yOffsetRow1, 100, reportFontSize - 4);
      drawHeader(visitDate, 415 - xOffset, 128 - yOffset - yOffsetRow1, 150, reportFontSize - 4);

      // Row 2
      drawHeader(congregation.nome, 145 - xOffset, 153 - yOffset - yOffsetRow2, 180);
      // User requested: Shift Cidade 10mm to the left (5mm + 5mm)
      drawHeader(congregation.cidade, 335 - xOffset - (10 * mmToPt), 153 - yOffset - yOffsetRow2, 180);
      drawHeader(congregation.estado, 525 - xOffset, 153 - yOffset - yOffsetRow2, 40);

      // Row 3
      const supName = substituteName ? `${substituteName} (SCS)` : (personalData?.nome || '');
      drawHeader(supName, 110 - xOffset, 178 - yOffset - yOffsetRow3, 250);
      drawHeader(personalData?.circuito || '', 385 - xOffset, 178 - yOffset - yOffsetRow3, 100);

      // Report Text (Robust manual drawing to ensure it's NEVER blank)
      const maxWidth = 500 + (2 * expansionPt);
      const startX = 60 - xOffset - xOffsetReport - expansionPt;
      const startY = 225 - yOffset - yOffsetReport;

      // Improved HTML to Plain Text conversion for PDF
      const stripHtmlForPdf = (html: string) => {
        if (!html) return "";
        let text = html;
        // Convert line breaks and block elements to newlines
        text = text.replace(/<br\s*\/?>/gi, '\n');
        text = text.replace(/<\/p>/gi, '\n');
        text = text.replace(/<\/div>/gi, '\n');
        text = text.replace(/<(p|div|li|h[1-6])[^>]*>/gi, '');
        
        // Remove all other tags
        text = text.replace(/<[^>]*>/g, '');
        
        // Decode common HTML entities
        const entities: { [key: string]: string } = {
          '&nbsp;': ' ',
          '&amp;': '&',
          '&lt;': '<',
          '&gt;': '>',
          '&quot;': '"',
          '&#39;': "'",
          '&atilde;': 'ã',
          '&otilde;': 'õ',
          '&ccedil;': 'ç',
          '&aacute;': 'á',
          '&eacute;': 'é',
          '&iacute;': 'í',
          '&oacute;': 'ó',
          '&uacute;': 'ú',
          '&acirc;': 'â',
          '&ecirc;': 'ê',
          '&icirc;': 'î',
          '&ocirc;': 'ô',
          '&ucirc;': 'û'
        };
        
        Object.keys(entities).forEach(entity => {
          text = text.replace(new RegExp(entity, 'g'), entities[entity]);
        });
        
        return text;
      };

      const plainReportText = stripHtmlForPdf(reportText);
      const paragraphs = plainReportText.split(/\r?\n/);
      let currentY = startY;
      let hasStarted = false;

      // Helper for justified text (Manual drawing)
      const drawJustifiedLine = (text: string, x: number, y: number, width: number) => {
        const words = text.trim().split(/\s+/).filter(w => w.length > 0);
        if (words.length <= 1) {
          drawReport(text, x, y);
          return;
        }

        const totalWordsWidth = words.reduce((acc, word) => acc + font.widthOfTextAtSize(word, fontSize), 0);
        const totalSpaceWidth = width - totalWordsWidth;
        const spaceBetweenWords = totalSpaceWidth / (words.length - 1);

        let currentX = x;
        for (let i = 0; i < words.length; i++) {
          drawReport(words[i], currentX, y);
          currentX += font.widthOfTextAtSize(words[i], fontSize) + spaceBetweenWords;
        }
      };

      for (let i = 0; i < paragraphs.length; i++) {
        const paragraph = paragraphs[i].trim();
        
        // Skip initial empty lines
        if (!hasStarted && !paragraph) continue;
        hasStarted = true;

        if (!paragraph) {
          // Empty line (double Enter)
          currentY += pdfLineHeight;
          continue;
        }

        const words = paragraph.split(/\s+/).filter(w => w.length > 0);
        let line = '';

        for (let j = 0; j < words.length; j++) {
          const word = words[j];
          const testLine = line + (line ? ' ' : '') + word;
          const testWidth = font.widthOfTextAtSize(testLine, fontSize);
          
          if (testWidth > maxWidth) {
            drawJustifiedLine(line, startX, currentY, maxWidth);
            line = word;
            currentY += pdfLineHeight;
          } else {
            line = testLine;
          }
        }
        
        // Last line of paragraph (not justified)
        if (line) {
          drawReport(line, startX, currentY);
          currentY += pdfLineHeight;
        }
      }

      // Serialize the PDF to bytes (a Uint8Array)
      const pdfBytes = await pdfDoc.save();

      // Trigger download
      const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = getFormattedFilename();
      link.click();
      URL.revokeObjectURL(url);

    } catch (error) {
      console.error('Erro ao preencher PDF original:', error);
      setError(error instanceof Error ? error.message : 'Erro desconhecido ao gerar o PDF Original');
    } finally {
      setGenerating(false);
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
    <div className="space-y-8 w-full pb-10 flex flex-col items-center print:space-y-0 print:pb-0 print:block">
      <div className="flex flex-col sm:flex-row items-center justify-between print:hidden bg-white/80 backdrop-blur-md p-4 rounded-2xl sticky top-0 z-10 border border-gray-100 shadow-sm w-full max-w-7xl gap-4">
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <button 
            onClick={handleBack}
            className="p-2 hover:bg-gray-100 rounded-full transition-all text-[#512da8] bg-white shadow-sm border border-gray-200 flex-shrink-0"
          >
            <ChevronLeft size={24} strokeWidth={2.5} />
          </button>
          <div className="min-w-0">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 leading-tight truncate">S-303 Relatório</h2>
            <p className="text-[10px] sm:text-xs text-gray-500 font-medium uppercase tracking-wider truncate">{congregation.nome} • {visitDate}</p>
          </div>
        </div>
        <div className="flex gap-2 w-full sm:w-auto justify-center sm:justify-end">
          <div className="relative" ref={pdfMenuRef}>
            <button 
              onClick={() => setShowPdfMenu(!showPdfMenu)}
              disabled={generating}
              className="bg-[#7B1FA2] text-white px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 hover:opacity-90 transition-all shadow-sm disabled:opacity-50"
            >
              {generating ? <Loader2 size={16} className="animate-spin" /> : <FileDown size={16} />}
              <span>{generating ? 'Gerando...' : 'PDF'}</span>
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
                    handleFillOriginalPDF();
                    setShowPdfMenu(false);
                  }}
                  className="w-full text-left px-4 py-3 hover:bg-indigo-50 text-sm font-bold text-gray-700 flex items-center gap-3 transition-colors"
                >
                  <FileDown size={18} className="text-[#7B1FA2]" />
                  PDF Original
                </button>
                <button
                  onClick={() => {
                    handleSavePDF();
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
            className="bg-[#7B1FA2] text-white px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 hover:opacity-90 transition-all shadow-sm"
          >
            <Printer size={16} />
            <span className="hidden sm:inline">Imprimir</span>
          </button>
        </div>
      </div>

      {error && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-7xl bg-red-50 border border-red-200 p-4 rounded-xl text-red-700 text-sm font-medium flex items-center gap-3"
        >
          <span className="text-lg">⚠️</span>
          <div className="flex-grow">{error}</div>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
            <Plus size={20} className="rotate-45" />
          </button>
        </motion.div>
      )}

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
          className={`bg-white shadow-xl rounded-lg overflow-x-auto border border-gray-200 print:shadow-none print:border-none w-full print:max-w-none print:w-full print:m-0 print:p-0 flex ${showScrollArrows ? 'justify-start' : 'justify-center'} custom-scrollbar scroll-smooth`}
        >
        <div 
          id="s303-report-container" 
          className="bg-white print:min-h-0 text-black print:m-0 flex flex-col print:w-[297mm] print:h-[210mm] print:fixed print:top-0 print:left-0 print:z-[100] flex-shrink-0"
          style={{ 
            fontFamily: "'Arimo', Arial, Helvetica, sans-serif",
            padding: '15mm',
            width: '297mm',
            minWidth: '297mm',
            height: '210mm',
            overflow: 'hidden',
            boxSizing: 'border-box',
            transform: `scale(${scale})`,
            transformOrigin: 'top center',
            marginBottom: `${(scale - 1) * 210}mm`, // Add margin at bottom to account for scaled height
            transition: 'transform 0.2s ease-out, margin-bottom 0.2s ease-out'
          }}
        >
          <header className="mb-[5mm]">
            <h1 
              className="text-center font-bold text-[19px] tracking-tight leading-tight uppercase w-full"
            >
              RELATÓRIO SOBRE A VISITA DO SUPERINTENDENTE DE CIRCUITO À CONGREGAÇÃO
            </h1>
          </header>

          <section 
            className="space-y-[5mm] text-[15px] w-full"
          >
            {/* Row 1 */}
            <div className="flex items-baseline w-full">
              <div className="flex items-baseline w-[45%]">
                <span className="whitespace-nowrap pr-1 font-normal tracking-tight">Número da congregação:</span>
                <AutoScalingHeaderData text={congregation.numero} />
              </div>
              <div className="flex items-baseline w-[55%] pl-8">
                <span 
                  className="whitespace-nowrap pr-1 font-normal tracking-tight"
                  style={{ marginLeft: '-30px' }}
                >Datas em que visitou:</span>
                <AutoScalingHeaderData text={visitDate} />
              </div>
            </div>

            {/* Row 2 */}
            <div className="flex items-baseline w-full">
              <div className="flex items-baseline w-[45%]">
                <span className="whitespace-nowrap pr-1 font-normal tracking-tight">Nome da congregação:</span>
                <AutoScalingHeaderData text={congregation.nome} />
              </div>
              <div className="flex items-baseline w-[55%] pl-8">
                <div className="flex items-baseline w-[55%]">
                  <span 
                    className="whitespace-nowrap pr-1 font-normal tracking-tight"
                    style={{ marginLeft: '-30px' }}
                  >Cidade:</span>
                  <AutoScalingHeaderData text={congregation.cidade} />
                </div>
                <div className="flex items-baseline w-[45%] pl-4">
                  <span 
                    className="whitespace-nowrap pr-1 font-normal text-[16px] tracking-tighter"
                    style={{ marginLeft: '-12px' }}
                  >Província ou estado:</span>
                  <AutoScalingHeaderData text={congregation.estado} />
                </div>
              </div>
            </div>

            {/* Row 3 */}
            <div className="flex items-baseline w-full">
              <div className="flex items-baseline w-[45%]">
                <span className="whitespace-nowrap pr-1 font-normal tracking-tight">Sup. de circuito:</span>
                <AutoScalingHeaderData text={substituteName ? `${substituteName} (SCS)` : (personalData?.nome || '')} />
              </div>
              <div className="flex items-baseline w-[55%] pl-8">
                <div className="flex items-baseline w-full">
                  <span 
                    className="whitespace-nowrap pr-1 font-normal tracking-tight"
                    style={{ marginLeft: '-30px' }}
                  >Número do circuito:</span>
                  <AutoScalingHeaderData text={personalData?.circuito || ''} />
                </div>
              </div>
            </div>
          </section>

          {/* Main Divider */}
          <div 
            className="border-b-[1.5px] border-black w-full"
            style={{ height: '1px', marginTop: '2.5mm', marginBottom: '2.5mm' }}
          ></div>

          {/* Instruction Text */}
          <section className="w-full">
            <p className="text-[16px] font-normal leading-tight">
              Descreva brevemente o espírito da congregação e que encorajamento ou conselhos foram dados:
            </p>
          </section>

            <div className="relative flex-grow">
              {/* Toolbar Popup */}
              {showToolbar && (
                <motion.div 
                  ref={toolbarRef}
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  className="absolute -top-16 left-0 z-20 bg-white border border-gray-200 rounded-xl shadow-xl p-1.5 flex items-center gap-1 print:hidden"
                >
                  {/* Font Family */}
                  <div className="relative">
                    <button 
                      onClick={() => setShowFontPicker(!showFontPicker)}
                      className="flex items-center gap-1 px-2 py-1.5 hover:bg-gray-100 rounded-lg text-sm font-medium transition-all"
                    >
                      <span className="max-w-[80px] truncate">
                        {fontFamily.split(',')[0].replace(/'/g, '')}
                      </span>
                      <ChevronDown size={14} />
                    </button>
                    {showFontPicker && (
                      <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[150px] z-30">
                        {[
                          { name: 'Arimo', value: "Arimo" },
                          { name: 'Times New Roman', value: "Times New Roman" },
                          { name: 'Courier New', value: "Courier New" },
                          { name: 'Georgia', value: "Georgia" },
                          { name: 'Helvetica', value: "Helvetica" }
                        ].map(f => (
                          <button
                            key={f.name}
                            onMouseDown={(e) => {
                              e.preventDefault(); // Prevent focus loss
                              setFontFamily(f.value);
                              execCommand('fontName', f.value);
                              setShowFontPicker(false);
                            }}
                            className="w-full text-left px-3 py-1.5 hover:bg-indigo-50 text-sm transition-all"
                            style={{ fontFamily: f.value }}
                          >
                            {f.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="w-px h-6 bg-gray-200 mx-1" />

                  {/* Font Size */}
                  <div className="flex items-center gap-0.5">
                    <button 
                      onMouseDown={(e) => { e.preventDefault(); setReportFontSize(prev => Math.max(8, prev - 1)); }}
                      className="p-1.5 hover:bg-gray-100 rounded-lg transition-all"
                      title="Diminuir fonte"
                    >
                      <Minus size={16} />
                    </button>
                    <span className="text-sm font-bold w-6 text-center">{Math.round(reportFontSize)}</span>
                    <button 
                      onMouseDown={(e) => { e.preventDefault(); setReportFontSize(prev => Math.min(24, prev + 1)); }}
                      className="p-1.5 hover:bg-gray-100 rounded-lg transition-all"
                      title="Aumentar fonte"
                    >
                      <Plus size={16} />
                    </button>
                  </div>

                  <div className="w-px h-6 bg-gray-200 mx-1" />

                  {/* Bold & Italic */}
                  <button 
                    onMouseDown={(e) => { e.preventDefault(); execCommand('bold'); }}
                    className="p-1.5 rounded-lg transition-all hover:bg-gray-100"
                    title="Negrito"
                  >
                    <Bold size={16} />
                  </button>
                  <button 
                    onMouseDown={(e) => { e.preventDefault(); execCommand('italic'); }}
                    className="p-1.5 rounded-lg transition-all hover:bg-gray-100"
                    title="Itálico"
                  >
                    <Italic size={16} />
                  </button>

                  <div className="w-px h-6 bg-gray-200 mx-1" />

                  {/* Color Picker */}
                  <div className="relative">
                    <button 
                      onClick={() => setShowColorPicker(!showColorPicker)}
                      className="p-1.5 hover:bg-gray-100 rounded-lg transition-all flex flex-col items-center gap-0.5"
                      title="Cor do texto"
                    >
                      <Palette size={16} style={{ color: textColor }} />
                      <div className="w-3 h-0.5" style={{ backgroundColor: textColor }} />
                    </button>
                    {showColorPicker && (
                      <div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-2xl p-3 z-30 min-w-[240px]">
                        <div className="mb-2">
                          <h4 className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">Cores do Tema</h4>
                          <div className="flex gap-1">
                            {[
                              ['#ffffff', '#f2f2f2', '#d9d9d9', '#bfbfbf', '#a6a6a6', '#7f7f7f'],
                              ['#000000', '#7f7f7f', '#595959', '#3f3f3f', '#262626', '#0c0c0c'],
                              ['#eeece1', '#ddd9c3', '#c4bd97', '#938953', '#494429', '#1d1b10'],
                              ['#1f497d', '#c6d9f0', '#8db3e2', '#548dd4', '#17365d', '#0f243e'],
                              ['#4f81bd', '#dbe5f1', '#b8cce4', '#95b3d7', '#366092', '#244061'],
                              ['#c0504d', '#f2dbdb', '#e6b8b7', '#d99694', '#953734', '#632423'],
                              ['#9bbb59', '#ebf1de', '#d7e3bc', '#c3d69b', '#76923c', '#4f6128'],
                              ['#8064a2', '#e5e0ec', '#ccc1d9', '#b2a2c7', '#5f497a', '#3f3151'],
                              ['#4bacc6', '#dbeef3', '#b7dee8', '#92cddc', '#31859b', '#215967'],
                              ['#f79646', '#fdeada', '#fbd5b5', '#fac08f', '#e36c09', '#974806'],
                            ].map((column, colIdx) => (
                              <div key={colIdx} className="flex flex-col gap-1">
                                {column.map((c, rowIdx) => (
                                  <button
                                    key={rowIdx}
                                    onMouseDown={(e) => {
                                      e.preventDefault();
                                      setTextColor(c);
                                      execCommand('foreColor', c);
                                      setShowColorPicker(false);
                                    }}
                                    className={`w-5 h-5 border border-gray-100 transition-all hover:scale-110 ${rowIdx === 0 ? 'mb-1' : ''}`}
                                    style={{ backgroundColor: c }}
                                  />
                                ))}
                              </div>
                            ))}
                          </div>
                        </div>
                        
                        <div className="w-full h-px bg-gray-100 my-3" />
                        
                        <div>
                          <h4 className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">Cores Padrão</h4>
                          <div className="flex gap-1">
                            {['#c00000', '#ff0000', '#ffc000', '#ffff00', '#92d050', '#00b050', '#00b0f0', '#0070c0', '#002060', '#7030a0'].map(c => (
                              <button
                                key={c}
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  setTextColor(c);
                                  execCommand('foreColor', c);
                                  setShowColorPicker(false);
                                }}
                                className="w-5 h-5 border border-gray-100 transition-all hover:scale-110"
                                style={{ backgroundColor: c }}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                    {/* Height Adjustment (Admin Only) */}
                    {isAdmin && (
                      <div className="flex items-center gap-1 border-l border-gray-200 pl-2 ml-2">
                        <button 
                          onMouseDown={(e) => { e.preventDefault(); setReportHeight(prev => Math.max(50, prev - 1)); }}
                          className="p-1.5 hover:bg-gray-100 rounded-lg transition-all text-gray-500"
                          title="Diminuir altura da caixa"
                        >
                          <Minus size={16} />
                        </button>
                        <div className="flex flex-col items-center px-1">
                          <span className="text-[10px] font-bold text-gray-400 uppercase leading-none mb-0.5">Altura</span>
                          <span className="text-xs font-bold text-[#512da8] tabular-nums">{reportHeight}mm</span>
                        </div>
                        <button 
                          onMouseDown={(e) => { e.preventDefault(); setReportHeight(prev => Math.min(200, prev + 1)); }}
                          className="p-1.5 hover:bg-gray-100 rounded-lg transition-all text-gray-500"
                          title="Aumentar altura da caixa"
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              <div 
                className="report-content-wrapper w-full"
                style={{ marginTop: '-14px' }}
              >
                <div 
                  ref={editableRef}
                  contentEditable
                  onInput={handleTextChange}
                  className="w-full p-0 border-none font-sans leading-[1.6] focus:outline-none focus:ring-0 print:hidden overflow-hidden empty:before:content-[attr(data-placeholder)] empty:before:text-gray-400"
                  data-placeholder="Digite o relatório aqui..."
                  style={{ 
                    fontFamily,
                    fontSize: `${reportFontSize}px`,
                    textAlign: 'justify',
                    paddingTop: '2mm',
                    marginTop: '9px',
                    height: `${reportHeight}mm`
                  }}
                />
                <div 
                  className="hidden print:block leading-[1.6] overflow-hidden text-justify w-full"
                  style={{ 
                    fontFamily,
                    fontSize: `${reportFontSize}px`,
                    textAlign: 'justify',
                    paddingTop: '2mm',
                    marginTop: '9px',
                    height: `${reportHeight}mm`
                  }}
                  dangerouslySetInnerHTML={{ __html: reportText }}
                />
              </div>
            </div>

          <footer className="w-full" style={{ marginTop: '3mm' }}>
            <div className="text-[16px] leading-[1.2] text-justify italic text-gray-800 mb-2">
              (Antes de terminar a visita à congregação no domingo, e numa hora que não interfira na programação de serviço de campo, 
              considere este relatório com a comissão de serviço da congregação. Deixe uma cópia com o coordenador do corpo de anciãos 
              para que todos os anciãos a leiam e para que a recapitulem na próxima reunião trimestral dos anciãos.)
            </div>
            <div className="text-[15px] font-normal mb-10">
              S-303-T 1/25
            </div>
          </footer>
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
            size: A4 landscape;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            height: 210mm !important;
            width: 297mm !important;
            overflow: hidden !important;
            background: white !important;
          }
          #s303-report-container {
            width: 297mm !important;
            height: 210mm !important;
            margin: 0 !important;
            padding: 15mm !important;
            overflow: hidden !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            box-sizing: border-box !important;
            background: white !important;
            /* Apply 95% scale to match user's preferred print setting */
            transform: scale(0.95) !important;
            transform-origin: top center !important;
          }
          /* Ensure content fits within the landscape A4 */
          .report-content-wrapper {
            overflow: hidden !important;
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
