'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Move, Maximize2, RotateCcw, Save } from 'lucide-react';
import Image from 'next/image';

interface DraggableSignatureProps {
  image: string;
  initialX?: number;
  initialY?: number;
  initialScale?: number;
  onSave: (settings: { x: number, y: number, scale: number }) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export default function DraggableSignature({
  image,
  initialX = 100,
  initialY = 100,
  initialScale = 1,
  onSave,
  containerRef
}: DraggableSignatureProps) {
  const [position, setPosition] = useState({ x: initialX, y: initialY });
  const [scale, setScale] = useState(initialScale);
  const [aspectRatio, setAspectRatio] = useState(2.5); // Default

  useEffect(() => {
    setPosition({ x: initialX, y: initialY });
    setScale(initialScale);
  }, [initialX, initialY, initialScale]);

  useEffect(() => {
    const img = new window.Image();
    img.onload = () => {
      setAspectRatio(img.width / img.height);
    };
    img.src = image;
  }, [image]);

  const handleDragEnd = (_: any, info: any) => {
    setPosition({ x: position.x + info.delta.x, y: position.y + info.delta.y });
  };

  const baseHeight = 60;
  const width = baseHeight * aspectRatio;

  return (
    <div className="absolute inset-0 pointer-events-none z-50 overflow-hidden">
      <motion.div
        drag
        dragMomentum={false}
        onDragEnd={handleDragEnd}
        animate={{ x: position.x, y: position.y, scale: scale }}
        className="absolute pointer-events-auto cursor-move group"
        style={{ width: `${width}px`, height: `${baseHeight}px` }}
      >
        <div className="relative w-full h-full">
          {/* Signature Image */}
          <div className="w-full h-full relative">
            <Image 
              src={image} 
              alt="Assinatura" 
              fill 
              className="object-contain" 
              referrerPolicy="no-referrer"
            />
          </div>

          {/* Controls Overlay (visible on hover) */}
          <div className="absolute -top-12 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-white shadow-xl border border-gray-100 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
            <div className="flex items-center gap-1 px-2 border-r border-gray-100">
              <Maximize2 size={12} className="text-gray-400" />
              <input 
                type="range"
                min="0.5"
                max="3"
                step="0.05"
                value={scale}
                onChange={(e) => setScale(parseFloat(e.target.value))}
                className="w-16 h-1 bg-gray-200 rounded-full appearance-none cursor-pointer accent-emerald-600"
              />
            </div>
            <button 
              onClick={() => {
                setPosition({ x: initialX, y: initialY });
                setScale(initialScale);
              }}
              className="p-1.5 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"
              title="Resetar"
            >
              <RotateCcw size={14} />
            </button>
            <button 
              onClick={() => onSave({ ...position, scale })}
              className="p-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-600 rounded-full transition-colors flex items-center gap-1 px-3"
              title="Salvar Posição"
            >
              <Save size={14} />
              <span className="text-[10px] font-bold uppercase">Fixar</span>
            </button>
          </div>

          {/* Guidelines on hover */}
          <div className="absolute inset-0 border-2 border-dashed border-emerald-400/50 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
        </div>
      </motion.div>
    </div>
  );
}
