'use client';

import React, { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { X, Check, ZoomIn, ZoomOut, Loader2, Sparkles, Camera, Crop } from 'lucide-react';

interface ImageCropperProps {
  image: string;
  onCropComplete: (croppedImage: string) => void;
  onCancel: () => void;
  aspect?: number;
  cropShape?: 'rect' | 'round';
  lockAspect?: boolean;
  isProfileMode?: boolean;
}

export default function ImageCropper({ 
  image, 
  onCropComplete, 
  onCancel, 
  aspect = 1, 
  cropShape = 'round',
  lockAspect = true,
  isProfileMode = false
}: ImageCropperProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [currentAspect, setCurrentAspect] = useState<number | undefined>(isProfileMode ? 1 : aspect);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const onCropChange = (crop: { x: number; y: number }) => {
    setCrop(crop);
  };

  const onZoomChange = (zoom: number) => {
    setZoom(zoom);
  };

  const onCropCompleteInternal = useCallback((_croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const createImage = (url: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.addEventListener('load', () => resolve(img));
      img.addEventListener('error', (error) => reject(error));
      img.setAttribute('crossOrigin', 'anonymous');
      img.src = url;
    });

  const getCroppedImg = async (imageSrc: string, pixelCrop: any): Promise<string> => {
    // 1. Obtain image source with proper EXIF orientation handling (crucial for mobile photos)
    let sourceImage: CanvasImageSource;
    let naturalW = 0;
    let naturalH = 0;

    try {
      const res = await fetch(imageSrc);
      const blob = await res.blob();
      const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
      sourceImage = bitmap;
      naturalW = bitmap.width;
      naturalH = bitmap.height;
    } catch {
      const img = await createImage(imageSrc);
      sourceImage = img;
      naturalW = img.naturalWidth || img.width;
      naturalH = img.naturalHeight || img.height;
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    // 2. Safe fallback if crop was not triggered yet
    const safeCrop = pixelCrop || {
      x: 0,
      y: 0,
      width: Math.min(naturalW, naturalH),
      height: Math.min(naturalW, naturalH),
    };

    // 3. Prevent displacement: clamp coordinates strictly inside the natural image boundary
    const sx = Math.max(0, Math.min(Math.round(safeCrop.x), naturalW - 1));
    const sy = Math.max(0, Math.min(Math.round(safeCrop.y), naturalH - 1));
    const sWidth = Math.max(1, Math.min(Math.round(safeCrop.width), naturalW - sx));
    const sHeight = Math.max(1, Math.min(Math.round(safeCrop.height), naturalH - sy));

    // 4. Output dimensions (in profile mode, 384x384 yields a sharp avatar on high-DPI screens without bloat)
    const targetSize = isProfileMode ? Math.min(Math.max(sWidth, sHeight), 384) : sWidth;
    const targetHeight = isProfileMode ? targetSize : sHeight;

    canvas.width = targetSize;
    canvas.height = targetHeight;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    ctx.drawImage(
      sourceImage,
      sx,
      sy,
      sWidth,
      sHeight,
      0,
      0,
      targetSize,
      targetHeight
    );

    // Use JPEG with 0.85 quality for profile photos to keep payload small while ensuring high clarity
    if (isProfileMode) {
      return canvas.toDataURL('image/jpeg', 0.85);
    }

    return canvas.toDataURL('image/png');
  };

  const removeBackground = (imageDataUrl: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = imageDataUrl;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(imageDataUrl);
          return;
        }
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        const threshold = 230; 
        for (let i = 0; i < data.length; i += 4) {
          if (data[i] > threshold && data[i + 1] > threshold && data[i + 2] > threshold) {
            data[i + 3] = 0;
          }
        }
        ctx.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => resolve(imageDataUrl);
    });
  };

  const handleSave = async (shouldRemoveBg = false) => {
    try {
      setIsProcessing(true);
      let croppedImage = await getCroppedImg(image, croppedAreaPixels);
      if (shouldRemoveBg) {
        croppedImage = await removeBackground(croppedImage);
      }
      onCropComplete(croppedImage);
    } catch (e) {
      console.error('Failed to crop image:', e);
    } finally {
      setIsProcessing(false);
    }
  };

  const aspectPresets = isProfileMode ? [
    { label: 'Quadrado', value: 1 },
  ] : [
    { label: 'Livre', value: undefined },
    { label: 'Quadrado', value: 1 },
    { label: '4:3', value: 4 / 3 },
    { label: '16:9', value: 16 / 9 },
    { label: 'Largo', value: 3 },
    { label: 'Assinatura', value: 6 },
    { label: 'Assinatura XL', value: 10 },
  ];

  return (
    <div className="fixed inset-0 z-[5000] bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-surface-100 border border-surface-300 rounded-3xl shadow-2xl overflow-hidden flex flex-col text-typography-900">
        {/* Top Accent Stripe */}
        <div className="h-1 w-full bg-gradient-to-r from-primary-200 via-primary-150 to-transparent" />

        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-surface-300/80">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-primary-200/10 border border-primary-200/20 text-primary-200 flex items-center justify-center shrink-0">
              {isProfileMode ? <Camera size={20} /> : <Crop size={20} />}
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-typography-900 leading-tight truncate">
                {isProfileMode ? 'Foto de Perfil' : 'Recortar Imagem'}
              </h2>
              <p className="text-xs text-typography-500 truncate mt-0.5">
                {isProfileMode ? 'Enquadre e dê zoom no seu rosto' : 'Ajuste a imagem para a área selecionada'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isProcessing}
            className="p-2 rounded-xl text-typography-500 hover:text-typography-900 hover:bg-surface-200 transition-colors cursor-pointer"
            title="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Cropper Viewport */}
        <div className="relative w-full h-[320px] sm:h-[380px] bg-black/95 overflow-hidden">
          <Cropper
            image={image}
            crop={crop}
            zoom={zoom}
            aspect={isProfileMode ? 1 : currentAspect}
            onCropChange={onCropChange}
            onCropComplete={onCropCompleteInternal}
            onCropAreaChange={onCropCompleteInternal}
            onZoomChange={onZoomChange}
            cropShape={cropShape}
            showGrid={!isProfileMode}
          />
        </div>

        {/* Aspect Ratio Selector (Non-profile mode) */}
        {!isProfileMode && (
          <div className="p-3 bg-surface-200/50 border-b border-surface-300/80">
            <p className="text-[10px] font-bold text-typography-500 uppercase tracking-wider mb-2 text-center">
              Proporção do Recorte
            </p>
            <div className="flex flex-wrap justify-center gap-1.5">
              {aspectPresets.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => setCurrentAspect(preset.value)}
                  className={`px-3 py-1 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                    currentAspect === preset.value 
                      ? 'bg-primary-200 text-white shadow-xs' 
                      : 'bg-surface-100 text-typography-700 hover:bg-surface-200 border border-surface-300'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Zoom Controls & Actions */}
        <div className="p-4 sm:p-5 space-y-4 bg-surface-100">
          {/* Zoom Slider */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-bold text-typography-600">
              <span className="flex items-center gap-1.5">
                <ZoomIn size={14} className="text-typography-400" />
                Zoom
              </span>
              <span className="font-mono text-[11px] text-primary-200 font-extrabold px-2 py-0.5 rounded-md bg-primary-200/10">
                {Math.round(zoom * 100)}%
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button 
                type="button"
                onClick={() => setZoom(prev => Math.max(1, Number((prev - 0.1).toFixed(2))))}
                className="p-2 rounded-xl bg-surface-200/80 hover:bg-surface-200 text-typography-700 border border-surface-300 transition-all active:scale-95 cursor-pointer"
                title="Reduzir Zoom"
              >
                <ZoomOut size={16} />
              </button>
              
              <input
                type="range"
                min={1}
                max={3}
                step={0.02}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="flex-1 accent-primary-200 h-2 bg-surface-200 rounded-lg cursor-pointer"
              />

              <button 
                type="button"
                onClick={() => setZoom(prev => Math.min(3, Number((prev + 0.1).toFixed(2))))}
                className="p-2 rounded-xl bg-surface-200/80 hover:bg-surface-200 text-typography-700 border border-surface-300 transition-all active:scale-95 cursor-pointer"
                title="Aumentar Zoom"
              >
                <ZoomIn size={16} />
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5 pt-1">
            <button
              type="button"
              onClick={onCancel}
              disabled={isProcessing}
              className="flex-1 px-4 py-2.5 rounded-xl text-xs font-bold text-typography-700 hover:text-typography-900 bg-surface-200/80 hover:bg-surface-200 border border-surface-300 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              Cancelar
            </button>
            
            {!isProfileMode && (
              <button
                type="button"
                onClick={() => handleSave(true)}
                disabled={isProcessing}
                className="flex-1 px-4 py-2.5 rounded-xl text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 shadow-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {isProcessing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                <span>Sem Fundo</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => handleSave(false)}
              disabled={isProcessing}
              className="flex-1 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-primary-200 hover:bg-primary-150 shadow-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {isProcessing ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} strokeWidth={2.5} />}
              <span>{isProfileMode ? 'Confirmar Foto' : 'Salvar'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

