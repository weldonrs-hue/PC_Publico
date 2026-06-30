'use client';

import { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Printer, History, Home, PlusSquare, Settings } from 'lucide-react';

interface WeeklyExpensesReceiptProps {
  onBack: () => void;
}

export default function WeeklyExpensesReceipt({ onBack }: WeeklyExpensesReceiptProps) {
  const [items, setItems] = useState([
    { label: 'Mercado da Semana', value: '' },
    { label: 'Feira Livre', value: '' },
    { label: 'Carnes e Peixes', value: '' },
    { label: '', value: '' },
    { label: '', value: '' },
  ]);

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

  const handlePrint = () => {
    window.print();
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
        <h1 className="font-serif text-lg font-bold uppercase tracking-widest text-black">RECIBO</h1>
        <button 
          onClick={handlePrint}
          className="transition-colors duration-200 active:opacity-70 text-black flex items-center hover:bg-gray-100 p-1 rounded"
        >
          <Printer size={24} />
        </button>
      </header>

      {/* Main Content Area */}
      <main className="flex-grow flex justify-center py-6 px-4 md:px-8 pb-32">
        {/* Receipt Canvas */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white w-full max-w-[800px] shadow-lg md:shadow-xl p-8 md:p-12 relative border border-[#cfc4c5] print:shadow-none print:border-none print:p-0"
        >
          {/* Header Row */}
          <div className="text-center mb-10">
            <h2 className="font-serif text-2xl md:text-3xl font-bold tracking-[0.3em] uppercase underline underline-offset-8">RECIBO</h2>
          </div>

          {/* Selection Section & Date */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12 items-end">
            <div>
              <h3 className="font-bold text-sm mb-4 uppercase tracking-wider text-gray-600">Escolha o tipo:</h3>
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
            <div className="flex items-baseline md:justify-end">
              <span className="font-bold text-sm mr-2 uppercase tracking-wider text-gray-600">Data:</span>
              <input 
                type="text" 
                value={date}
                onChange={(e) => setDate(e.target.value)}
                placeholder="___/___/___"
                className="w-40 border-b-2 border-gray-200 focus:border-black bg-transparent outline-none text-center font-medium py-1 transition-colors"
              />
            </div>
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
          <div className="grid grid-cols-2 gap-12 md:gap-16 mt-16 md:mt-24">
            <div className="text-center">
              <div className="border-t border-[#7e7576] w-full mb-1"></div>
              <span className="text-[10px] md:text-xs uppercase text-gray-500">(Preenchido por)</span>
            </div>
            <div className="text-center">
              <div className="border-t border-[#7e7576] w-full mb-1"></div>
              <span className="text-[10px] md:text-xs uppercase text-gray-500">(Conferido por)</span>
            </div>
          </div>

          {/* Metadata */}
          <div className="absolute bottom-4 left-8 text-[10px] text-gray-400">
            S-24-T &nbsp; 05/21
          </div>
        </motion.div>
      </main>

      {/* Bottom Nav - No Print */}
      <nav className="fixed bottom-0 w-full z-50 bg-white border-t border-[#7e7576] flex justify-around items-center h-16 pb-safe no-print">
        <button onClick={onBack} className="flex flex-col items-center justify-center text-gray-500 hover:text-black transition-colors">
          <Home size={20} />
          <span className="text-[10px] mt-1 uppercase font-bold">Início</span>
        </button>
        <button className="flex flex-col items-center justify-center text-gray-500 hover:text-black transition-colors">
          <History size={20} />
          <span className="text-[10px] mt-1 uppercase font-bold">Histórico</span>
        </button>
        <button className="flex flex-col items-center justify-center text-black font-bold">
          <PlusSquare size={24} className="text-black" />
          <span className="text-[10px] mt-1 uppercase font-bold">Novo</span>
        </button>
        <button className="flex flex-col items-center justify-center text-gray-500 hover:text-black transition-colors">
          <Settings size={20} />
          <span className="text-[10px] mt-1 uppercase font-bold">Config</span>
        </button>
      </nav>

      <style jsx global>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; padding: 0 !important; margin: 0 !important; }
          .min-h-screen { min-height: auto !important; }
          main { padding: 0 !important; }
        }
      `}</style>
    </div>
  );
}
