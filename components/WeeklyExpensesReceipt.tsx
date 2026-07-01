'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Printer, History, Home, PlusSquare, Settings, Save, Trash2, Loader2, Search, Download } from 'lucide-react';
import { db, auth } from '@/lib/firebase';
import { collection, addDoc, getDocs, query, where, orderBy, serverTimestamp, deleteDoc, doc, getDoc } from 'firebase/firestore';
import { toJpeg } from 'html-to-image';
import { jsPDF } from 'jspdf';

interface WeeklyExpensesReceiptProps {
  onBack: () => void;
}

interface ReceiptRecord {
  id: string;
  date: string;
  items: { label: string; value: string }[];
  types: { donativo: boolean; pagamento: boolean };
  total: string;
  checkedBy?: string;
  congregation?: string;
  createdAt: any;
}

export default function WeeklyExpensesReceipt({ onBack }: WeeklyExpensesReceiptProps) {
  const [view, setView] = useState<'form' | 'history'>('form');
  const [history, setHistory] = useState<ReceiptRecord[]>([]);
  const [congregations, setCongregations] = useState<{ id: string; nome: string }[]>([]);
  const [selectedCongregation, setSelectedCongregation] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [checkedBy, setCheckedBy] = useState('');
  const [personalData, setPersonalData] = useState<any>(null);
  const [generating, setGenerating] = useState(false);
  const receiptRef = useRef<HTMLDivElement>(null);

  const initialItems = [
    { label: 'Mercado da Semana', value: '' },
    { label: 'Feira Livre', value: '' },
    { label: 'Carnes e Peixes', value: '' },
    { label: '', value: '' },
    { label: '', value: '' },
  ];

  const [items, setItems] = useState(initialItems);

  const calculateTotal = (currentItems: { label: string, value: string }[]) => {
    const sum = currentItems.reduce((acc, item) => {
      const val = parseFloat(item.value.replace(',', '.')) || 0;
      return acc + val;
    }, 0);
    return sum.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const handleValueChange = (idx: number, newValue: string) => {
    const newItems = [...items];
    // Allow only numbers and comma
    const sanitized = newValue.replace(/[^0-9,]/g, '');
    newItems[idx].value = sanitized;
    setItems(newItems);
  };

  const total = calculateTotal(items);
  const [date, setDate] = useState(new Date().toLocaleDateString('pt-BR'));
  const [types, setTypes] = useState({
    donativo: false,
    pagamento: false,
  });

  useEffect(() => {
    if (view === 'history') {
      loadHistory();
    }
  }, [view]);

  useEffect(() => {
    const fetchPersonalData = async () => {
      if (!auth.currentUser) return;
      try {
        const pdDoc = await getDoc(doc(db, 'personal_data', auth.currentUser.uid));
        if (pdDoc.exists()) {
          setPersonalData(pdDoc.data());
        }
      } catch (error) {
        console.error('Error fetching personal data:', error);
      }
    };

    const fetchCongregations = async () => {
      if (!auth.currentUser) return;
      try {
        const q = query(
          collection(db, 'congregations'),
          where('userId', '==', auth.currentUser.uid),
          orderBy('nome', 'asc')
        );
        const querySnapshot = await getDocs(q);
        const list: { id: string; nome: string }[] = [];
        querySnapshot.forEach((doc) => {
          list.push({ id: doc.id, nome: doc.data().nome });
        });
        setCongregations(list);
      } catch (error) {
        console.error('Error fetching congregations:', error);
      }
    };

    fetchPersonalData();
    fetchCongregations();
  }, []);

  const loadHistory = async () => {
    if (!auth.currentUser) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, 'weekly_expenses'),
        where('userId', '==', auth.currentUser.uid),
        orderBy('createdAt', 'desc')
      );
      const querySnapshot = await getDocs(q);
      const records: ReceiptRecord[] = [];
      querySnapshot.forEach((doc) => {
        records.push({ id: doc.id, ...doc.data() } as ReceiptRecord);
      });
      setHistory(records);
    } catch (error) {
      console.error('Error loading history:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveReceipt = async () => {
    if (!auth.currentUser) return;
    if (total === '0,00') {
      alert('O total deve ser maior que zero para salvar.');
      return;
    }

    setIsSaving(true);
    try {
      await addDoc(collection(db, 'weekly_expenses'), {
        userId: auth.currentUser.uid,
        date,
        items,
        types,
        total,
        checkedBy,
        congregation: selectedCongregation,
        createdAt: serverTimestamp(),
      });
      alert('Recibo salvo com sucesso!');
      setView('history');
    } catch (error) {
      console.error('Error saving receipt:', error);
      alert('Erro ao salvar recibo.');
    } finally {
      setIsSaving(false);
    }
  };

  const deleteReceipt = async (id: string) => {
    if (!confirm('Deseja excluir este recibo?')) return;
    try {
      await deleteDoc(doc(db, 'weekly_expenses', id));
      setHistory(prev => prev.filter(item => item.id !== id));
    } catch (error) {
      console.error('Error deleting receipt:', error);
    }
  };

  const resetForm = () => {
    setItems(initialItems);
    setTypes({ donativo: false, pagamento: false });
    setDate(new Date().toLocaleDateString('pt-BR'));
    setCheckedBy('');
    setSelectedCongregation('');
    setView('form');
  };

  const loadReceiptToForm = (record: ReceiptRecord) => {
    setItems(record.items);
    setTypes(record.types);
    setDate(record.date);
    setCheckedBy(record.checkedBy || '');
    setSelectedCongregation(record.congregation || '');
    setView('form');
  };

  const filteredHistory = history.filter(h => 
    h.date.includes(searchTerm) || 
    h.items.some(i => i.label.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    if (!receiptRef.current) return;
    setGenerating(true);
    try {
      // Use toJpeg for better rendering of signatures/images in PDF
      const dataUrl = await toJpeg(receiptRef.current, {
        quality: 0.95,
        pixelRatio: 3,
        backgroundColor: '#ffffff',
      });

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const imgProps = pdf.getImageProperties(dataUrl);
      const pdfWidth = 100; // Slip width in PDF
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

      pdf.addImage(dataUrl, 'JPEG', 10, 10, pdfWidth, pdfHeight);
      pdf.save(`Recibo_${date.replace(/\//g, '-')}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Erro ao gerar PDF.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f9f9f9] text-[#1a1c1c] font-sans flex flex-col print:bg-white">
      {/* Header - No Print */}
      <header className="bg-white w-full sticky top-0 border-b border-[#7e7576] flex justify-between items-center px-6 h-12 z-[60] no-print shadow-sm">
        <button 
          onClick={onBack}
          className="transition-colors duration-200 active:opacity-70 text-black flex items-center hover:bg-gray-100 p-1 rounded"
        >
          <ArrowLeft size={24} />
        </button>
        <h1 className="font-serif text-lg font-bold uppercase tracking-widest text-black">
          {view === 'form' ? 'RECIBO' : 'HISTÓRICO'}
        </h1>
        <div className="flex items-center gap-2">
          {view === 'form' && (
            <>
              <button 
                onClick={handleDownloadPDF}
                disabled={generating || isSaving}
                className="transition-colors duration-200 active:opacity-70 text-black flex items-center hover:bg-gray-100 p-1 rounded disabled:opacity-50"
                title="Baixar PDF"
              >
                {generating ? <Loader2 size={24} className="animate-spin" /> : <Download size={24} />}
              </button>
              <button 
                onClick={saveReceipt}
                disabled={isSaving}
                className="transition-colors duration-200 active:opacity-70 text-black flex items-center hover:bg-gray-100 p-1 rounded disabled:opacity-50"
                title="Salvar"
              >
                {isSaving ? <Loader2 size={24} className="animate-spin" /> : <Save size={24} />}
              </button>
            </>
          )}
          <button 
            onClick={handlePrint}
            className="transition-colors duration-200 active:opacity-70 text-black flex items-center hover:bg-gray-100 p-1 rounded"
            title="Imprimir"
          >
            <Printer size={24} />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-grow flex justify-center py-6 px-4 md:px-8 pb-32">
        <AnimatePresence mode="wait">
          {view === 'form' ? (
            <motion.div 
              key="form"
              id="receipt-content"
              ref={receiptRef}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-white w-full max-w-[800px] shadow-lg md:shadow-xl p-8 md:p-12 relative border border-[#cfc4c5] print:shadow-none print:border-none print:p-0"
            >
          {/* Header Row */}
          <div className="text-center mb-10">
            <h2 className="font-serif text-2xl md:text-3xl font-bold tracking-[0.3em] uppercase underline underline-offset-8">RECIBO</h2>
          </div>

          {/* Selection Section & Date */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8 items-end no-print">
            <div>
              <h3 className="font-bold text-sm mb-2 uppercase tracking-wider text-gray-600">Congregação:</h3>
              <select
                value={selectedCongregation}
                onChange={(e) => setSelectedCongregation(e.target.value)}
                className="w-full border-b-2 border-gray-200 focus:border-black bg-transparent outline-none py-1 transition-colors"
              >
                <option value="">Selecione...</option>
                {congregations.map(c => (
                  <option key={c.id} value={c.nome}>{c.nome}</option>
                ))}
              </select>
            </div>
            <div>
              <h3 className="font-bold text-sm mb-2 uppercase tracking-wider text-gray-600">Escolha o tipo:</h3>
              <div className="flex gap-8">
                {Object.entries(types).map(([key, value]) => (
                  <label key={key} className="flex items-center cursor-pointer group select-none">
                    <input 
                      type="checkbox"
                      checked={value}
                      onChange={() => setTypes(prev => ({ ...prev, [key]: !prev[key as keyof typeof types] }))}
                      className="w-5 h-5 border border-[#7e7576] text-black focus:ring-0 mr-2 rounded-none cursor-pointer"
                    />
                    <span className="text-sm md:text-base font-medium capitalize">
                      {key}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-baseline mb-12">
            <span className="font-bold text-sm mr-2 uppercase tracking-wider text-gray-600">Data:</span>
            <input 
              type="text" 
              value={date}
              onChange={(e) => setDate(e.target.value)}
              placeholder="___/___/___"
              className="w-40 border-b-2 border-gray-200 focus:border-black bg-transparent outline-none text-center font-bold py-1 transition-colors"
            />
          </div>

          {/* Financial Items */}
          <div className="space-y-6 mb-12">
            {items.map((item, idx) => (
              <div key={idx} className="flex items-end gap-4 h-10">
                <div className="flex-grow flex items-end">
                  {item.label ? (
                    <span className="text-base md:text-lg font-medium">{item.label}</span>
                  ) : (
                    <input 
                      type="text"
                      value={item.label}
                      onChange={(e) => {
                        const newItems = [...items];
                        newItems[idx].label = e.target.value;
                        setItems(newItems);
                      }}
                      placeholder="Outro item..."
                      className="w-full border-b border-gray-100 focus:border-gray-300 bg-transparent outline-none py-1"
                    />
                  )}
                </div>
                <div className="w-32 md:w-48 flex items-baseline border-b-2 border-gray-100 focus-within:border-black transition-colors py-1">
                  <span className="mr-2 text-sm font-bold text-gray-400">R$</span>
                  <input 
                    type="text"
                    value={item.value}
                    onChange={(e) => handleValueChange(idx, e.target.value)}
                    placeholder="0,00"
                    className="w-full bg-transparent outline-none text-right font-bold text-lg md:text-xl"
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Total Section */}
          <div className="flex justify-end items-center mb-16">
            <div className="bg-slate-50 px-6 py-4 rounded-xl border-2 border-[#10B981] flex items-center shadow-md transform hover:scale-105 transition-transform duration-200">
              <span className="text-xl md:text-2xl font-black text-slate-800 mr-6 uppercase tracking-tighter">TOTAL:</span>
              <div className="flex items-baseline min-w-[120px] text-[#059669]">
                <span className="mr-2 font-black text-lg">R$</span>
                <span className="font-black text-2xl md:text-4xl tabular-nums">
                  {total}
                </span>
              </div>
            </div>
          </div>

          {/* Signatures */}
          <div className="grid grid-cols-2 gap-12 md:gap-16 mt-20 md:mt-32 items-end">
            <div className="text-center flex flex-col items-center">
              {personalData?.signatureImage ? (
                <img 
                  src={personalData.signatureImage} 
                  alt="Signature" 
                  className="h-16 mb-[-10px] object-contain print:h-20" 
                />
              ) : (
                <div className="mb-2 text-sm md:text-base font-medium italic text-slate-700 font-serif">
                  {personalData?.nome || 'Viajante'}
                </div>
              )}
              <div className="border-t border-[#7e7576] w-full mb-1"></div>
              <span className="text-[10px] md:text-xs uppercase text-gray-500 font-bold tracking-tighter">(Assinatura do Viajante)</span>
            </div>
            <div className="text-center flex flex-col items-center">
              <input 
                type="text"
                value={checkedBy}
                onChange={(e) => setCheckedBy(e.target.value)}
                placeholder="Nome de quem conferiu"
                className="w-full text-center border-b border-transparent focus:border-gray-200 outline-none text-sm font-medium mb-1 bg-transparent no-print-placeholder"
              />
              <div className="border-t border-[#7e7576] w-full mb-1"></div>
              <span className="text-[10px] md:text-xs uppercase text-gray-500 font-bold tracking-tighter">(Conferido por)</span>
            </div>
          </div>
        </motion.div>
          ) : (
            <motion.div 
              key="history"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-white w-full max-w-[800px] shadow-lg md:shadow-xl p-6 md:p-8 relative border border-[#cfc4c5] flex flex-col"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="font-serif text-2xl font-bold uppercase tracking-wider text-slate-800">Histórico de Gastos</h2>
                <div className="relative">
                  <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input 
                    type="text"
                    placeholder="Buscar data ou item..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 pr-4 py-2 border rounded-full text-sm outline-none focus:ring-2 focus:ring-[#10B981] transition-all"
                  />
                </div>
              </div>

              {loading ? (
                <div className="flex-grow flex items-center justify-center py-20">
                  <Loader2 size={40} className="animate-spin text-[#10B981]" />
                </div>
              ) : filteredHistory.length === 0 ? (
                <div className="flex-grow flex flex-col items-center justify-center py-20 text-gray-400">
                  <History size={48} className="mb-4 opacity-20" />
                  <p>Nenhum recibo encontrado.</p>
                </div>
              ) : (
                <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                  {filteredHistory.map((rec) => (
                    <div 
                      key={rec.id}
                      className="p-4 border rounded-xl hover:bg-slate-50 transition-colors group relative"
                    >
                      <div className="flex justify-between items-start">
                        <div className="cursor-pointer flex-grow" onClick={() => loadReceiptToForm(rec)}>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-bold text-slate-900">{rec.date}</span>
                            <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded uppercase text-slate-500">
                              {rec.types.donativo ? 'Donativo' : rec.types.pagamento ? 'Pagamento' : 'Recibo'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 line-clamp-1">
                            {rec.items.filter(i => i.label && i.value).map(i => i.label).join(', ')}
                          </p>
                          <div className="mt-2 font-black text-[#059669]">R$ {rec.total}</div>
                        </div>
                        <button 
                          onClick={() => deleteReceipt(rec.id)}
                          className="p-2 text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Bottom Nav - No Print */}
      <nav className="fixed bottom-0 w-full z-50 bg-white border-t border-[#7e7576] flex justify-around items-center h-16 pb-safe no-print">
        <button 
          onClick={() => setView('history')}
          className={`flex flex-col items-center justify-center transition-colors ${view === 'history' ? 'text-black' : 'text-gray-500 hover:text-black'}`}
        >
          <History size={20} />
          <span className="text-[10px] mt-1 uppercase font-bold">Histórico</span>
        </button>
        <button 
          onClick={resetForm}
          className={`flex flex-col items-center justify-center transition-colors ${view === 'form' ? 'text-black' : 'text-gray-500 hover:text-black'}`}
        >
          <PlusSquare size={24} className={view === 'form' ? 'text-black' : 'text-gray-500'} />
          <span className="text-[10px] mt-1 uppercase font-bold">Novo</span>
        </button>
        <button className="flex flex-col items-center justify-center text-gray-500 hover:text-black transition-colors">
          <Settings size={20} />
          <span className="text-[10px] mt-1 uppercase font-bold">Config</span>
        </button>
      </nav>

      <style jsx global>{`
        @media print {
          /* Reset everything */
          * {
            visibility: hidden !important;
            box-shadow: none !important;
            text-shadow: none !important;
          }
          
          /* Only the receipt content should be visible */
          #receipt-content, 
          #receipt-content * {
            visibility: visible !important;
          }

          /* Reset page margins */
          @page {
            size: auto;
            margin: 0;
          }

          body {
            background: white !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
          }

          /* Position the receipt at the top left of the page */
          #receipt-content {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 80mm !important;
            max-width: 80mm !important;
            height: auto !important;
            padding: 10mm !important;
            border: 1px solid #ccc !important;
            margin: 0 !important;
            display: block !important;
            background: white !important;
            transform: none !important;
            opacity: 1 !important;
          }

          .no-print {
            display: none !important;
          }

          .no-print-placeholder::placeholder {
            color: transparent !important;
          }

          /* Adjust font sizes for slip look */
          #receipt-content h2 { font-size: 1.1rem !important; margin-bottom: 1rem !important; }
          #receipt-content .text-base { font-size: 0.8rem !important; }
          #receipt-content .text-lg { font-size: 0.9rem !important; }
          #receipt-content .text-xl { font-size: 1rem !important; }
          #receipt-content .text-2xl { font-size: 1.1rem !important; }
          #receipt-content .text-4xl { font-size: 1.3rem !important; }
          
          /* Ensure checkboxes look like checkboxes if possible, otherwise hide labels of unchecked ones or just show checked ones */
          input[type="checkbox"] {
            visibility: visible !important;
            -webkit-appearance: checkbox !important;
            appearance: checkbox !important;
          }
        }
      `}</style>
    </div>
  );
}
