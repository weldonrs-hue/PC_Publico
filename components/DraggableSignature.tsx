'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, useMotionValue, useTransform } from 'motion/react';
import { Move, RotateCcw, Save, Maximize2, Check } from 'lucide-react';
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
  const [aspectRatio, setAspectRatio] = useState(2.5);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [showSaved, setShowSaved] = useState(false);

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
    setIsDragging(false);
    setPosition({ x: position.x + info.delta.x, y: position.y + info.delta.y });
  };

  const handleResize = (e: React.MouseEvent | React.TouchEvent, direction: string) => {
    e.stopPropagation();
    setIsResizing(true);

    const startX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const startScale = scale;

    const onMove = (moveEvent: MouseEvent | TouchEvent) => {
      const currentX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : moveEvent.clientX;
      const deltaX = currentX - startX;
      
      // Calculate new scale based on drag distance
      // If we drag right, scale increases. 100px = ~0.5 scale increase
      const newScale = Math.max(0.2, Math.min(5, startScale + (deltaX / 200)));
      setScale(newScale);
    };

    const onUp = () => {
      setIsResizing(false);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove);
    window.addEventListener('touchend', onUp);
  };

  const handleSave = () => {
    onSave({ ...position, scale });
    setShowSaved(true);
    setTimeout(() => setShowSaved(false), 2000);
  };

  const baseHeight = 60;
  const width = baseHeight * aspectRatio;

  return (
    <div className="absolute inset-0 pointer-events-none z-50 overflow-hidden print:hidden">
      <motion.div
        drag
        dragMomentum={false}
        onDragStart={() => setIsDragging(true)}
        onDragEnd={handleDragEnd}
        animate={{ 
          x: position.x, 
          y: position.y, 
          scale: scale,
        }}
        className={`absolute pointer-events-auto cursor-move group select-none ${isDragging ? 'z-50' : 'z-40'}`}
        style={{ width: `${width}px`, height: `${baseHeight}px` }}
      >
        <div className={`relative w-full h-full transition-shadow ${isDragging || isResizing ? 'shadow-2xl' : ''}`}>
          {/* Signature Image */}
          <div className="w-full h-full relative">
            <Image 
              src={image} 
              alt="Assinatura" 
              fill 
              className="object-contain" 
              referrerPolicy="no-referrer"
              draggable={false}
            />
          </div>

          {/* Selection Border (Adobe-style) */}
          <div className={`absolute -inset-2 border-2 border-blue-500/50 rounded-sm opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none ${isDragging || isResizing ? 'opacity-100 border-blue-600' : ''}`} />

          {/* Resize Handles (Corners) */}
          <div 
            className="absolute -top-3 -left-3 w-6 h-6 bg-white border-2 border-blue-600 rounded-full cursor-nwse-resize opacity-0 group-hover:opacity-100 flex items-center justify-center shadow-lg hover:scale-110 transition-all pointer-events-auto"
            onMouseDown={(e) => handleResize(e, 'nw')}
            onTouchStart={(e) => handleResize(e as any, 'nw')}
          >
            <div className="w-1.5 h-1.5 bg-blue-600 rounded-sm" />
          </div>

          <div 
            className="absolute -top-3 -right-3 w-6 h-6 bg-white border-2 border-blue-600 rounded-full cursor-nesw-resize opacity-0 group-hover:opacity-100 flex items-center justify-center shadow-lg hover:scale-110 transition-all pointer-events-auto"
            onMouseDown={(e) => handleResize(e, 'ne')}
            onTouchStart={(e) => handleResize(e as any, 'ne')}
          >
            <div className="w-1.5 h-1.5 bg-blue-600 rounded-sm" />
          </div>

          <div 
            className="absolute -bottom-3 -left-3 w-6 h-6 bg-white border-2 border-blue-600 rounded-full cursor-nesw-resize opacity-0 group-hover:opacity-100 flex items-center justify-center shadow-lg hover:scale-110 transition-all pointer-events-auto"
            onMouseDown={(e) => handleResize(e, 'sw')}
            onTouchStart={(e) => handleResize(e as any, 'sw')}
          >
            <div className="w-1.5 h-1.5 bg-blue-600 rounded-sm" />
          </div>

          <div 
            className="absolute -bottom-3 -right-3 w-6 h-6 bg-white border-2 border-blue-600 rounded-full cursor-nwse-resize opacity-0 group-hover:opacity-100 flex items-center justify-center shadow-lg hover:scale-110 transition-all pointer-events-auto"
            onMouseDown={(e) => handleResize(e, 'se')}
            onTouchStart={(e) => handleResize(e as any, 'se')}
          >
            <div className="w-1.5 h-1.5 bg-blue-600 rounded-sm" />
          </div>

          {/* Top Controls Overlay */}
          <div className="absolute -top-14 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-white/95 backdrop-blur shadow-2xl border border-blue-100 rounded-xl p-1.5 opacity-0 group-hover:opacity-100 transition-all whitespace-nowrap scale-90 group-hover:scale-100">
            <button 
              onClick={() => {
                setPosition({ x: initialX, y: initialY });
                setScale(initialScale);
              }}
              className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"
              title="Resetar"
            >
              <RotateCcw size={16} />
            </button>
            
            <div className="h-6 w-px bg-gray-200 mx-1" />

            <button 
              onClick={handleSave}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wider transition-all ${
                showSaved 
                ? 'bg-green-500 text-white' 
                : 'bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-200'
              }`}
            >
              {showSaved ? <Check size={16} /> : <Save size={16} />}
              {showSaved ? 'Salvo' : 'Fixar Local'}
            </button>
          </div>

          {/* Scale info bubble */}
          {(isResizing || isDragging) && (
            <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 bg-gray-800/80 text-white px-2 py-0.5 rounded text-[10px] font-mono whitespace-nowrap">
              Pos: {Math.round(position.x)},{Math.round(position.y)} | Escala: {scale.toFixed(2)}x
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
