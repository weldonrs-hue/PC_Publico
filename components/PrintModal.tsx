'use client';

import React, { useState } from 'react';
import { X, Printer, Settings2, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface PrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPrint: (options: PrintOptions) => void;
  totalPages: number;
}

export interface PrintOptions {
  rangeType: 'all' | 'current' | 'custom' | 'range';
  customPages?: string;
  fromPage?: number;
  toPage?: number;
  quality: number;
}

export default function PrintModal({ isOpen, onClose, onPrint, totalPages }: PrintModalProps) {
  const [rangeType, setRangeType] = useState<'all' | 'current' | 'custom' | 'range'>('all');
  const [customPages, setCustomPages] = useState('');
  const [fromPage, setFromPage] = useState(1);
  const [toPage, setToPage] = useState(totalPages || 1);
  const [quality, setQuality] = useState(150);

  if (!isOpen) return null;

  const handlePrint = () => {
    onPrint({
      rangeType,
      customPages,
      fromPage,
      toPage,
      quality
    });
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-100"
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
            <h3 className="font-black text-[13px] uppercase tracking-widest text-gray-800 flex items-center gap-2">
              <Printer size={16} className="text-blue-600" />
              Imprimir Documento
            </h3>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-600"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 space-y-6">
            {/* Pages Section */}
            <div className="space-y-4">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600 flex items-center gap-2">
                <FileText size={12} />
                Páginas
              </label>
              
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative flex items-center justify-center">
                    <input 
                      type="radio" 
                      name="rangeType" 
                      checked={rangeType === 'all'} 
                      onChange={() => setRangeType('all')}
                      className="sr-only"
                    />
                    <div className={`w-5 h-5 rounded-full border-2 transition-all ${rangeType === 'all' ? 'border-blue-600 bg-blue-600' : 'border-gray-200 group-hover:border-blue-300'}`} />
                    {rangeType === 'all' && <div className="absolute w-2 h-2 bg-white rounded-full" />}
                  </div>
                  <span className="text-sm font-bold text-gray-700">Todas</span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative flex items-center justify-center">
                    <input 
                      type="radio" 
                      name="rangeType" 
                      checked={rangeType === 'current'} 
                      onChange={() => setRangeType('current')}
                      className="sr-only"
                    />
                    <div className={`w-5 h-5 rounded-full border-2 transition-all ${rangeType === 'current' ? 'border-blue-600 bg-blue-600' : 'border-gray-200 group-hover:border-blue-300'}`} />
                    {rangeType === 'current' && <div className="absolute w-2 h-2 bg-white rounded-full" />}
                  </div>
                  <span className="text-sm font-bold text-gray-700">Página atual</span>
                </label>

                <div className="flex flex-col gap-3">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div className="relative flex items-center justify-center">
                      <input 
                        type="radio" 
                        name="rangeType" 
                        checked={rangeType === 'range'} 
                        onChange={() => setRangeType('range')}
                        className="sr-only"
                      />
                      <div className={`w-5 h-5 rounded-full border-2 transition-all ${rangeType === 'range' ? 'border-blue-600 bg-blue-600' : 'border-gray-200 group-hover:border-blue-300'}`} />
                      {rangeType === 'range' && <div className="absolute w-2 h-2 bg-white rounded-full" />}
                    </div>
                    <span className="text-sm font-bold text-gray-700">Páginas</span>
                  </label>
                  
                  {rangeType === 'range' && (
                    <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="pl-8 flex items-center gap-2">
                      <input 
                        type="number" 
                        value={fromPage}
                        onChange={(e) => setFromPage(parseInt(e.target.value) || 1)}
                        className="w-16 h-8 border border-gray-200 rounded-lg px-2 text-xs font-bold focus:ring-2 focus:ring-blue-100 outline-none"
                      />
                      <span className="text-[10px] font-bold text-gray-400 uppercase">até</span>
                      <input 
                        type="number" 
                        value={toPage}
                        onChange={(e) => setToPage(parseInt(e.target.value) || 1)}
                        className="w-16 h-8 border border-gray-200 rounded-lg px-2 text-xs font-bold focus:ring-2 focus:ring-blue-100 outline-none"
                      />
                    </motion.div>
                  )}
                </div>

                <div className="flex flex-col gap-3">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div className="relative flex items-center justify-center">
                      <input 
                        type="radio" 
                        name="rangeType" 
                        checked={rangeType === 'custom'} 
                        onChange={() => setRangeType('custom')}
                        className="sr-only"
                      />
                      <div className={`w-5 h-5 rounded-full border-2 transition-all ${rangeType === 'custom' ? 'border-blue-600 bg-blue-600' : 'border-gray-200 group-hover:border-blue-300'}`} />
                      {rangeType === 'custom' && <div className="absolute w-2 h-2 bg-white rounded-full" />}
                    </div>
                    <span className="text-sm font-bold text-gray-700">Personalizado</span>
                  </label>
                  
                  {rangeType === 'custom' && (
                    <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="pl-8">
                      <input 
                        type="text" 
                        placeholder="Ex: 1, 3, 5-10"
                        value={customPages}
                        onChange={(e) => setCustomPages(e.target.value)}
                        className="w-full h-8 border border-gray-200 rounded-lg px-3 text-xs font-bold focus:ring-2 focus:ring-blue-100 outline-none"
                      />
                      <p className="text-[9px] text-gray-400 mt-1 font-medium">Separe por vírgulas ou use hífens para intervalos.</p>
                    </motion.div>
                  )}
                </div>
              </div>
            </div>

            {/* Quality Section */}
            <div className="space-y-4 pt-4 border-t border-gray-50">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600 flex items-center gap-2">
                <Settings2 size={12} />
                Qualidade
              </label>
              
              <select 
                value={quality}
                onChange={(e) => setQuality(parseInt(e.target.value))}
                className="w-full h-10 bg-gray-50 border border-gray-100 rounded-xl px-4 text-xs font-bold focus:ring-2 focus:ring-blue-100 outline-none appearance-none cursor-pointer"
              >
                <option value={96}>96 DPI (Rápido)</option>
                <option value={150}>150 DPI (Equilibrado)</option>
                <option value={300}>300 DPI (Alta Definição)</option>
              </select>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-3">
            <button 
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.15em] text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-all"
            >
              Cancelar
            </button>
            <button 
              onClick={handlePrint}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-[0.15em] shadow-lg shadow-blue-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              Imprimir
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
