'use client';

import React, { useState, useEffect, use } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Clock, Radio, AlertCircle, Maximize2, Minimize2 } from 'lucide-react';
import { db } from '@/lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';

interface BroadcastData {
  userId: string;
  userName: string;
  mode: 'stopwatch' | 'timer';
  isRunning: boolean;
  time: number;
  timerValue: number;
  syncTime: any;
}

export default function TimerBroadcastPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
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
          setDisplayTime(Math.max(0, data.time - elapsedSinceSync));
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
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs > 0 ? `${hrs.toString().padStart(2, '0')}:` : ''}${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
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
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-4 border-violet-500/20 border-t-violet-500 rounded-full animate-spin" />
        <p className="text-violet-400 font-bold uppercase tracking-[0.3em] text-xs">Conectando ao Cronômetro...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mb-6 text-red-500">
          <AlertCircle size={40} />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Transmissão Não Encontrada</h1>
        <p className="text-gray-400 max-w-md">Este link de cronômetro não existe ou a transmissão foi encerrada pelo instrutor.</p>
      </div>
    );
  }

  const isEnding = data.mode === 'timer' && displayTime < 60 && displayTime > 0 && data.isRunning;
  const isFinished = data.mode === 'timer' && displayTime === 0;

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center overflow-hidden relative font-sans">
      {/* Background Glow */}
      <div className={`absolute inset-0 transition-colors duration-1000 ${
        isFinished ? 'bg-red-900/20' : isEnding ? 'bg-amber-900/10' : 'bg-violet-900/10'
      }`} />
      
      {/* Top Info */}
      <div className="absolute top-8 left-0 right-0 px-8 flex items-center justify-between z-10">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center border border-white/10">
            <Radio className={`text-red-500 ${data.isRunning ? 'animate-pulse' : ''}`} size={24} />
          </div>
          <div>
            <p className="text-[10px] uppercase font-black tracking-[0.2em] text-gray-500">Transmissão Ao Vivo</p>
            <p className="text-lg font-bold text-white/90">{data.userName}</p>
          </div>
        </div>

        <button 
          onClick={toggleFullscreen}
          className="p-3 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition-all active:scale-95"
        >
          {isFullscreen ? <Minimize2 size={24} /> : <Maximize2 size={24} />}
        </button>
      </div>

      {/* Main Timer Display */}
      <div className="relative z-10 flex flex-col items-center">
        <motion.div
          key={displayTime}
          initial={{ scale: 0.95, opacity: 0.8 }}
          animate={{ scale: 1, opacity: 1 }}
          className={`text-[25vw] sm:text-[20vw] font-mono font-bold leading-none tracking-tighter transition-colors duration-300 ${
            isFinished ? 'text-red-500 animate-pulse' : isEnding ? 'text-amber-400' : 'text-emerald-400'
          }`}
        >
          {formatTime(displayTime)}
        </motion.div>
        
        <div className="mt-4 px-6 py-2 bg-white/5 rounded-full border border-white/10 backdrop-blur-md">
          <span className="text-[14px] sm:text-[18px] uppercase font-black tracking-[0.3em] text-gray-400">
            {data.mode === 'stopwatch' ? 'Tempo Decorrido' : 'Tempo Restante'}
          </span>
        </div>
      </div>

      {/* Footer Branding */}
      <div className="absolute bottom-8 flex items-center gap-3 opacity-30 grayscale hover:grayscale-0 hover:opacity-100 transition-all">
        <Clock size={20} />
        <span className="text-xs font-bold uppercase tracking-widest">ProgCir Timer System</span>
      </div>
    </div>
  );
}
