'use client';

import { useState, useEffect, useRef } from 'react';
import { 
  ChevronLeft, 
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
import { motion } from 'motion/react';
import { db } from '@/lib/firebase';
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
  onBack: () => void;
}

export default function S303ReportView({ userId, congregation, visitDate, onBack }: S303ReportViewProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reportText, setReportText] = useState('');
  const [initialReportText, setInitialReportText] = useState('');
  const [reportFontSize, setReportFontSize] = useState(16);
  const [fontFamily, setFontFamily] = useState("'Arimo', Arial, sans-serif");
  const [textColor, setTextColor] = useState('#000000');
  const [showToolbar, setShowToolbar] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showFontPicker, setShowFontPicker] = useState(false);
  
  const editableRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [personalData, setPersonalData] = useState<any>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);

  const isDirty = reportText !== initialReportText;

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
          const data = reportSnap.data();
          const text = data.relatorio || '';
          setReportText(text);
          setInitialReportText(text);
          
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
      // Fetch the original PDF
      const response = await fetch('S-303.pdf');
      if (!response.ok) {
        throw new Error(`Erro ao baixar o PDF original: ${response.status} ${response.statusText}`);
      }
      const existingPdfBytes = await response.arrayBuffer();
      
      // Load the PDF
      const pdfDoc = await PDFDocument.load(existingPdfBytes);
      const pages = pdfDoc.getPages();
      const firstPage = pages[0];
      const { width, height } = firstPage.getSize();

      // Use a standard font based on selection
      let selectedFont = StandardFonts.Helvetica;
      if (fontFamily.includes('Times')) selectedFont = StandardFonts.TimesRoman;
      if (fontFamily.includes('Courier')) selectedFont = StandardFonts.Courier;

      let fontToUse = selectedFont;
      const font = await pdfDoc.embedFont(fontToUse);
      const boldFont = await pdfDoc.embedFont(
        selectedFont === StandardFonts.Helvetica ? StandardFonts.HelveticaBold :
        selectedFont === StandardFonts.TimesRoman ? StandardFonts.TimesRomanBold :
        StandardFonts.CourierBold
      );
      const fontSize = 10;

      // Convert hex color to RGB
      const hexToRgb = (hex: string) => {
        const r = parseInt(hex.slice(1, 3), 16) / 255;
        const g = parseInt(hex.slice(3, 5), 16) / 255;
        const b = parseInt(hex.slice(5, 7), 16) / 255;
        return rgb(r, g, b);
      };
      const pdfColor = hexToRgb(textColor);

      // Helper to draw text
      const draw = (text: string, x: number, y: number, isBoldText = false) => {
        if (!text) return;
        firstPage.drawText(text, {
          x,
          y: height - y, // Convert from top-left to bottom-left
          size: fontSize,
          font: isBoldText ? boldFont : font,
          color: pdfColor,
        });
      };

      // Coordinates (estimated in points from top-left)
      const mmToPt = 2.83465;
      const expansionPt = 4 * mmToPt;
      
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

      // Helper for justified text
      const drawJustifiedLine = (text: string, x: number, y: number, width: number) => {
        const words = text.trim().split(/\s+/);
        if (words.length <= 1) {
          draw(text, x, y);
          return;
        }

        const totalWordsWidth = words.reduce((acc, word) => acc + font.widthOfTextAtSize(word, fontSize), 0);
        const totalSpaceWidth = width - totalWordsWidth;
        const spaceBetweenWords = totalSpaceWidth / (words.length - 1);

        let currentX = x;
        for (let i = 0; i < words.length; i++) {
          draw(words[i], currentX, y);
          currentX += font.widthOfTextAtSize(words[i], fontSize) + spaceBetweenWords;
        }
      };

      // Strip HTML tags for manual PDF filling as pdf-lib doesn't support HTML
      const stripHtml = (html: string) => {
        const tmp = document.createElement("DIV");
        tmp.innerHTML = html;
        return tmp.textContent || tmp.innerText || "";
      };
      const plainReportText = stripHtml(reportText);

      // Report Text (with wrapping and newline support)
      const maxWidth = 500 + (2 * expansionPt);
      const startX = 60 - xOffset - xOffsetReport - expansionPt;
      const startY = 225 - yOffset - yOffsetReport;
      const lineHeight = 14;
      
      const paragraphs = plainReportText.split('\n');
      let currentY = startY;

      for (const paragraph of paragraphs) {
        if (!paragraph.trim()) {
          currentY += lineHeight;
          continue;
        }

        const words = paragraph.split(' ');
        let line = '';

        for (let i = 0; i < words.length; i++) {
          const word = words[i];
          const testLine = line + (line ? ' ' : '') + word;
          const testWidth = font.widthOfTextAtSize(testLine, fontSize);
          
          if (testWidth > maxWidth) {
            drawJustifiedLine(line, startX, currentY, maxWidth);
            line = word;
            currentY += lineHeight;
          } else {
            line = testLine;
          }
        }
        // Last line of paragraph is NOT justified
        draw(line, startX, currentY);
        currentY += lineHeight;
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
    <div className="space-y-8 w-full pb-10 flex flex-col items-center">
      <div className="flex items-center justify-between print:hidden bg-white/80 backdrop-blur-md p-4 rounded-2xl sticky top-0 z-10 border border-gray-100 shadow-sm w-full max-w-5xl">
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

      <div className="bg-white shadow-xl rounded-lg overflow-hidden border border-gray-200 print:shadow-none print:border-none w-full max-w-5xl">
        <div 
          id="s303-report-container" 
          className="bg-white w-full min-h-[200mm] mx-auto text-black print:m-0 flex flex-col"
          style={{ 
            fontFamily: "'Arimo', Arial, Helvetica, sans-serif",
            padding: '18mm 22mm'
          }}
        >
          <header className="mb-10">
            <h1 className="text-center font-bold text-[20px] uppercase tracking-wide">
              RELATÓRIO SOBRE A VISITA DO SUPERINTENDENTE DE CIRCUITO À CONGREGAÇÃO
            </h1>
          </header>

          <section className="flex flex-col flex-grow">
            {/* Row 1 */}
            <div className="flex items-baseline mb-[1.2rem]">
              <label className="text-[17px] whitespace-nowrap">Número da congregação:</label>
              <div className="border-b border-black flex-[0.7] h-[1.6rem] ml-[0.6rem] px-2 text-[17px] font-medium">
                {congregation.numero}
              </div>
              <label className="text-[17px] whitespace-nowrap ml-8">Datas em que visitou:</label>
              <div className="border-b border-black flex-1 h-[1.6rem] ml-[0.6rem] px-2 text-[17px] font-medium">
                {visitDate}
              </div>
            </div>

            {/* Row 2 */}
            <div className="flex items-baseline mb-[1.2rem]">
              <label className="text-[17px] whitespace-nowrap">Nome da congregação:</label>
              <div className="border-b border-black flex-[0.8] h-[1.6rem] ml-[0.6rem] px-2 text-[17px] font-medium">
                {congregation.nome}
              </div>
              <label className="text-[17px] whitespace-nowrap ml-8">Cidade:</label>
              <div className="border-b border-black flex-[0.6] h-[1.6rem] ml-[0.6rem] px-2 text-[17px] font-medium">
                {congregation.cidade}
              </div>
              <label className="text-[17px] whitespace-nowrap ml-8">Província ou estado:</label>
              <div className="border-b border-black flex-[0.2] h-[1.6rem] ml-[0.6rem] px-2 text-[17px] font-medium">
                {congregation.estado}
              </div>
            </div>

            {/* Row 3 */}
            <div className="flex items-baseline mb-[1.2rem]">
              <label className="text-[17px] whitespace-nowrap">Sup. de circuito:</label>
              <div className="border-b border-black flex-[0.8] h-[1.6rem] ml-[0.6rem] px-2 text-[17px] font-medium">
                {personalData?.nome || ''}
              </div>
              <label className="text-[17px] whitespace-nowrap ml-8">Número do circuito:</label>
              <div className="border-b border-black flex-[0.6] h-[1.6rem] ml-[0.6rem] px-2 text-[17px] font-medium">
                {personalData?.circuito || ''}
              </div>
            </div>

            {/* Bold Divider */}
            <div className="border-t-2 border-black mb-3" style={{ marginTop: 'calc(0.75rem - 5mm)' }}></div>

            {/* Description Label */}
            <p className="text-[17px] mt-0 mb-[2mm]">
              Descreva brevemente o espírito da congregação e que encorajamento ou conselhos foram dados:
            </p>

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
                  </div>
                </motion.div>
              )}

              <div 
                ref={editableRef}
                contentEditable
                onInput={handleTextChange}
                className="w-full h-[100mm] p-0 border-none font-sans leading-[1.6] focus:outline-none focus:ring-0 print:hidden overflow-hidden empty:before:content-[attr(data-placeholder)] empty:before:text-gray-400"
                data-placeholder="Digite o relatório aqui..."
                style={{ 
                  fontFamily,
                  fontSize: `${reportFontSize}px`,
                  textAlign: 'justify',
                  paddingTop: '2mm'
                }}
              />
              <div 
                className="hidden print:block whitespace-pre-wrap leading-[1.6] h-[100mm] overflow-hidden text-justify"
                style={{ 
                  fontFamily,
                  fontSize: `${reportFontSize}px`,
                  textAlign: 'justify',
                  paddingTop: '2mm'
                }}
                dangerouslySetInnerHTML={{ __html: reportText }}
              />
            </div>
          </section>

          <footer className="mt-auto">
            <div className="text-[14px] line-height-[1.4] text-justify">
              (Antes de terminar a visita à congregação no domingo, e numa hora que não interfira na programação de serviço de campo, 
              considere este relatório com a comissão de serviço da congregação. Deixe uma cópia com o coordenador do corpo de anciãos 
              para que todos os anciãos a leiam e para que a recapitulem na próxima reunião trimestral dos anciãos.)
            </div>
            <div className="text-[20px] mt-8">
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
