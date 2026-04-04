'use client';

import { useState, useEffect } from 'react';
import { 
  FileText, 
  ChevronLeft, 
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

interface S302NoticeViewProps {
  congregacao: Congregation;
  data: string;
  substituteName?: string;
  userId: string;
  onBack: () => void;
}

export default function S302NoticeView({ congregacao, data, substituteName, userId, onBack }: S302NoticeViewProps) {
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
      const fullCongName = congregacao.cidade 
        ? `${congregacao.nome}, ${congregacao.cidade}` 
        : congregacao.nome;
      drawText(fullCongName, 100 + (7 * mmToPt), 145 - (10 * mmToPt), 11, true);

      // 2. Visitante: direita 10mm (em relação aos 10mm anteriores = 20mm), descer 2mm (em relação à elevação de 18mm = elevar 16mm)
      const visitorName = substituteName ? `${substituteName} (SCS)` : (personalData?.nome || '');
      drawText(visitorName, 100 + (20 * mmToPt), 185 - (16 * mmToPt), 11, true);

      // 3. Data da Visita: direita 2mm (em relação aos 5mm anteriores = 7mm), descer 2mm (em relação à elevação de 25mm = elevar 23mm)
      drawText(data, 100 + (7 * mmToPt), 225 - (23 * mmToPt), 11, true);

      // 4. Assinatura: direita 3mm (em relação aos 10mm anteriores = 13mm), descer 3mm (em relação à posição anterior = 225 - 7mm)
      const scName = personalData?.nome || '';
      drawText(scName, 100 + (13 * mmToPt), 225 - (7 * mmToPt), 10, false);

      const modifiedPdfBytes = await pdfDoc.save();
      const blob = new Blob([modifiedPdfBytes], { type: 'application/pdf' });
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
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <button 
            onClick={onBack}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-600"
          >
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <FileText className="text-blue-600" size={20} />
            S-302 Aviso de Visitas
          </h1>
          <div className="w-10" /> {/* Spacer */}
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 space-y-6">
        {/* Info Card */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden"
        >
          <div className="bg-blue-600 p-4 text-white">
            <h2 className="font-bold flex items-center gap-2">
              <Calendar size={20} />
              Dados da Visita
            </h2>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                <MapPin size={12} /> Congregação
              </label>
              <p className="text-gray-800 font-medium">
                {congregacao.nome}{congregacao.cidade ? `, ${congregacao.cidade}` : ''}
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
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-2xl shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
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
