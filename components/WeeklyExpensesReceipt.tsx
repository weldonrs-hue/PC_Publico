'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, ChevronLeft, Printer, History, Home, PlusSquare, Settings, Save, Trash2, Loader2, Search, Download } from 'lucide-react';
import { db, auth } from '@/lib/firebase';
import { collection, addDoc, getDocs, query, where, orderBy, serverTimestamp, deleteDoc, doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import { toJpeg } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { useDialog } from '@/hooks/useDialog';
import DraggableSignature from './DraggableSignature';

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
  const { showAlert, showConfirm } = useDialog();
  const [view, setView] = useState<'form' | 'history'>('form');
  const [history, setHistory] = useState<ReceiptRecord[]>([]);
  const [congregations, setCongregations] = useState<{ id: string; nome: string }[]>([]);
  const [selectedCongregation, setSelectedCongregation] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null); // ID do recibo sendo editado
  const [searchTerm, setSearchTerm] = useState('');
  const [checkedBy, setCheckedBy] = useState('');
  const [personalData, setPersonalData] = useState<any>(null);
  const [generating, setGenerating] = useState(false);
  const [useGlobalSignature, setUseGlobalSignature] = useState(false);
  const [signaturePlacement, setSignaturePlacement] = useState<{ x: number, y: number, scale: number } | null>(null);
  const receiptRef = useRef<HTMLDivElement>(null);

  const initialItems = [
    { label: 'Mercado da Semana', value: '' },
    { label: 'Feira Livre', value: '' },
    { label: 'Carnes e Peixes', value: '' },
    { label: '', value: '' },
    { label: '', value: '' },
  ];

  const [items, setItems] = useState(initialItems);

  // Calcula o total dos itens formatado em pt-BR
  const calculateTotal = (currentItems: { label: string, value: string }[]) => {
    const sum = currentItems.reduce((acc, item) => {
      // Remove o separador de milhar (.) e substitui a vírgula por ponto para o cálculo
      const cleanValue = item.value.replace(/\./g, '').replace(',', '.');
      const val = parseFloat(cleanValue) || 0;
      return acc + val;
    }, 0);
    return sum.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Manipula a alteração de valores monetários com máscara 0,00
  const handleValueChange = (idx: number, newValue: string) => {
    const newItems = [...items];
    // Remove caracteres não numéricos
    let value = newValue.replace(/\D/g, '');
    
    // Converte para número e formata como 0,00
    if (value === '') {
      newItems[idx].value = '';
    } else {
      const numberValue = parseInt(value) / 100;
      newItems[idx].value = numberValue.toLocaleString('pt-BR', { 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2 
      });
    }
    
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
          const data = pdDoc.data();
          setPersonalData(data);
          if (data.signatureImage || data.signature) {
            setUseGlobalSignature(true);
          }
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
    fetchSignaturePlacement();
  }, []);

  const fetchSignaturePlacement = async () => {
    if (!auth.currentUser) return;
    try {
      const placementId = `receipt_${auth.currentUser.uid}`;
      const docRef = doc(db, 'signature_placements', placementId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setSignaturePlacement(docSnap.data() as any);
      } else {
        setSignaturePlacement({ x: 90, y: 885, scale: 1.2 });
      }
    } catch (error) {
      console.error('Error fetching signature placement:', error);
      setSignaturePlacement({ x: 90, y: 885, scale: 1.2 });
    }
  };

  const handleSignaturePlacementSave = async (settings: { x: number, y: number, scale: number }) => {
    if (!auth.currentUser) return;
    setSignaturePlacement(settings);
    try {
      const placementId = `receipt_${auth.currentUser.uid}`;
      await setDoc(doc(db, 'signature_placements', placementId), settings);
    } catch (error) {
      console.error('Error saving signature placement:', error);
    }
  };

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

  // Salva ou atualiza o recibo no Firebase
  const saveReceipt = async () => {
    if (!auth.currentUser) return;
    if (total === '0,00') {
      await showAlert('O total deve ser maior que zero para salvar.', 'Aviso');
      return;
    }

    setIsSaving(true);
    try {
      const receiptData = {
        userId: auth.currentUser.uid,
        date,
        items,
        types,
        total,
        checkedBy,
        congregation: selectedCongregation,
        updatedAt: serverTimestamp(),
      };

      if (editingId) {
        // Atualiza o recibo existente
        await updateDoc(doc(db, 'weekly_expenses', editingId), receiptData);
        await showAlert('Recibo atualizado com sucesso!', 'Sucesso');
      } else {
        // Salva um novo recibo
        await addDoc(collection(db, 'weekly_expenses'), {
          ...receiptData,
          createdAt: serverTimestamp(),
        });
        await showAlert('Recibo salvo com sucesso!', 'Sucesso');
      }
      
      resetForm();
      setView('history');
    } catch (error) {
      console.error('Error saving receipt:', error);
      await showAlert('Erro ao salvar recibo.', 'Erro');
    } finally {
      setIsSaving(false);
    }
  };

  const deleteReceipt = async (id: string) => {
    if (await showConfirm('Esta ação não pode ser desfeita. O registro será removido permanentemente do histórico.', 'Excluir Recibo?')) {
      try {
        await deleteDoc(doc(db, 'weekly_expenses', id));
        setHistory(prev => prev.filter(item => item.id !== id));
        await showAlert('Recibo excluído com sucesso!', 'Sucesso');
      } catch (error) {
        console.error('Error deleting receipt:', error);
        await showAlert('Erro ao excluir recibo.', 'Erro');
      }
    }
  };

  // Limpa o formulário e reseta o ID de edição
  const resetForm = () => {
    setItems(initialItems);
    setTypes({ donativo: false, pagamento: false });
    setDate(new Date().toLocaleDateString('pt-BR'));
    setCheckedBy('');
    setSelectedCongregation('');
    setEditingId(null);
    setView('form');
  };

  // Carrega os dados de um recibo no formulário para edição
  const loadReceiptToForm = (record: ReceiptRecord) => {
    setItems(record.items);
    setTypes(record.types);
    setDate(record.date);
    setCheckedBy(record.checkedBy || '');
    setSelectedCongregation(record.congregation || '');
    setEditingId(record.id);
    setView('form');
  };

  const filteredHistory = history.filter(h => 
    h.date.includes(searchTerm) || 
    (h.congregation && h.congregation.toLowerCase().includes(searchTerm.toLowerCase())) ||
    h.items.some(i => i.label.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    const element = receiptRef.current;
    if (!element) return;

    setGenerating(true);
    try {
      // Force margin 0 and no transform to ensure we capture ONLY the receipt itself
      // without any screen centering offsets
      const dataUrl = await toJpeg(element, {
        quality: 0.95,
        pixelRatio: 3,
        backgroundColor: '#ffffff',
        width: 800, // Explicitly set width to match the component's base width
        style: {
          margin: '0',
          padding: '48px', // Match p-12 (12 * 4 = 48px)
          transform: 'none',
          left: '0',
          top: '0',
          boxShadow: 'none',
          borderRadius: '0',
        }
      });

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true
      });

      const imgProps = pdf.getImageProperties(dataUrl);
      const pageWidth = pdf.internal.pageSize.getWidth();
      
      // Use a more standard margin (10mm on each side)
      const margin = 10;
      const fullWidth = pageWidth - (margin * 2);
      const pageHeight = pdf.internal.pageSize.getHeight();
      
      // Target width is 50% of page width, but check height too
      let imgWidth = fullWidth * 0.5;
      let imgHeight = (imgProps.height * imgWidth) / imgProps.width;
      
      // If still too tall for one page (leaving 15mm top and 15mm bottom margin)
      const maxAvailableHeight = pageHeight - 30;
      if (imgHeight > maxAvailableHeight) {
        imgHeight = maxAvailableHeight;
        imgWidth = (imgHeight * imgProps.width) / imgProps.height;
      }
      
      const xOffset = (pageWidth - imgWidth) / 2; // Center horizontally
      const yOffset = 15; // 15mm from top

      pdf.addImage(dataUrl, 'JPEG', xOffset, yOffset, imgWidth, imgHeight, undefined, 'FAST');
      pdf.save(`Recibo_Despesas_${date.replace(/\//g, '-') || 'Sem_Data'}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      await showAlert('Erro ao gerar o PDF. Por favor, tente novamente.', 'Erro');
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
          <ChevronLeft size={28} strokeWidth={3} />
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
                {generating ? <Loader2 size={20} className="animate-spin" /> : <Download size={20} />}
              </button>
              <button 
                onClick={saveReceipt}
                disabled={isSaving}
                className="transition-colors duration-200 active:opacity-70 text-black flex items-center hover:bg-gray-100 p-1 rounded disabled:opacity-50"
                title="Salvar"
              >
                {isSaving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
              </button>
            </>
          )}
          <button 
            onClick={handlePrint}
            className="transition-colors duration-200 active:opacity-70 text-black flex items-center hover:bg-gray-100 p-1 rounded"
            title="Imprimir"
          >
            <Printer size={20} />
          </button>
        </div>
      </header>

      {/* Área de Conteúdo Principal - Permite rolagem horizontal em telas pequenas */}
      <main className="flex-grow flex flex-col p-0 md:p-8 overflow-hidden">
        <AnimatePresence mode="wait">
          {view === 'form' ? (
            <div className="w-full overflow-x-auto pb-20 pt-4 md:pt-0">
              {/* min-w-max garante que o container interno tenha pelo menos a largura do recibo (800px) */}
              <div className="min-w-max px-4">
                <motion.div 
                  key="form"
                  id="receipt-content"
                  ref={receiptRef}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  /* mx-auto centraliza o recibo quando a tela é maior que 800px */
                  className="bg-white w-[800px] mx-auto shadow-lg md:shadow-xl p-8 md:p-12 relative border border-[#cfc4c5] print:shadow-none print:border-none print:p-0 print:m-0"
                >
          {/* Header Row */}
          <div className="text-center mb-10 print:mb-6">
            <h2 className="font-serif text-2xl md:text-3xl font-bold tracking-[0.3em] uppercase underline underline-offset-8">RECIBO</h2>
          </div>

          {/* Selection Section & Date */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8 items-end no-print">
            <div className="space-y-4">
              <div>
                <h3 className="font-bold text-sm mb-2 uppercase tracking-wider text-gray-600">Evento da Semana:</h3>
                <input
                  type="text"
                  list="congregations-list"
                  value={selectedCongregation}
                  onChange={(e) => setSelectedCongregation(e.target.value)}
                  placeholder="Selecione ou digite o evento..."
                  className="w-full border-b-2 border-gray-200 focus:border-black bg-transparent outline-none py-1 transition-colors"
                />
                <datalist id="congregations-list">
                  {congregations.map(c => (
                    <option key={c.id} value={`Congregação ${c.nome}`} />
                  ))}
                </datalist>
              </div>
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

          {/* Print only version of selection */}
          <div className="hidden print:flex justify-between mb-4 items-center border-b-2 border-gray-300 pb-4">
            <div className="flex gap-8">
              {Object.entries(types).map(([key, value]) => (
                <div key={key} className="flex items-center">
                  <div className={`w-5 h-5 border border-[#7e7576] mr-2 flex items-center justify-center font-bold ${value ? 'bg-black text-white' : 'bg-transparent'}`}>
                    {value ? 'X' : ''}
                  </div>
                  <span className="text-sm font-bold capitalize">
                    {key}
                  </span>
                </div>
              ))}
            </div>
            {selectedCongregation && (
              <span className="font-bold text-sm uppercase tracking-widest text-slate-800">
                {selectedCongregation}
              </span>
            )}
          </div>

          <div className="flex items-baseline mb-12 print:mb-6">
            <span className="font-bold text-sm mr-2 uppercase tracking-wider text-gray-600">Data:</span>
            <div className="w-40 border-b-2 border-gray-400 flex justify-center">
              <input 
                type="text" 
                value={date}
                onChange={(e) => setDate(e.target.value)}
                placeholder="___/___/___"
                className="w-full bg-transparent outline-none text-center font-bold py-1 transition-colors print:hidden"
              />
              <span className="hidden print:block font-bold py-1">
                {date}
              </span>
            </div>
          </div>

          {/* Financial Items */}
          <div className="flex flex-col gap-6 mb-8 print:mb-6 print:gap-2">
            {items.map((item, idx) => {
              return (
                <div key={idx} className="flex items-end gap-4 h-10">
                  <div className="flex-grow flex items-end border-b-2 border-gray-300 min-h-[40px]">
                    {idx < 3 ? (
                      <span className="text-base md:text-lg font-medium mb-1">{item.label}</span>
                    ) : (
                      <div className="w-full relative">
                        <input 
                          type="text"
                          value={item.label}
                          onChange={(e) => {
                            const newItems = [...items];
                            newItems[idx].label = e.target.value;
                            setItems(newItems);
                          }}
                          placeholder="Outro item..."
                          className="w-full bg-transparent outline-none py-1 print:hidden"
                        />
                        <span className="hidden print:block text-base md:text-lg font-medium mb-1 min-h-[1.5rem]">
                          {item.label}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="w-32 md:w-48 flex items-baseline border-b-2 border-gray-400 focus-within:border-black transition-colors py-1">
                    <span className="mr-2 text-sm font-bold text-gray-400">R$</span>
                    <input 
                      type="text"
                      value={item.value}
                      onChange={(e) => handleValueChange(idx, e.target.value)}
                      placeholder="0,00"
                      className="w-full bg-transparent outline-none text-right font-bold text-lg md:text-xl print:hidden"
                    />
                    <span className="hidden print:block w-full text-right font-bold text-lg md:text-xl tabular-nums">
                      {item.value || '0,00'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Total Section */}
          <div className="flex justify-end items-center mb-16 print:mb-8">
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
          <div className="grid grid-cols-2 gap-12 md:gap-16 mt-20 md:mt-32 items-end print:mt-10">
            <div className="text-center flex flex-col items-center">
              <div className="h-16 flex items-end justify-center print:h-12 relative w-full group/sig">
                {!useGlobalSignature && !generating && (personalData?.signatureImage || personalData?.signature) && (
                  <button
                    onClick={() => setUseGlobalSignature(true)}
                    className="no-print mb-2 px-3 py-1 bg-violet-50 text-violet-600 rounded-lg text-[10px] font-black uppercase tracking-wider border border-violet-100 hover:bg-violet-100 transition-all"
                  >
                    Incluir Assinatura
                  </button>
                )}
              </div>
              <div className="border-t-2 border-slate-400 w-full mb-1"></div>
              <span className="text-[10px] md:text-xs uppercase text-gray-500 font-bold tracking-tighter">
                {personalData?.nome || 'Viajante'} {personalData?.circuito ? `- ${personalData.circuito}` : ''}
              </span>
            </div>
            
            <div className={`text-center flex flex-col items-center transition-opacity ${!checkedBy ? 'print:opacity-0' : ''}`}>
              <input 
                type="text"
                value={checkedBy}
                onChange={(e) => setCheckedBy(e.target.value)}
                placeholder=""
                className="w-full text-center border-b border-transparent focus:border-gray-200 outline-none text-sm font-medium mb-1 bg-transparent print:hidden"
              />
              <span className={`hidden print:block text-sm font-medium mb-1 h-5 ${!checkedBy ? 'invisible' : ''}`}>
                {checkedBy}
              </span>
              <div className={`border-t-2 border-slate-400 w-full mb-1 ${!checkedBy ? 'print:invisible' : ''}`}></div>
              <span className={`text-[10px] md:text-xs uppercase text-gray-500 font-bold tracking-tighter ${!checkedBy ? 'print:invisible' : ''}`}>
                (Conferido por)
              </span>
            </div>
          </div>

          {/* Draggable Signature Layer */}
          {useGlobalSignature && (personalData?.signatureImage || personalData?.signature) && signaturePlacement && (
            <DraggableSignature 
              image={personalData.signatureImage || personalData.signature}
              initialX={signaturePlacement.x}
              initialY={signaturePlacement.y}
              initialScale={signaturePlacement.scale}
              onSave={handleSignaturePlacementSave}
              onRemove={() => setUseGlobalSignature(false)}
              containerRef={receiptRef}
            />
          )}
          </motion.div>
        </div>
      </div>
          ) : (
            <motion.div 
              key="history"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              /* Centraliza o histórico na tela */
              className="bg-white w-full max-w-[800px] mx-auto shadow-lg md:shadow-xl p-6 md:p-8 relative border border-[#cfc4c5] flex flex-col"
            >
              {/* Histórico de Recibos */}
              <div className="flex justify-between items-center mb-6">
                <h2 className="font-serif text-2xl font-bold uppercase tracking-wider text-slate-800">Histórico</h2>
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
                            {rec.congregation && (
                              <span className="text-[10px] bg-emerald-50 px-2 py-0.5 rounded uppercase text-emerald-700 font-bold">
                                {rec.congregation}
                              </span>
                            )}
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
                          className="p-2 text-gray-400 hover:text-red-500 transition-colors md:opacity-0 md:group-hover:opacity-100 active:text-red-600"
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

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page {
            size: A4 portrait;
            margin: 0;
          }
          body * {
            visibility: hidden;
          }
          #receipt-content, #receipt-content * {
            visibility: visible !important;
          }
          body {
            background: white !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          #receipt-content {
            display: block !important;
            position: relative !important;
            margin: 0 auto !important;
            width: 800px !important;
            border: none !important;
            box-shadow: none !important;
            overflow: visible !important;
            background: white !important;
            padding: 10mm !important;
            transform: scale(0.45) !important; /* Slightly smaller than 0.5 to be safe */
            transform-origin: top center !important;
            height: auto !important;
            max-height: 270mm !important; /* Ensure it stays within A4 height (297mm) */
          }
          header, nav, .no-print, button {
            display: none !important;
          }
        }
      `}} />
    </div>
  );
}
