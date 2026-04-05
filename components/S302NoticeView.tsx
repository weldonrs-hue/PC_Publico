'use client';

import { useState, useEffect } from 'react';
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
  Hash
} from 'lucide-react';
import { motion } from 'motion/react';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

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

  useEffect(() => {
    const fetchPersonalData = async () => {
      try {
        const docRef = doc(db, 'personal_data', userId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setPersonalData(docSnap.data());
        }
      } catch (error) {
        console.error('Error fetching personal data:', error);
      }
    };
    fetchPersonalData();
  }, [userId]);

  const handleDownloadPDF = async () => {
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
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

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
      const scName = personalData?.nome || '';
      let signatureFont;
      try {
        // Tentativa de carregar a fonte Dancing Script para a assinatura
        const fontUrl = 'https://fonts.gstatic.com/s/dancingscript/v25/If2cXTr6fe34-3S3SM1uQ_Lp.ttf';
        const fontBytes = await fetch(fontUrl).then(res => res.arrayBuffer());
        signatureFont = await pdfDoc.embedFont(fontBytes);
      } catch (e) {
        console.warn('Falha ao carregar Dancing Script, usando TimesRomanItalic como fallback', e);
        signatureFont = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);
      }

      firstPage.drawText(scName, {
        x: 100 + (13 * mmToPt),
        y: height - (225 - (6.0 * mmToPt)),
        size: 18, // Aumentado um pouco para compensar a fonte manuscrita
        font: signatureFont,
        color: rgb(0, 74/255, 173/255),
      });

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

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
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
                onClick={handleDownloadPDF}
                disabled={generating}
                className="bg-white/20 text-white px-4 py-1.5 rounded-lg font-bold text-sm hover:bg-white/30 transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {generating ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                PDF
              </button>
            </div>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                <MapPin size={12} /> Congregação
              </label>
              <p className="text-gray-800 font-medium">
                {congregacao.nome}
                {(congregacao.cidade && congregacao.cidade.trim().toLowerCase() !== congregacao.nome.trim().toLowerCase()) 
                  ? `, ${congregacao.cidade}` 
                  : ''}
              </p>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                <Hash size={12} /> Número
              </label>
              <p className="text-gray-800 font-medium">{congregacao.numero}</p>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                <Calendar size={12} /> Datas
              </label>
              <p className="text-gray-800 font-medium">{data}</p>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                <User size={12} /> Visitante (Sup. de Circuito)
              </label>
              <p className="text-gray-800 font-medium">
                {substituteName ? `${substituteName} (SCS)` : (personalData?.nome || 'Carregando...')}
              </p>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                <User size={12} /> Superintendente de Circuito (Usuário)
              </label>
              <p className="text-gray-800 font-medium">
                {personalData?.nome || 'Carregando...'}
              </p>
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
