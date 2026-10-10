'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Clock, Radio, AlertCircle, Maximize2, Minimize2 } from 'lucide-react';
import { db } from '@/lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { useSearchParams } from 'next/navigation';

interface BroadcastData {
  userId: string;
  userName: string;
  mode: 'stopwatch' | 'timer';
  isRunning: boolean;
  time: number;
  timerValue: number;
  syncTime: any;
}

function TimerContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const [data, setData] = useState<BroadcastData | null>(null);
  const [displayTime, setDisplayTime] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (!id) return;

    const unsub = onSnapshot(doc(db, 'timer_broadcasts', id), (snap) => {
      setLoading(false);
      if (snap.exists()) {
        setData(snap.data() as BroadcastData);
      } else {
        setData(null);
      }
    });

    return () => unsub();
  }, [id]);

  useEffect(() => {
    if (!data) return;

    const updateDisplay = () => {
      const now = Date.now();
      const syncMillis = data.syncTime?.toMillis() || now;
      const elapsedSinceSync = Math.floor((now - syncMillis) / 1000);

      if (data.isRunning) {
        if (data.mode === 'stopwatch') {
          setDisplayTime(data.time + elapsedSinceSync);
        } else {
          setDisplayTime(data.time - elapsedSinceSync);
        }
      } else {
        setDisplayTime(data.time);
      }
    };

    updateDisplay();
    const interval = setInterval(updateDisplay, 1000);
    return () => clearInterval(interval);
  }, [data]);

  const formatTime = (seconds: number) => {
    const isNegative = seconds < 0;
    const absSeconds = Math.abs(seconds);
    const hrs = Math.floor(absSeconds / 3600);
    const mins = Math.floor((absSeconds % 3600) / 60);
    const secs = absSeconds % 60;
    const timeStr = `${hrs > 0 ? `${hrs.toString().padStart(2, '0')}:` : ''}${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    return isNegative ? `-${timeStr}` : timeStr;
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-50 flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-4 border-primary-200/20 border-t-primary-200 rounded-full animate-spin" />
        <p className="text-primary-200 font-bold uppercase tracking-[0.2em] text-xs">Conectando ao Cronômetro...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-surface-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="relative w-full max-w-md p-6 sm:p-8 rounded-3xl bg-surface-100 border border-surface-300 shadow-xl overflow-hidden flex flex-col items-center">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-500 to-transparent" />
          <div className="w-16 h-16 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center justify-center mb-5 text-rose-500">
            <AlertCircle size={32} />
          </div>
          <h1 className="text-xl font-bold text-typography-900 mb-2">Transmissão Não Encontrada</h1>
          <p className="text-sm text-typography-500 max-w-sm">Este link de cronômetro não existe ou a transmissão foi encerrada pelo instrutor.</p>
        </div>
      </div>
    );
  }

  const isEnding = data.mode === 'timer' && displayTime < 60 && displayTime > 0 && data.isRunning;
  const isFinished = data.mode === 'timer' && displayTime <= 0;

  return (
    <div className="min-h-screen bg-surface-50 text-typography-900 flex flex-col items-center justify-center overflow-hidden relative font-sans transition-colors duration-500">
      {/* Top Accent Stripe */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary-200 via-primary-150 to-transparent z-20" />

      {/* Background Glow */}
      <div className={`absolute inset-0 transition-colors duration-1000 ${
        isFinished ? 'bg-rose-500/10' : isEnding ? 'bg-amber-500/10' : 'bg-primary-200/5'
      }`} />
      
      {/* Top Info */}
      <div className="absolute top-6 sm:top-8 left-0 right-0 px-6 sm:px-8 flex items-center justify-between z-10">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 bg-surface-100 rounded-2xl flex items-center justify-center border border-surface-300 shadow-xs">
            <Radio className={`text-rose-500 ${data.isRunning ? 'animate-pulse' : ''}`} size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
              <p className="text-[10px] uppercase font-black tracking-[0.2em] text-typography-400">Transmissão Ao Vivo</p>
            </div>
            <p className="text-base sm:text-lg font-bold text-typography-900 tracking-tight">{data.userName}</p>
          </div>
        </div>

        <button 
          onClick={toggleFullscreen}
          className="p-3 bg-surface-100 hover:bg-surface-200 rounded-2xl border border-surface-300 text-typography-700 shadow-xs transition-all active:scale-95 cursor-pointer"
          title="Alternar Tela Cheia"
        >
          {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
        </button>
      </div>

      {/* Main Timer Display */}
      <div className="relative z-10 flex flex-col items-center">
        <motion.div
          key={displayTime}
          initial={{ scale: 0.96, opacity: 0.85 }}
          animate={{ scale: 1, opacity: 1 }}
          className={`text-[25vw] sm:text-[20vw] font-mono font-black leading-none tracking-tighter transition-colors duration-300 ${
            isFinished ? 'text-rose-500' : isEnding ? 'text-amber-500' : 'text-primary-200'
          }`}
        >
          {formatTime(displayTime)}
        </motion.div>
        
        <div className="mt-4 px-6 py-2 bg-surface-100/90 rounded-full border border-surface-300 shadow-xs backdrop-blur-md">
          <span className="text-xs sm:text-sm uppercase font-black tracking-[0.25em] text-typography-600">
            {data.mode === 'stopwatch' ? 'Tempo Decorrido' : 'Tempo Restante'}
          </span>
        </div>
      </div>

      {/* Footer Branding */}
      <div className="absolute bottom-6 sm:bottom-8 flex items-center gap-2.5 text-typography-400 opacity-60 hover:opacity-100 transition-all">
        <Clock size={16} />
        <span className="text-[11px] font-bold uppercase tracking-widest">ProgCir Timer System</span>
      </div>
    </div>
  );
}

export default function TimerBroadcastPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-surface-50 flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-4 border-primary-200/20 border-t-primary-200 rounded-full animate-spin" />
        <p className="text-primary-200 font-bold uppercase tracking-[0.2em] text-xs">Carregando...</p>
      </div>
    }>
      <TimerContent />
    </Suspense>
  );
}

