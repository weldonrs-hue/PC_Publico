'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, 
  ChevronLeft, 
  Printer, 
  History, 
  Home, 
  PlusSquare, 
  Settings, 
  Save, 
  Trash2, 
  Loader2, 
  Search, 
  Download, 
  Receipt,
  LayoutList,
  Maximize2,
  Minimize2,
  Check,
  Calendar,
  Building2,
  Eye,
  Plus
} from 'lucide-react';
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
  const [view, setView] = useState<'form' | 'folha' | 'history'>('form');
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
  const [isFitToScreen, setIsFitToScreen] = useState<boolean>(true);
  const [scaleRatio, setScaleRatio] = useState<number>(1);
  const receiptRef = useRef<HTMLDivElement>(null);
  const paperContainerRef = useRef<HTMLDivElement>(null);

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
    const updateScale = () => {
      if (paperContainerRef.current) {
        const containerWidth = paperContainerRef.current.clientWidth;
        if (isFitToScreen && containerWidth < 820) {
          const calculatedScale = Math.max(0.35, Math.min(1, (containerWidth - 24) / 800));
          setScaleRatio(calculatedScale);
        } else {
          setScaleRatio(1);
        }
      }
    };
    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, [isFitToScreen, view]);

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

  const renderOfficialReceipt = () => (
    <motion.div 
      key="official-receipt"
      id="receipt-content"
      ref={receiptRef}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="bg-white w-[800px] mx-auto shadow-lg md:shadow-xl p-8 md:p-12 relative border border-[#cfc4c5] print:shadow-none print:border-none print:p-0 print:m-0 shrink-0 text-slate-900"
    >
      {/* Header Row */}
      <div className="text-center mb-10 print:mb-6">
        <h2 className="font-serif text-2xl md:text-3xl font-bold tracking-[0.3em] uppercase underline underline-offset-8">RECIBO</h2>
      </div>

      {/* Selection Section & Date */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8 items-end no-print">
        <div className="space-y-4">
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
            Congregação {selectedCongregation}
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
                type="button"
                onClick={() => setUseGlobalSignature(true)}
                className="no-print mb-2 px-3 py-1 bg-violet-50 text-violet-600 rounded-lg text-[10px] font-black uppercase tracking-wider border border-violet-100 hover:bg-violet-100 transition-all cursor-pointer"
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
  );

  return (
    <div className="space-y-4 pb-12 print:p-0 print:m-0 print:space-y-0">
      {/* Screen Header & Top Controls (no-print) */}
      <div className="space-y-3 no-print">
        <div className="flex items-center justify-between gap-3 bg-surface-100 p-3 sm:p-4 rounded-3xl border border-surface-300 shadow-xs flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <button 
              onClick={onBack}
              className="h-9 w-9 sm:h-10 sm:w-10 p-1.5 sm:p-2 hover:bg-surface-200 active:scale-95 rounded-xl transition-all text-typography-900 bg-surface-200/80 shadow-xs border border-surface-300 flex items-center justify-center shrink-0 cursor-pointer"
              title="Voltar para Diversos"
            >
              <ArrowLeft size={18} strokeWidth={2.5} />
            </button>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-black text-typography-900 tracking-tight leading-none truncate">
                  Despesas da Semana
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
                  {editingId ? 'Editando' : view === 'form' ? 'Formulário' : view === 'folha' ? 'Folha A4' : 'Histórico'}
                </span>
              </div>
              <p className="text-[11px] sm:text-xs font-medium text-typography-500 truncate mt-0.5">
                Controle financeiro e geração de recibos semanais
              </p>
            </div>
          </div>

          {/* Alternador de Modo: Formulário vs Folha A4 vs Histórico */}
          <div className="flex items-center bg-surface-200/80 p-0.5 rounded-xl border border-surface-300 shadow-2xs">
            <button
              onClick={() => setView('form')}
              className={`h-8 sm:h-9 px-2.5 sm:px-3 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                view === 'form'
                  ? 'bg-primary-200 text-white shadow-xs'
                  : 'text-typography-600 hover:text-typography-900'
              }`}
              title="Preenchimento rápido e fácil no celular"
            >
              <LayoutList size={14} />
              <span>Formulário</span>
            </button>
            <button
              onClick={() => setView('folha')}
              className={`h-8 sm:h-9 px-2.5 sm:px-3 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                view === 'folha'
                  ? 'bg-primary-200 text-white shadow-xs'
                  : 'text-typography-600 hover:text-typography-900'
              }`}
              title="Visualização da folha oficial de recibo (A4)"
            >
              <Receipt size={14} />
              <span>Folha A4</span>
            </button>
            <button
              onClick={() => setView('history')}
              className={`h-8 sm:h-9 px-2.5 sm:px-3 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                view === 'history'
                  ? 'bg-primary-200 text-white shadow-xs'
                  : 'text-typography-600 hover:text-typography-900'
              }`}
              title="Histórico de recibos salvos"
            >
              <History size={14} />
              <span>Histórico</span>
            </button>
          </div>

          {/* Action Bar */}
          <div className="flex items-center gap-1.5 sm:gap-2 ml-auto flex-wrap">
            {view !== 'history' && (
              <>
                <button
                  onClick={resetForm}
                  className="h-9 sm:h-10 px-2.5 sm:px-3 rounded-xl text-xs font-bold text-typography-700 bg-surface-200/80 hover:bg-surface-200 border border-surface-300 shadow-xs flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] cursor-pointer"
                  title="Limpar formulário e iniciar novo recibo"
                >
                  <PlusSquare size={14} className="shrink-0 text-typography-500" />
                  <span className="hidden sm:inline">Novo</span>
                </button>
                <button
                  onClick={handleDownloadPDF}
                  disabled={generating || isSaving}
                  className="h-9 sm:h-10 px-2.5 sm:px-3 rounded-xl text-xs font-bold text-blue-700 dark:text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 shadow-xs flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                  title="Baixar Recibo em PDF"
                >
                  {generating ? <Loader2 size={14} className="animate-spin shrink-0" /> : <Download size={14} className="shrink-0 text-blue-600 dark:text-blue-400" />}
                  <span className="hidden sm:inline">PDF</span>
                </button>
                <button
                  onClick={saveReceipt}
                  disabled={isSaving}
                  className="h-9 sm:h-10 px-2.5 sm:px-3.5 rounded-xl text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 shadow-xs flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                  title="Salvar no Histórico"
                >
                  {isSaving ? <Loader2 size={14} className="animate-spin shrink-0" /> : <Save size={14} className="shrink-0 text-emerald-600 dark:text-emerald-400" />}
                  <span>{editingId ? 'Atualizar' : 'Salvar'}</span>
                </button>
              </>
            )}

            <button
              onClick={handlePrint}
              className="h-9 sm:h-10 px-2.5 sm:px-3.5 rounded-xl text-xs font-bold text-typography-700 bg-surface-200/80 hover:bg-surface-200 border border-surface-300 shadow-xs flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] cursor-pointer"
              title="Imprimir"
            >
              <Printer size={14} className="shrink-0 text-typography-500" />
              <span className="hidden sm:inline">Imprimir</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="w-full">
        {/* Offscreen receipt for PDF / Print when NOT in 'folha' mode */}
        {view !== 'folha' && (
          <div className="fixed -left-[9999px] top-0 pointer-events-none no-print offscreen-receipt">
            {renderOfficialReceipt()}
          </div>
        )}

        <AnimatePresence mode="wait">
          {view === 'form' && (
            <motion.div
              key="mobile-form"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              className="max-w-3xl mx-auto space-y-4 sm:space-y-6"
            >
              {/* Card 1: Identificação & Tipo */}
              <div className="bg-surface-100 rounded-3xl border border-surface-300 shadow-xs p-4 sm:p-7 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-surface-300">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-primary-200/10 text-primary-200 flex items-center justify-center border border-primary-200/20">
                      <Building2 size={16} />
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-base font-black text-typography-900 tracking-tight">Identificação do Recibo</h3>
                      <p className="text-[11px] text-typography-500">Dados da congregação e modalidade</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                    Semanal
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Congregação */}
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-typography-700">
                      Congregação
                    </label>
                    <select
                      value={selectedCongregation}
                      onChange={(e) => setSelectedCongregation(e.target.value)}
                      className="w-full bg-surface-200/60 border border-surface-300 focus:border-primary-200 rounded-2xl px-3.5 py-3 text-xs sm:text-sm font-semibold text-typography-900 outline-none transition-all cursor-pointer"
                    >
                      <option value="">Selecione a Congregação...</option>
                      {congregations.map(c => (
                        <option key={c.id} value={c.nome}>{c.nome}</option>
                      ))}
                    </select>
                  </div>

                  {/* Tipo de Recibo */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-typography-700">
                      Tipo
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {(['donativo', 'pagamento'] as const).map(typeKey => {
                        const active = types[typeKey];
                        return (
                          <button
                            key={typeKey}
                            type="button"
                            onClick={() => setTypes(prev => ({ ...prev, [typeKey]: !prev[typeKey] }))}
                            className={`py-3 px-3 rounded-2xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 border transition-all cursor-pointer active:scale-95 ${
                              active
                                ? 'bg-primary-200 text-white border-primary-200 shadow-2xs'
                                : 'bg-surface-200/60 hover:bg-surface-200 text-typography-600 border-surface-300'
                            }`}
                          >
                            <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${active ? 'border-white bg-white/20' : 'border-surface-400'}`}>
                              {active && <Check size={11} strokeWidth={3} />}
                            </div>
                            <span className="capitalize">{typeKey}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Data */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-typography-700">
                      Data
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        placeholder="DD/MM/AAAA"
                        className="w-full bg-surface-200/60 border border-surface-300 focus:border-primary-200 rounded-2xl px-3.5 py-3 text-xs sm:text-sm font-semibold text-typography-900 outline-none transition-all pl-9"
                      />
                      <Calendar size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-typography-400" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 2: Itens de Despesa */}
              <div className="bg-surface-100 rounded-3xl border border-surface-300 shadow-xs p-4 sm:p-7 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-surface-300">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center border border-emerald-500/20">
                      <Receipt size={16} />
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-base font-black text-typography-900 tracking-tight">Despesas da Semana</h3>
                      <p className="text-[11px] text-typography-500">Valores dos comprovantes</p>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-bold text-typography-400">
                    {items.filter(i => i.value).length} / {items.length} itens
                  </span>
                </div>

                <div className="space-y-3">
                  {items.map((item, idx) => (
                    <div 
                      key={idx} 
                      className="bg-surface-200/40 rounded-2xl p-3 sm:p-4 border border-surface-300/80 space-y-2 hover:bg-surface-200/60 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        {idx < 3 ? (
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-surface-300/70 text-[10px] font-black text-typography-600 flex items-center justify-center shrink-0">
                              {idx + 1}
                            </span>
                            <span className="text-xs sm:text-sm font-bold text-typography-800">{item.label}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 flex-1">
                            <span className="w-5 h-5 rounded-full bg-surface-300/70 text-[10px] font-black text-typography-600 flex items-center justify-center shrink-0">
                              {idx + 1}
                            </span>
                            <input
                              type="text"
                              value={item.label}
                              onChange={(e) => {
                                const newItems = [...items];
                                newItems[idx].label = e.target.value;
                                setItems(newItems);
                              }}
                              placeholder={`Descrição do Item ${idx + 1}...`}
                              className="flex-1 bg-surface-100 px-3 py-1.5 rounded-xl border border-surface-300 text-xs sm:text-sm font-semibold text-typography-900 outline-none focus:border-primary-200"
                            />
                          </div>
                        )}
                        {item.value && (
                          <button
                            type="button"
                            onClick={() => handleValueChange(idx, '')}
                            className="p-1.5 text-typography-400 hover:text-rose-500 rounded-lg transition-colors cursor-pointer"
                            title="Limpar valor deste item"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-2 bg-surface-100 px-3.5 py-2.5 rounded-xl border border-surface-300 focus-within:border-primary-200 focus-within:ring-2 focus-within:ring-primary-200/20">
                        <span className="text-xs font-black text-typography-400">R$</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={item.value}
                          onChange={(e) => handleValueChange(idx, e.target.value)}
                          placeholder="0,00"
                          className="flex-1 bg-transparent text-right font-black text-lg sm:text-xl text-typography-900 outline-none font-mono tracking-tight"
                        />
                      </div>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={() => setItems([...items, { label: '', value: '' }])}
                    className="w-full py-3 rounded-2xl border border-dashed border-surface-300 hover:border-primary-200 text-typography-500 hover:text-primary-200 text-xs font-bold flex items-center justify-center gap-1.5 transition-all bg-surface-200/30 cursor-pointer active:scale-98"
                  >
                    <PlusSquare size={14} />
                    <span>Adicionar Outro Item de Despesa</span>
                  </button>
                </div>
              </div>

              {/* Card 3: Total Destacado */}
              <div className="bg-emerald-500/10 border-2 border-emerald-500/30 rounded-3xl p-5 sm:p-6 flex items-center justify-between shadow-xs">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                    Valor Total a Reembolsar
                  </span>
                  <div className="text-xs text-typography-500 font-medium">
                    Soma de todos os comprovantes
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mr-1.5">R$</span>
                  <span className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 font-mono tracking-tight">
                    {total}
                  </span>
                </div>
              </div>

              {/* Card 4: Conferência e Assinatura */}
              <div className="bg-surface-100 rounded-3xl border border-surface-300 shadow-xs p-4 sm:p-7 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-surface-300">
                  <div>
                    <h3 className="text-sm sm:text-base font-black text-typography-900 tracking-tight">Conferência & Assinatura</h3>
                    <p className="text-[11px] text-typography-500">Validação para prestação de contas</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Conferido por */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-typography-700">
                      Conferido por
                    </label>
                    <input
                      type="text"
                      value={checkedBy}
                      onChange={(e) => setCheckedBy(e.target.value)}
                      placeholder="Nome do irmão / ancião responsável..."
                      className="w-full bg-surface-200/60 border border-surface-300 focus:border-primary-200 rounded-2xl px-3.5 py-3 text-xs sm:text-sm font-semibold text-typography-900 outline-none transition-all"
                    />
                  </div>

                  {/* Assinatura do Viajante */}
                  {(personalData?.signatureImage || personalData?.signature) && (
                    <div className="flex items-center justify-between p-3.5 bg-surface-200/50 rounded-2xl border border-surface-300">
                      <div className="space-y-0.5">
                        <div className="text-xs font-bold text-typography-800">
                          Assinatura do Viajante
                        </div>
                        <div className="text-[11px] text-typography-500">
                          {useGlobalSignature ? 'Assinatura inserida no recibo' : 'Disponível no perfil'}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setUseGlobalSignature(!useGlobalSignature)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-95 ${
                          useGlobalSignature
                            ? 'bg-primary-200 text-white shadow-2xs'
                            : 'bg-surface-100 hover:bg-surface-200 text-typography-700 border border-surface-300'
                        }`}
                      >
                        {useGlobalSignature ? 'Remover' : 'Incluir'}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Card 5: Rodapé de Ações Rápidas */}
              <div className="pt-2 flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={() => setView('folha')}
                  className="flex-1 py-3.5 px-4 rounded-2xl bg-surface-200 hover:bg-surface-300/80 text-typography-900 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 border border-surface-300 transition-all cursor-pointer active:scale-98"
                >
                  <Eye size={16} />
                  <span>Ver na Folha Oficial (A4)</span>
                </button>
                <button
                  type="button"
                  onClick={saveReceipt}
                  disabled={isSaving}
                  className="flex-1 py-3.5 px-4 rounded-2xl bg-primary-200 hover:bg-primary-200/90 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer active:scale-98 disabled:opacity-50"
                >
                  {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  <span>{editingId ? 'Atualizar Recibo' : 'Salvar no Histórico'}</span>
                </button>
              </div>
            </motion.div>
          )}

          {view === 'folha' && (
            <div 
              ref={paperContainerRef}
              className="w-full bg-surface-100 rounded-3xl border border-surface-300 shadow-xs p-3 sm:p-6 overflow-x-auto custom-scrollbar-wide flex flex-col items-center"
            >
              {/* Barra de controle da Folha (Zoom / Ajuste à Tela) */}
              <div className="w-full max-w-[800px] flex items-center justify-between pb-3 mb-4 border-b border-surface-300 text-xs no-print flex-wrap gap-2">
                <div className="flex items-center gap-2 text-typography-600 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-typography-700">Folha de Recibo Oficial</span>
                  <span className="text-[10px] bg-surface-200 text-typography-500 px-2 py-0.5 rounded-full font-mono font-bold">800px</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsFitToScreen(!isFitToScreen)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border cursor-pointer active:scale-95 ${
                      isFitToScreen
                        ? 'bg-primary-200/10 text-primary-200 border-primary-200/30 shadow-2xs'
                        : 'bg-surface-200/80 text-typography-700 border-surface-300 hover:text-typography-900'
                    }`}
                    title={isFitToScreen ? "Folha ajustada à largura da tela. Clique para ver em tamanho real (100%)" : "Folha em 100%. Clique para ajustar à largura da tela"}
                  >
                    {isFitToScreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                    <span>{isFitToScreen ? 'Ajustado à Tela' : 'Tamanho Real (100%)'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setView('form')}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border border-surface-300 bg-surface-200/80 text-typography-700 hover:text-typography-900 cursor-pointer active:scale-95"
                    title="Mudar para formulário rápido"
                  >
                    <LayoutList size={13} />
                    <span className="hidden sm:inline">Modo Formulário</span>
                  </button>
                </div>
              </div>

              {/* Container com escala proporcional para celulares */}
              <div 
                className="w-full flex justify-center transition-all duration-200"
                style={{
                  height: scaleRatio < 1 && receiptRef.current ? `${receiptRef.current.offsetHeight * scaleRatio + 20}px` : 'auto',
                  overflow: scaleRatio < 1 ? 'hidden' : 'visible'
                }}
              >
                <div
                  style={{
                    transform: scaleRatio < 1 ? `scale(${scaleRatio})` : 'none',
                    transformOrigin: 'top center',
                    width: '800px',
                    flexShrink: 0,
                  }}
                >
                  {renderOfficialReceipt()}
                </div>
              </div>
            </div>
          )}

          {view === 'history' && (
            <motion.div 
              key="history"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              /* Centraliza o histórico na tela */
              className="bg-surface-100 w-full max-w-[800px] mx-auto rounded-3xl border border-surface-300 shadow-xs p-6 md:p-8 flex flex-col"
            >
              {/* Histórico de Recibos */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-typography-900 tracking-tight">Histórico de Recibos</h2>
                  <p className="text-xs text-typography-500">Recibos salvos de semanas anteriores</p>
                </div>
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-typography-400" />
                  <input 
                    type="text"
                    placeholder="Buscar data ou item..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 pr-4 py-2 border border-surface-300 bg-surface-200/50 rounded-2xl text-xs sm:text-sm outline-none focus:border-primary-200/60 focus:ring-2 focus:ring-primary-200/20 transition-all text-typography-800 placeholder:text-typography-400"
                  />
                </div>
              </div>

              {loading ? (
                <div className="flex-grow flex items-center justify-center py-20">
                  <Loader2 size={36} className="animate-spin text-primary-200" />
                </div>
              ) : filteredHistory.length === 0 ? (
                <div className="flex-grow flex flex-col items-center justify-center py-20 text-typography-400">
                  <History size={48} className="mb-4 opacity-30" />
                  <p className="text-sm font-medium">Nenhum recibo encontrado.</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                  {filteredHistory.map((rec) => (
                    <div 
                      key={rec.id}
                      className="p-4 border border-surface-300 rounded-2xl hover:bg-surface-200/60 bg-surface-100 transition-colors group relative shadow-2xs"
                    >
                      <div className="flex justify-between items-start gap-4">
                        <div className="cursor-pointer flex-grow" onClick={() => loadReceiptToForm(rec)}>
                          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <span className="font-bold text-typography-900 text-sm">{rec.date}</span>
                            {rec.congregation && (
                              <span className="text-[10px] bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full uppercase text-emerald-600 dark:text-emerald-400 font-black">
                                {rec.congregation}
                              </span>
                            )}
                            <span className="text-[10px] bg-surface-200 border border-surface-300 px-2 py-0.5 rounded-full uppercase text-typography-500 font-black">
                              {rec.types.donativo ? 'Donativo' : rec.types.pagamento ? 'Pagamento' : 'Recibo'}
                            </span>
                          </div>
                          <p className="text-xs text-typography-500 line-clamp-1">
                            {rec.items.filter(i => i.label && i.value).map(i => i.label).join(', ')}
                          </p>
                          <div className="mt-2 font-black text-emerald-600 dark:text-emerald-400 text-base">R$ {rec.total}</div>
                        </div>
                        <button 
                          onClick={() => deleteReceipt(rec.id)}
                          className="p-2 text-typography-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-xl transition-colors shrink-0"
                          title="Excluir recibo"
                        >
                          <Trash2 size={16} />
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
          .offscreen-receipt {
            position: static !important;
            left: auto !important;
            display: block !important;
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
