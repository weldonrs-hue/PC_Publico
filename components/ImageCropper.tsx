'use client';

import React, { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { X, Check, ZoomIn, ZoomOut } from 'lucide-react';

interface ImageCropperProps {
  image: string;
  onCropComplete: (croppedImage: string) => void;
  onCancel: () => void;
  aspect?: number;
  cropShape?: 'rect' | 'round';
  lockAspect?: boolean;
}

export default function ImageCropper({ 
  image, 
  onCropComplete, 
  onCancel, 
  aspect = 1, 
  cropShape = 'round',
  lockAspect = true
}: ImageCropperProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [currentAspect, setCurrentAspect] = useState(aspect);
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
    const image = await createImage(imageSrc);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      return '';
    }

    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;

    ctx.drawImage(
      image,
      pixelCrop.x,
      pixelCrop.y,
      pixelCrop.width,
      pixelCrop.height,
      0,
      0,
      pixelCrop.width,
      pixelCrop.height
    );

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
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  const aspectPresets = [
    { label: 'Quadrado', value: 1 },
    { label: '4:3', value: 4 / 3 },
    { label: '16:9', value: 16 / 9 },
    { label: 'Largo', value: 3 },
    { label: 'Assinatura', value: 6 },
    { label: 'Assinatura XL', value: 10 },
  ];

  return (
    <div className="fixed inset-0 z-[5000] bg-black/90 flex flex-col items-center justify-center p-4">
      <div className="relative w-full max-w-2xl h-[55vh] bg-[#1a1a1a] rounded-t-2xl overflow-hidden shadow-2xl">
        <Cropper
          image={image}
          crop={crop}
          zoom={zoom}
          aspect={currentAspect}
          onCropChange={onCropChange}
          onCropComplete={onCropCompleteInternal}
          onZoomChange={onZoomChange}
          cropShape={cropShape}
          showGrid={true}
        />
      </div>

      <div className="w-full max-w-2xl bg-gray-50 p-4 border-t border-gray-200">
        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 text-center">
          Proporção do Recorte (Largura : Altura)
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {aspectPresets.map((preset) => (
            <button
              key={preset.value}
              onClick={() => setCurrentAspect(preset.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all ${
                currentAspect === preset.value 
                  ? 'bg-emerald-600 text-white shadow-md' 
                  : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              {preset.label}
            </button>
          ))}
          <div className="flex items-center gap-2 ml-4">
            <span className="text-[10px] font-bold text-gray-400">AJUSTE:</span>
            <input 
              type="range"
              min="0.5"
              max="15"
              step="0.1"
              value={currentAspect}
              onChange={(e) => setCurrentAspect(parseFloat(e.target.value))}
              className="w-24 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
            />
          </div>
        </div>
      </div>

      <div className="w-full max-w-2xl bg-white p-6 rounded-b-2xl shadow-xl">
        <div className="flex items-center gap-4 mb-6">
          <ZoomOut size={20} className="text-gray-400" />
          <input
            type="range"
            value={zoom}
            min={1}
            max={3}
            step={0.1}
            aria-labelledby="Zoom"
            onChange={(e) => setZoom(Number(e.target.value))}
            className="flex-1 h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
          />
          <ZoomIn size={20} className="text-gray-400" />
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={onCancel}
            disabled={isProcessing}
            className="flex-1 min-w-[120px] flex items-center justify-center gap-2 py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-all disabled:opacity-50"
          >
            <X size={18} />
            Cancelar
          </button>
          
          <button
            onClick={() => handleSave(true)}
            disabled={isProcessing}
            className="flex-1 min-w-[200px] flex items-center justify-center gap-2 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-600/20 disabled:opacity-50"
          >
            {isProcessing ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
            Pronto (Remover Fundo)
          </button>

          <button
            onClick={() => handleSave(false)}
            disabled={isProcessing}
            className="flex-1 min-w-[150px] flex items-center justify-center gap-2 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50"
          >
            {isProcessing ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
            Salvar Original
          </button>
        </div>
        <p className="text-center text-[10px] text-gray-400 mt-4 uppercase tracking-widest font-bold">
          Dica: Ajuste a imagem para caber na área selecionada
        </p>
      </div>
    </div>
  );
}

import { Loader2, Sparkles } from 'lucide-react';
