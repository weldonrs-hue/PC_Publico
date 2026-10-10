'use client';

import { Check, Image as ImageIcon, Loader2, PenTool, RefreshCcw, Sparkles, Trash2, Type, Upload } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import React, { useRef, useState } from 'react';
import SignatureCanvas from 'react-signature-canvas';

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
  const [loadedImage, setLoadedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const sigCanvas = useRef<SignatureCanvas | null>(null);
  const typeRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClear = () => {
    if (mode === 'draw' && sigCanvas.current) {
      sigCanvas.current.clear();
    } else if (mode === 'type') {
      setTypedName('');
    } else if (mode === 'image') {
      setLoadedImage(null);
    }
  };

  const handleRefineIA = () => {
    const currentModeImage = mode === 'draw' ? sigCanvas.current?.toDataURL('image/png') : loadedImage;
    if (!currentModeImage) return;

    setIsProcessing(true);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = currentModeImage;

    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        setIsProcessing(false);
        return;
      }

      const { width, height } = img;
      canvas.width = width;
      canvas.height = height;
      
      // Step 1: Draw high-contrast base
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, width, height);
      // Pre-sharpen the input aggressively
      ctx.filter = 'contrast(3) brightness(1.1) saturate(0)';
      ctx.drawImage(img, 0, 0);
      ctx.filter = 'none';

      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;
      const source = new Uint8ClampedArray(data);

      // Deep Blue Pen Ink (#002366 feel - very professional)
      const targetR = 0;
      const targetG = 35;
      const targetB = 102;

      // Scan and reconstruct movements with sharper edges
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = (y * width + x) * 4;
          const luma = source[idx]; // Source is already saturated to 0
          
          // Strict Background removal
          if (luma > 240) {
            data[idx + 3] = 0;
            continue;
          }

          // Line reconstruction:
          // We look for the "core" of the line (darkest pixels)
          // and treat everything else as potential anti-aliasing edges or noise
          let darkCount = 0;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              const nx = x + dx;
              const ny = y + dy;
              if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                const nIdx = (ny * width + nx) * 4;
                if (source[nIdx] < 220) darkCount++;
              }
            }
          }

          // Culling noise - single isolated dark pixels are gone
          if (darkCount < 2 && luma > 150) {
            data[idx + 3] = 0;
            continue;
          }

          // Mapping logic: 
          // 0-140 luma -> solid color (alpha 255)
          // 140-230 luma -> tapered edge (alpha 255-0)
          let alpha;
          if (luma < 140) {
            alpha = 255;
          } else if (luma > 225) {
            alpha = 0;
          } else {
            // Sharper falloff curve
            const ratio = (225 - luma) / (225 - 140);
            alpha = Math.floor(Math.pow(ratio, 1.2) * 255);
          }

          data[idx] = targetR;
          data[idx + 1] = targetG;
          data[idx + 2] = targetB;
          data[idx + 3] = alpha;
        }
      }

      ctx.putImageData(imageData, 0, 0);
      
      const result = canvas.toDataURL('image/png');
      
      if (mode === 'draw' && sigCanvas.current) {
        sigCanvas.current.fromDataURL(result);
      } else {
        setLoadedImage(result);
      }
      setIsProcessing(false);
    };
    img.onerror = () => setIsProcessing(false);
  };

  const handleSave = async () => {
    setIsProcessing(true);

    const finishSave = (dataUrl: string) => {
      // Final Auto-Crop for the finished dataUrl regardless of mode
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = dataUrl;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          onSave(dataUrl);
          setIsProcessing(false);
          return;
        }

        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        let minX = canvas.width, minY = canvas.height, maxX = 0, maxY = 0;
        let found = false;

        for (let y = 0; y < canvas.height; y++) {
          for (let x = 0; x < canvas.width; x++) {
            const alpha = data[(y * canvas.width + x) * 4 + 3];
            // Only count if it's significantly visible ink
            if (alpha > 10) {
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
              found = true;
            }
          }
        }

        if (!found) {
          onSave(dataUrl);
          setIsProcessing(false);
          return;
        }

        // Add balanced padding
        const padding = 15;
        const cropX = Math.max(0, minX - padding);
        const cropY = Math.max(0, minY - padding);
        const cropW = Math.min(canvas.width - cropX, (maxX - minX) + padding * 2);
        const cropH = Math.min(canvas.height - cropY, (maxY - minY) + padding * 2);

        const croppedCanvas = document.createElement('canvas');
        croppedCanvas.width = cropW;
        croppedCanvas.height = cropH;
        const cCtx = croppedCanvas.getContext('2d');
        if (cCtx) {
          cCtx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
          onSave(croppedCanvas.toDataURL('image/png'));
        } else {
          onSave(dataUrl);
        }
        setIsProcessing(false);
      };
      img.onerror = () => {
        onSave(dataUrl);
        setIsProcessing(false);
      };
    };

    if (mode === 'draw' && sigCanvas.current) {
      if (sigCanvas.current.isEmpty()) {
        setIsProcessing(false);
        return;
      }
      finishSave(sigCanvas.current.toDataURL('image/png'));
    } else if (mode === 'type' && typedName.trim()) {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.font = `60px ${selectedFont.name}`;
        const metrics = ctx.measureText(typedName);
        const width = metrics.width + 80;
        const height = 150;
        canvas.width = width;
        canvas.height = height;
        ctx.font = `60px ${selectedFont.name}`;
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#0f35a9';
        ctx.fillText(typedName, 40, height / 2);
        finishSave(canvas.toDataURL('image/png'));
      } else {
        setIsProcessing(false);
      }
    } else if (mode === 'image' && loadedImage) {
      // If it's an image, we enforce background removal automatically if it looks like it has one
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = loadedImage;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          finishSave(loadedImage);
          return;
        }
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        // Quick background check and refinement
        for (let i = 0; i < data.length; i += 4) {
          const brightness = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
          if (brightness > 230) {
            data[i + 3] = 0;
          } else if (data[i + 3] > 10) {
            // Apply signature blue theme if color is neutral
            const isNeutral = Math.max(data[i], data[i+1], data[i+2]) - Math.min(data[i], data[i+1], data[i+2]) < 30;
            if (isNeutral) {
              data[i] = 15;
              data[i+1] = 53;
              data[i+2] = 169;
            }
          }
        }
        ctx.putImageData(imageData, 0, 0);
        finishSave(canvas.toDataURL('image/png'));
      };
      img.onerror = () => finishSave(loadedImage);
    } else {
      setIsProcessing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setLoadedImage(event.target.result as string);
          setMode('image');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-surface-100 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col border border-surface-300 relative text-typography-900"
      >
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary-200 via-primary-150 to-transparent z-10" />
        {/* Header/Tabs */}
        <div className="flex border-b border-surface-300 bg-surface-200/40">
          <button 
            type="button"
            onClick={() => setMode('type')}
            className={`flex-1 py-3.5 sm:py-4 flex items-center justify-center gap-2 text-xs sm:text-sm font-bold transition-all whitespace-nowrap shrink-0 cursor-pointer ${
              mode === 'type' ? 'text-primary-200 bg-primary-200/10 border-b-2 border-primary-200' : 'text-typography-500 hover:text-typography-800 hover:bg-surface-200/50'
            }`}
          >
            <Type size={18} />
            DIGITAR
          </button>
          <button 
            type="button"
            onClick={() => setMode('draw')}
            className={`flex-1 py-3.5 sm:py-4 flex items-center justify-center gap-2 text-xs sm:text-sm font-bold transition-all whitespace-nowrap shrink-0 cursor-pointer ${
              mode === 'draw' ? 'text-primary-200 bg-primary-200/10 border-b-2 border-primary-200' : 'text-typography-500 hover:text-typography-800 hover:bg-surface-200/50'
            }`}
          >
            <PenTool size={18} />
            DESENHAR
          </button>
          <button 
            type="button"
            onClick={() => {
              setMode('image');
              fileInputRef.current?.click();
            }}
            className={`flex-1 py-3.5 sm:py-4 flex items-center justify-center gap-2 text-xs sm:text-sm font-bold transition-all whitespace-nowrap shrink-0 cursor-pointer ${
              mode === 'image' ? 'text-primary-200 bg-primary-200/10 border-b-2 border-primary-200' : 'text-typography-500 hover:text-typography-800 hover:bg-surface-200/50'
            }`}
          >
            <ImageIcon size={18} />
            IMAGEM
          </button>
        </div>

        {/* Content Area */}
        <div className="p-6 sm:p-8 min-h-[300px] flex flex-col justify-center">
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
                  className="w-full text-center text-3xl sm:text-4xl p-4 bg-transparent border-b-2 border-surface-300 focus:border-primary-200 outline-none transition-colors text-blue-900"
                  style={{ fontFamily: selectedFont.variable, color: '#0f35a9' }}
                />
                
                <div className="flex flex-wrap justify-center gap-2.5">
                  {HANDWRITING_FONTS.map((font) => (
                    <button
                      type="button"
                      key={font.name}
                      onClick={() => setSelectedFont(font)}
                      className={`px-4 py-2 rounded-xl text-sm font-medium transition-all border whitespace-nowrap shrink-0 cursor-pointer ${
                        selectedFont.name === font.name 
                          ? 'bg-primary-200 text-white border-primary-200 shadow-sm' 
                          : 'bg-surface-200 text-typography-700 border-surface-300 hover:border-primary-200/50'
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
                <div className="border-2 border-dashed border-surface-300 rounded-2xl bg-white overflow-hidden shadow-inner">
                  <SignatureCanvas 
                    ref={sigCanvas}
                    penColor="#0f35a9"
                    canvasProps={{
                      className: "w-full h-[250px] cursor-crosshair"
                    }}
                  />
                </div>
                <div className="absolute top-4 right-4 flex gap-2">
                  <button 
                    type="button"
                    onClick={handleRefineIA}
                    disabled={isProcessing}
                    className="p-2 bg-blue-100 text-blue-700 rounded-xl hover:bg-blue-200 transition-all shadow-xs disabled:opacity-50 cursor-pointer"
                    title="Refinar com IA"
                  >
                    {isProcessing ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
                  </button>
                  <button 
                    type="button"
                    onClick={handleClear}
                    className="p-2 bg-surface-100 shadow-xs border border-surface-300 rounded-xl text-typography-500 hover:text-red-500 transition-colors cursor-pointer"
                    title="Limpar"
                  >
                    <RefreshCcw size={18} />
                  </button>
                </div>
                <div className="mt-4 text-center">
                  <p className="text-xs text-typography-400 font-medium uppercase tracking-widest">
                    Use seu mouse ou touch-pad para assinar
                  </p>
                </div>
              </motion.div>
            )}

            {mode === 'image' && (
              <motion.div 
                key="image"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="relative flex flex-col items-center"
              >
                {loadedImage ? (
                  <div className="space-y-6 w-full max-w-md mx-auto">
                    <div className="relative p-6 bg-white border border-surface-300 rounded-2xl shadow-inner min-h-[200px] flex items-center justify-center overflow-hidden">
                      <img 
                        src={loadedImage} 
                        alt="Preview" 
                        className="max-h-[180px] object-contain"
                      />
                      
                      <div className="absolute top-4 right-4 flex gap-2">
                        <button 
                          type="button"
                          onClick={handleRefineIA}
                          disabled={isProcessing}
                          className="p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all shadow-sm flex items-center gap-1.5 pr-3 pl-2.5 cursor-pointer whitespace-nowrap shrink-0"
                        >
                          {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                          <span className="text-xs font-bold">REFINAR COM IA</span>
                        </button>
                        <button 
                          type="button"
                          onClick={() => setLoadedImage(null)}
                          className="p-2 bg-white border border-surface-300 text-red-500 rounded-xl hover:bg-red-50 shadow-xs cursor-pointer"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                    <div className="flex justify-center flex-col items-center gap-2">
                      <p className="text-xs text-typography-400 font-semibold uppercase tracking-tight text-center">
                        Dica: Use o botão Refinar para suavizar os traços e aplicar cor azul realista
                      </p>
                      <button 
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="text-primary-200 font-bold text-xs hover:underline flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
                      >
                        <RefreshCcw size={12} />
                        Trocar Imagem
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-10 border-2 border-dashed border-surface-300 rounded-2xl w-full bg-surface-200/40">
                    <button 
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex flex-col items-center gap-3.5 mx-auto group cursor-pointer"
                    >
                      <div className="w-14 h-14 bg-surface-100 border border-surface-300 rounded-2xl shadow-xs flex items-center justify-center transition-all group-hover:scale-105 group-hover:border-primary-200/50 text-primary-200">
                        <Upload size={22} />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-typography-800">Carregar Imagem de Assinatura</p>
                        <p className="text-xs text-typography-400 font-medium">PNG, JPG ou WEBP (melhor com fundo claro)</p>
                      </div>
                    </button>
                  </div>
                )}
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
        <div className="p-4 sm:p-5 bg-surface-200/60 border-t border-surface-300 flex items-center justify-between">
          <button 
            type="button"
            onClick={onCancel}
            className="px-4 sm:px-5 py-2 text-xs sm:text-sm font-semibold text-typography-500 hover:text-typography-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            CANCELAR
          </button>
          
          <div className="flex gap-3">
            <button 
              type="button"
              onClick={handleSave}
              disabled={
                mode === 'type' ? !typedName.trim() : 
                mode === 'draw' ? (sigCanvas.current?.isEmpty() ?? true) :
                mode === 'image' ? !loadedImage : false
              }
              className="px-6 sm:px-7 py-2.5 bg-primary-200 hover:bg-primary-150 active:scale-95 text-white text-xs sm:text-sm font-bold rounded-xl shadow-xs disabled:opacity-50 transition-all flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>Confirmar Assinatura</span>
              <Check size={16} />
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
