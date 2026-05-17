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

  const x = useMotionValue(initialX);
  const y = useMotionValue(initialY);

  useEffect(() => {
    x.set(initialX);
    y.set(initialY);
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

  const handleDragEnd = () => {
    setIsDragging(false);
    const newX = x.get();
    const newY = y.get();
    setPosition({ x: newX, y: newY });
  };

  const handleResize = (e: React.PointerEvent | React.MouseEvent | React.TouchEvent, direction: string) => {
    e.stopPropagation();
    setIsResizing(true);

    const startX = 'touches' in e ? (e as any).touches[0].clientX : (e as any).clientX;
    const startY = 'touches' in e ? (e as any).touches[0].clientY : (e as any).clientY;
    const startScale = scale;
    const startXValue = x.get();
    const startYValue = y.get();

    const onMove = (moveEvent: MouseEvent | TouchEvent) => {
      moveEvent.preventDefault();
      const currentX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : moveEvent.clientX;
      const currentY = 'touches' in moveEvent ? moveEvent.touches[0].clientY : moveEvent.clientY;
      
      const deltaX = currentX - startX;
      const deltaY = currentY - startY;

      // Calculate scale change
      let calcScale = startScale;
      // Use the axis that provides most movement
      if (direction.includes('e')) {
        calcScale = startScale + (deltaX / 200);
      } else if (direction.includes('w')) {
        calcScale = startScale - (deltaX / 200);
      } else if (direction.includes('s')) {
        calcScale = startScale + (deltaY / 100);
      } else if (direction.includes('n')) {
        calcScale = startScale - (deltaY / 100);
      }

      const newScale = Math.max(0.2, Math.min(5, calcScale));
      setScale(newScale);

      // Maintain opposite corner position
      const scaleDiff = newScale - startScale;
      const widthDiff = baseHeight * aspectRatio * scaleDiff;
      const heightDiff = baseHeight * scaleDiff;

      if (direction.includes('w')) {
        x.set(startXValue - widthDiff);
      }
      if (direction.includes('n')) {
        y.set(startYValue - heightDiff);
      }
    };

    const onUp = () => {
      setIsResizing(false);
      setPosition({ x: x.get(), y: y.get() });
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    };

    window.addEventListener('mousemove', onMove, { passive: false });
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onUp);
  };

  const handleSave = () => {
    onSave({ x: x.get(), y: y.get(), scale });
    setShowSaved(true);
    setTimeout(() => setShowSaved(false), 2000);
  };

  const baseHeight = 60;
  const currentHeight = baseHeight * scale;
  const currentWidth = baseHeight * aspectRatio * scale;

  return (
    <div className="absolute inset-0 pointer-events-none z-50 overflow-hidden print:hidden">
      <motion.div
        drag={!isResizing}
        dragListener={!isResizing}
        dragMomentum={false}
        onDragStart={() => setIsDragging(true)}
        onDragEnd={handleDragEnd}
        style={{ x, y, width: `${currentWidth}px`, height: `${currentHeight}px` }}
        className={`absolute pointer-events-auto cursor-move group select-none ${isDragging ? 'z-50' : 'z-40'}`}
      >
        <div className={`relative w-full h-full`}>
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

          {/* Selection Border - Very thin and only group-hovered or active */}
          <div className={`absolute -inset-0.5 border border-blue-400/30 rounded-sm opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none ${isDragging || isResizing ? 'opacity-100 border-blue-500/50' : ''}`} />

          {/* Resize Handles - Smaller: 6px */}
          <div 
            className="absolute -top-1 -left-1 w-2 h-2 bg-white border border-blue-600 cursor-nwse-resize opacity-0 group-hover:opacity-100 shadow-sm hover:scale-125 transition-all pointer-events-auto z-10"
            onPointerDown={(e) => handleResize(e as any, 'nw')}
          />

          <div 
            className="absolute -top-1 -right-1 w-2 h-2 bg-white border border-blue-600 cursor-nesw-resize opacity-0 group-hover:opacity-100 shadow-sm hover:scale-125 transition-all pointer-events-auto z-10"
            onPointerDown={(e) => handleResize(e as any, 'ne')}
          />

          <div 
            className="absolute -bottom-1 -left-1 w-2 h-2 bg-white border border-blue-600 cursor-nesw-resize opacity-0 group-hover:opacity-100 shadow-sm hover:scale-125 transition-all pointer-events-auto z-10"
            onPointerDown={(e) => handleResize(e as any, 'sw')}
          />

          <div 
            className="absolute -bottom-1 -right-1 w-2 h-2 bg-white border border-blue-600 cursor-nwse-resize opacity-0 group-hover:opacity-100 shadow-sm hover:scale-125 transition-all pointer-events-auto z-10"
            onPointerDown={(e) => handleResize(e as any, 'se')}
          />

          {/* Top Controls Overlay - Even more discrete */}
          <div className="absolute -top-8 left-1/2 -translate-x-1/2 flex items-center gap-0.5 bg-white/90 backdrop-blur-sm shadow-md border border-gray-100 rounded p-0.5 opacity-0 group-hover:opacity-100 transition-all whitespace-nowrap">
            <button 
              onClick={() => {
                setPosition({ x: initialX, y: initialY });
                setScale(initialScale);
              }}
              className="p-1 hover:bg-gray-100 rounded text-gray-500 transition-colors"
              title="Resetar"
            >
              <RotateCcw size={12} />
            </button>
            
            <div className="h-3 w-px bg-gray-200 mx-0.5" />

            <button 
              onClick={handleSave}
              className={`flex items-center gap-1 px-2 py-0.5 rounded font-bold text-[9px] uppercase tracking-wider transition-all ${
                showSaved 
                ? 'bg-green-500 text-white' 
                : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {showSaved ? <Check size={10} /> : <Save size={10} />}
              {showSaved ? 'Salvo' : 'Fixar'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
