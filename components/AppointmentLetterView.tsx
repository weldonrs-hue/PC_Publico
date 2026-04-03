'use client';

import { useState, useEffect, useRef } from 'react';
import { 
  ChevronLeft, 
  Loader2,
  Printer,
  FileDown,
  X
} from 'lucide-react';
import { motion } from 'motion/react';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '@/utils/firestore';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';

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
  const [personalData, setPersonalData] = useState<any>(null);
  const [letterData, setLetterData] = useState<LetterData>({
    ancianosDesignados: ['', '', '', ''],
    servosDesignados: ['', '', '', ''],
    irmaosRemovidos: ['', '', '', '']
  });
  const letterRef = useRef<HTMLDivElement>(null);

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
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, 'appointment_letter');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [userId, congregation.nome, visitDate]);

  const handlePrint = () => {
    window.print();
  };

  const handleExportPDF = async () => {
    const element = document.getElementById('appointment-letter-container');
    if (!element) return;

    const dateStr = formatDate().replace(/[/,]/g, '-').replace(/\s+/g, '_');
    const filename = `Carta_Designacao_${congregation.nome}_${dateStr}.pdf`;

    try {
      const dataUrl = await toPng(element, {
        quality: 1.0,
        pixelRatio: 3,
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
        format: 'a4'
      });

      const scale = 0.95;
      const w = 210 * scale;
      const h = 297 * scale;
      const x = (210 - w) / 2;
      const y = (297 - h) / 2;

      pdf.addImage(dataUrl, 'PNG', x, y, w, h);
      pdf.save(filename);
    } catch (error) {
      console.error('Erro ao exportar PDF:', error);
    }
  };

  const updateField = (type: keyof LetterData, index: number, value: string) => {
    setLetterData(prev => {
      const newData = { ...prev };
      newData[type][index] = value;
      return newData;
    });
  };

  const formatDate = () => {
    const date = new Date();
    const options: Intl.DateTimeFormatOptions = { 
      weekday: 'long', 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
    };
    return date.toLocaleDateString('pt-BR', options);
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
      <div className="flex flex-col sm:flex-row items-center justify-between print:hidden bg-white/80 backdrop-blur-md p-4 rounded-2xl sticky top-0 z-10 border border-gray-100 shadow-sm w-full max-w-6xl gap-4 mt-4">
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <button 
            onClick={onBack}
            className="p-2 hover:bg-gray-100 rounded-full transition-all text-[#512da8] bg-white shadow-sm border border-gray-200 flex-shrink-0"
          >
            <ChevronLeft size={24} strokeWidth={2.5} />
          </button>
          <div className="min-w-0">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 leading-tight truncate">Carta de Designação/Remoção</h2>
            <p className="text-[10px] sm:text-xs text-gray-500 font-medium uppercase tracking-wider truncate">{congregation.nome} • {visitDate}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-center sm:justify-end">
          <button 
            onClick={handleExportPDF}
            className="bg-[#512da8] text-white px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 hover:opacity-90 transition-all shadow-sm"
          >
            <FileDown size={16} />
            <span>PDF</span>
          </button>
          <button 
            onClick={handlePrint}
            className="bg-[#512da8] text-white px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 hover:opacity-90 transition-all shadow-sm"
          >
            <Printer size={16} />
            <span className="hidden sm:inline">Imprimir</span>
          </button>
        </div>
      </div>

      {/* Letter Content */}
      <div className="bg-white shadow-xl rounded-lg overflow-x-auto border border-gray-200 print:shadow-none print:border-none w-full max-w-6xl print:max-w-none print:w-full print:m-0 print:p-0">
        <div 
          id="appointment-letter-container"
          className="bg-white print:min-h-0 mx-auto text-black print:m-0 flex flex-col print:w-[210mm] print:h-[297mm] print:fixed print:top-0 print:left-0 print:z-[100] flex-shrink-0"
          style={{ 
            fontFamily: "'Times New Roman', Times, serif",
            padding: '12.7mm',
            width: '210mm',
            minWidth: '210mm',
            height: '297mm',
            overflow: 'hidden',
            boxSizing: 'border-box'
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
              <p className="text-[15px]">{formatDate()}</p>
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
                <p className="text-[15px] italic">Ref.: Designações e remoções de anciãos e servos ministeriais</p>
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
                <p className="mb-1 mt-[-30px]">Confirmo que <strong className="font-bold">removi</strong> o(s) seguinte(s) irmão(s) de servir como ancião ou servo ministerial:</p>
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
            <div className="mt-8">
              <div className="flex flex-col items-end mb-[58px]">
                <div className="w-72 text-center">
                  <p className="text-[15px] mt-0 pl-[61px] mb-[18px] text-left">Seu irmão,</p>
                  {/* Signature Block */}
                  <div className="inline-block relative">
                    <div className="font-signature text-[32px] text-[#004aad] leading-none mb-[-4px]" style={{ fontFamily: "'Dancing Script', cursive" }}>
                      {personalData?.nome || 'Assinatura'}
                    </div>
                    <div className="border-t border-black w-full mx-auto mb-0"></div>
                    <p className="font-bold text-[11px] mt-[5px] uppercase tracking-wider mb-0">
                      {personalData?.nome || 'Nome do Viajante'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </article>
        </div>
      </div>

      {/* Signature Font Import */}
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Dancing+Script:wght@400;700&display=swap');
        
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
            /* Apply 95% scale to match user's preferred print setting */
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
    </div>
  );
}
