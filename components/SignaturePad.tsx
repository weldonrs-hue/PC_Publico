'use client';

import React, { useState, useRef, useEffect } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { Type, PenTool, Image as ImageIcon, Trash2, Check, X, RefreshCcw, Sparkles, Loader2, Upload } from 'lucide-react';
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
      ctx.filter = 'contrast(2.5) brightness(1.1) saturate(0)';
      ctx.drawImage(img, 0, 0);
      ctx.filter = 'none';

      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;
      const source = new Uint8ClampedArray(data);

      // Professional Vibrant Ballpoint Blue (#003BB1) - Slightly deeper for better visibility
      const targetR = 0;
      const targetG = 40;
      const targetB = 160;

      // Scan and reconstruct movements with sharper edges
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = (y * width + x) * 4;
          
          const r = source[idx];
          const g = source[idx + 1];
          const b = source[idx + 2];
          // Simple luma for grayscale since we saturated to 0
          const luma = r; 
          
          // Background removal (strict)
          if (luma > 245) {
            data[idx + 3] = 0;
            continue;
          }

          let intensity = 255 - luma;
          
          // Reconstruct lines:
          // We want to avoid "blurry" edges by being more binary but with subtle anti-aliasing
          // We detect if there's enough "ink" in the neighborhood to be a real line
          let localMinLuma = 255;
          let darkCount = 0;
          
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              const nx = x + dx;
              const ny = y + dy;
              if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                const nIdx = (ny * width + nx) * 4;
                const nLuma = source[nIdx];
                if (nLuma < localMinLuma) localMinLuma = nLuma;
                if (nLuma < 220) darkCount++;
              }
            }
          }

          // Cull noise: lonely dark pixels are likely scanner noise
          if (darkCount < 2 && luma > 180) {
            data[idx + 3] = 0;
            continue;
          }

          // Line reconstruction mapping
          let alpha;
          // If it's a core line pixel (very dark) or part of a strong path
          if (luma < 160 || (darkCount >= 5 && luma < 200)) {
            alpha = 255; 
          } else if (luma > 230) {
             alpha = 0;
          } else {
            // Sharper falloff for less blur
            // Threshold is around 220
            const ratio = (220 - luma) / (220 - 160);
            alpha = Math.max(0, Math.min(255, ratio * 280)); 
          }

          // Apply color
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
                  className="w-full text-center text-4xl p-4 bg-transparent border-b-2 border-gray-100 focus:border-blue-500 outline-none transition-colors"
                  style={{ fontFamily: selectedFont.variable, color: '#0f35a9' }}
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
                    penColor="#0f35a9"
                    canvasProps={{
                      className: "w-full h-[250px] cursor-crosshair"
                    }}
                  />
                </div>
                <div className="absolute top-4 right-4 flex gap-2">
                  <button 
                    onClick={handleRefineIA}
                    disabled={isProcessing}
                    className="p-2 bg-blue-100 text-blue-600 rounded-full hover:bg-blue-200 transition-all shadow-sm disabled:opacity-50"
                    title="Refinar com IA"
                  >
                    {isProcessing ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
                  </button>
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
                    <div className="relative p-6 bg-white border border-gray-200 rounded-2xl shadow-inner min-h-[200px] flex items-center justify-center overflow-hidden">
                      <img 
                        src={loadedImage} 
                        alt="Preview" 
                        className="max-h-[180px] object-contain"
                      />
                      
                      <div className="absolute top-4 right-4 flex gap-2">
                        <button 
                          onClick={handleRefineIA}
                          disabled={isProcessing}
                          className="p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-all shadow-lg flex items-center gap-2 pr-4 pl-3"
                        >
                          {isProcessing ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
                          <span className="text-xs font-bold">REFINAR COM IA</span>
                        </button>
                        <button 
                          onClick={() => setLoadedImage(null)}
                          className="p-2 bg-white border border-gray-200 text-red-500 rounded-full hover:bg-red-50 shadow-md"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                    <div className="flex justify-center flex-col items-center gap-2">
                      <p className="text-xs text-gray-400 font-bold uppercase tracking-tight">Dica: Use o botão Refinar para suavizar os traços e aplicar cor azul realista</p>
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="text-emerald-600 font-bold text-xs hover:underline flex items-center gap-1"
                      >
                        <RefreshCcw size={12} />
                        Trocar Imagem
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-2xl w-full bg-gray-50/50">
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="flex flex-col items-center gap-4 mx-auto group"
                    >
                      <div className="w-16 h-16 bg-white rounded-full shadow-md flex items-center justify-center transition-all group-hover:scale-110 group-hover:shadow-lg">
                        <Upload className="text-emerald-600" size={24} />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-gray-700">Carregar Imagem de Assinatura</p>
                        <p className="text-xs text-gray-400 font-medium">PNG, JPG ou WEBP (melhor com fundo claro)</p>
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
              disabled={
                mode === 'type' ? !typedName.trim() : 
                mode === 'draw' ? (sigCanvas.current?.isEmpty() ?? true) :
                mode === 'image' ? !loadedImage : false
              }
              className="px-8 py-2.5 bg-emerald-600 text-white text-sm font-bold rounded-full shadow-lg shadow-emerald-200 hover:bg-emerald-700 disabled:opacity-50 disabled:shadow-none transition-all flex items-center gap-2"
            >
              Confirmar Assinatura
              <Check size={18} />
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
