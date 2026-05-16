'use client';

import React, { useState, useRef, useEffect } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { Type, PenTool, Image as ImageIcon, Trash2, Check, X, RefreshCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SignaturePadProps {
  onSave: (signatureDataUrl: string) => void;
  onCancel: () => void;
  initialName?: string;
}

type SignatureMode = 'type' | 'draw' | 'image';

const HANDWRITING_FONTS = [
  { name: 'Dancing Script', variable: 'var(--font-signature)' },
  { name: 'Pacifico', variable: 'var(--font-signature-pacifico)' },
  { name: 'Satisfy', variable: 'var(--font-signature-satisfy)' },
  { name: 'Caveat', variable: 'var(--font-signature-caveat)' },
  { name: 'Marck Script', variable: 'var(--font-signature-marck)' },
];

export default function SignaturePad({ onSave, onCancel, initialName = '' }: SignaturePadProps) {
  const [mode, setMode] = useState<SignatureMode>('type');
  const [typedName, setTypedName] = useState(initialName);
  const [selectedFont, setSelectedFont] = useState(HANDWRITING_FONTS[0]);
  
  const sigCanvas = useRef<SignatureCanvas | null>(null);
  const typeRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClear = () => {
    if (mode === 'draw' && sigCanvas.current) {
      sigCanvas.current.clear();
    } else if (mode === 'type') {
      setTypedName('');
    }
  };

  const handleSave = async () => {
    if (mode === 'draw' && sigCanvas.current) {
      if (sigCanvas.current.isEmpty()) return;
      
      const trimmedCanvas = sigCanvas.current.getTrimmedCanvas();
      
      // Add padding to prevent cutting edges
      const padding = 20;
      const paddedCanvas = document.createElement('canvas');
      paddedCanvas.width = trimmedCanvas.width + (padding * 2);
      paddedCanvas.height = trimmedCanvas.height + (padding * 2);
      
      const pCtx = paddedCanvas.getContext('2d');
      if (pCtx) {
        pCtx.drawImage(trimmedCanvas, padding, padding);
        onSave(paddedCanvas.toDataURL('image/png'));
      } else {
        onSave(trimmedCanvas.toDataURL('image/png'));
      }
    } else if (mode === 'type' && typedName.trim()) {
      // Create a canvas to render the text as an image
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Measure text
        ctx.font = `60px ${selectedFont.name}`;
        const metrics = ctx.measureText(typedName);
        const width = metrics.width + 40;
        const height = 100;
        
        canvas.width = width;
        canvas.height = height;
        
        // Re-apply font after resize
        ctx.font = `60px ${selectedFont.name}`;
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'black';
        ctx.fillText(typedName, 20, height / 2);
        
        onSave(canvas.toDataURL('image/png'));
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          onSave(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col"
      >
        {/* Header/Tabs */}
        <div className="flex border-b border-gray-100">
          <button 
            onClick={() => setMode('type')}
            className={`flex-1 py-4 flex items-center justify-center gap-2 text-sm font-bold transition-all ${
              mode === 'type' ? 'text-emerald-600 bg-emerald-50/50' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <Type size={18} />
            DIGITAR
          </button>
          <button 
            onClick={() => setMode('draw')}
            className={`flex-1 py-4 flex items-center justify-center gap-2 text-sm font-bold transition-all ${
              mode === 'draw' ? 'text-emerald-600 bg-emerald-50/50' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <PenTool size={18} />
            DESENHAR
          </button>
          <button 
            onClick={() => {
              setMode('image');
              fileInputRef.current?.click();
            }}
            className={`flex-1 py-4 flex items-center justify-center gap-2 text-sm font-bold transition-all ${
              mode === 'image' ? 'text-emerald-600 bg-emerald-50/50' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <ImageIcon size={18} />
            IMAGEM
          </button>
        </div>

        {/* Content Area */}
        <div className="p-8 min-h-[300px] flex flex-col justify-center">
          <AnimatePresence mode="wait">
            {mode === 'type' && (
              <motion.div 
                key="type"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="space-y-6"
              >
                <input 
                  type="text"
                  value={typedName}
                  onChange={(e) => setTypedName(e.target.value)}
                  placeholder="Seu nome aqui..."
                  className="w-full text-center text-4xl p-4 bg-transparent border-b-2 border-gray-100 focus:border-emerald-500 outline-none transition-colors"
                  style={{ fontFamily: selectedFont.variable }}
                />
                
                <div className="flex flex-wrap justify-center gap-3">
                  {HANDWRITING_FONTS.map((font) => (
                    <button
                      key={font.name}
                      onClick={() => setSelectedFont(font)}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-all border ${
                        selectedFont.name === font.name 
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-lg shadow-emerald-200' 
                          : 'bg-white text-gray-600 border-gray-200 hover:border-emerald-300'
                      }`}
                      style={{ fontFamily: font.variable }}
                    >
                      {typedName || font.name}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {mode === 'draw' && (
              <motion.div 
                key="draw"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="relative group"
              >
                <div className="border-2 border-dashed border-gray-200 rounded-2xl bg-gray-50/50 overflow-hidden">
                  <SignatureCanvas 
                    ref={sigCanvas}
                    penColor="black"
                    canvasProps={{
                      className: "w-full h-[250px] cursor-crosshair"
                    }}
                  />
                </div>
                <div className="absolute top-4 right-4 flex gap-2">
                  <button 
                    onClick={handleClear}
                    className="p-2 bg-white shadow-md border border-gray-100 rounded-full text-gray-400 hover:text-red-500 transition-colors"
                    title="Limpar"
                  >
                    <RefreshCcw size={18} />
                  </button>
                </div>
                <div className="mt-4 text-center">
                  <p className="text-xs text-gray-400 font-medium uppercase tracking-widest">Use seu mouse ou touch-pad para assinar</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange}
            accept="image/*"
            className="hidden"
          />
        </div>

        {/* Footer */}
        <div className="p-6 bg-gray-50 flex items-center justify-between">
          <button 
            onClick={onCancel}
            className="px-6 py-2.5 text-sm font-bold text-gray-500 hover:text-gray-700 transition-colors"
          >
            CANCELAR
          </button>
          
          <div className="flex gap-3">
            <button 
              onClick={handleSave}
              disabled={mode === 'type' ? !typedName.trim() : false}
              className="px-8 py-2.5 bg-emerald-600 text-white text-sm font-bold rounded-full shadow-lg shadow-emerald-200 hover:bg-emerald-700 disabled:opacity-50 disabled:shadow-none transition-all flex items-center gap-2"
            >
              Criar Assinatura
              <Check size={18} />
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
