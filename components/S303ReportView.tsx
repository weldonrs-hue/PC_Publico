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
      alert('Relatório salvo com sucesso!');
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
      alert('Erro ao gerar PDF.');
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
            onClick={handleSavePDF}
            className="bg-white text-gray-700 border border-gray-200 px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-gray-50 transition-all"
          >
            <FileDown size={18} />
            PDF
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

      <div className="bg-white shadow-xl rounded-2xl overflow-hidden border border-gray-200 print:shadow-none print:border-none">
        <div id="s303-report-container" className="p-12 bg-white min-h-[297mm] w-full max-w-[210mm] mx-auto text-black font-serif">
          <h1 className="text-center text-xl font-bold mb-8 uppercase tracking-wide">
            RELATÓRIO SOBRE A VISITA DO SUPERINTENDENTE DE CIRCUITO À CONGREGAÇÃO
          </h1>

          <div className="space-y-6 text-sm">
            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
              <div className="flex items-end gap-2">
                <span className="whitespace-nowrap">Número da congregação:</span>
                <div className="flex-1 border-b border-black pb-0.5 px-2 font-sans font-medium">
                  {congregation.numero}
                </div>
              </div>
              <div className="flex items-end gap-2">
                <span className="whitespace-nowrap">Datas em que visitou:</span>
                <div className="flex-1 border-b border-black pb-0.5 px-2 font-sans font-medium">
                  {visitDate}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-x-4 gap-y-4">
              <div className="flex items-end gap-2 col-span-1">
                <span className="whitespace-nowrap">Nome da congregação:</span>
                <div className="flex-1 border-b border-black pb-0.5 px-2 font-sans font-medium">
                  {congregation.nome}
                </div>
              </div>
              <div className="flex items-end gap-2">
                <span className="whitespace-nowrap">Cidade:</span>
                <div className="flex-1 border-b border-black pb-0.5 px-2 font-sans font-medium">
                  {congregation.cidade}
                </div>
              </div>
              <div className="flex items-end gap-2">
                <span className="whitespace-nowrap">Província ou estado:</span>
                <div className="flex-1 border-b border-black pb-0.5 px-2 font-sans font-medium">
                  {congregation.estado}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
              <div className="flex items-end gap-2">
                <span className="whitespace-nowrap">Sup. de circuito:</span>
                <div className="flex-1 border-b border-black pb-0.5 px-2 font-sans font-medium">
                  {personalData?.nome || ''}
                </div>
              </div>
              <div className="flex items-end gap-2">
                <span className="whitespace-nowrap">Número do circuito:</span>
                <div className="flex-1 border-b border-black pb-0.5 px-2 font-sans font-medium">
                  {personalData?.circuito || ''}
                </div>
              </div>
            </div>

            <div className="pt-4 space-y-4">
              <p className="font-sans text-[13px]">
                Descreva brevemente o espírito da congregação e que encorajamento ou conselhos foram dados:
              </p>
              <textarea 
                value={reportText}
                onChange={(e) => setReportText(e.target.value)}
                className="w-full min-h-[400px] p-4 border border-gray-300 rounded-lg font-sans text-sm focus:outline-none focus:ring-1 focus:ring-black print:border-none print:p-0 print:min-h-0"
                placeholder="Digite o relatório aqui..."
              />
            </div>

            <div className="pt-12 space-y-6 text-[12px] italic leading-relaxed">
              <p>
                (Antes de terminar a visita à congregação no domingo, e numa hora que não interfira na programação de serviço de campo, 
                considere este relatório com a comissão de serviço da congregação. Deixe uma cópia com o coordenador do corpo de anciãos 
                para que todos os anciãos a leiam e para que a recapitulem na próxima reunião trimestral dos anciãos.)
              </p>
              <p className="not-italic font-sans font-bold text-xs">
                S-303-T 1/25
              </p>
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
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
