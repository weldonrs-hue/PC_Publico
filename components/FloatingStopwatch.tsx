'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, Pause, RotateCcw, X, GripHorizontal, ChevronUp, ChevronDown, Clock, Settings, Share2, Radio, Copy, Check } from 'lucide-react';
import { db, auth } from '@/lib/firebase';
import { doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { useDialog } from '@/hooks/useDialog';

export default function FloatingStopwatch() {
  const { showAlert } = useDialog();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [time, setTime] = useState(0); // seconds
  const [isRunning, setIsRunning] = useState(false);
  const [mode, setMode] = useState<'stopwatch' | 'timer'>('stopwatch');
  const [timerValue, setTimerValue] = useState(10); // minutes for timer
  const [showSettings, setShowSettings] = useState(false);
  
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [copying, setCopying] = useState(false);
  const [lastSync, setLastSync] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRunning) {
      interval = setInterval(() => {
        if (mode === 'stopwatch') {
          setTime((prev) => prev + 1);
        } else {
          setTime((prev) => {
            return prev - 1;
          });
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning, mode]);

  const formatTime = (seconds: number) => {
    const isNegative = seconds < 0;
    const absSeconds = Math.abs(seconds);
    const hrs = Math.floor(absSeconds / 3600);
    const mins = Math.floor((absSeconds % 3600) / 60);
    const secs = absSeconds % 60;
    const timeStr = `${hrs > 0 ? `${hrs.toString().padStart(2, '0')}:` : ''}${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    return isNegative ? `-${timeStr}` : timeStr;
  };

  const handleStartPause = () => {
    const nextRunning = !isRunning;
    setIsRunning(nextRunning);
    if (isBroadcasting) syncToFirestore(nextRunning);
  };
  
  const handleReset = () => {
    setIsRunning(false);
    let newTime = 0;
    if (mode === 'stopwatch') {
      newTime = 0;
    } else {
      newTime = timerValue * 60;
    }
    setTime(newTime);
    if (isBroadcasting) syncToFirestore(false, newTime);
  };

  const toggleMode = () => {
    setIsRunning(false);
    const newMode = mode === 'stopwatch' ? 'timer' : 'stopwatch';
    setMode(newMode);
    let newTime = 0;
    if (newMode === 'stopwatch') {
      newTime = 0;
    } else {
      newTime = timerValue * 60;
    }
    setTime(newTime);
    if (isBroadcasting) syncToFirestore(false, newTime, newMode);
  };

  const adjustTimer = (amount: number) => {
    const newValue = Math.max(1, timerValue + amount);
    setTimerValue(newValue);
    if (mode === 'timer' && !isRunning) {
      const newTime = newValue * 60;
      setTime(newTime);
      if (isBroadcasting) syncToFirestore(false, newTime);
    }
  };

  const syncToFirestore = async (overrideIsRunning?: boolean, overrideTime?: number, overrideMode?: 'stopwatch' | 'timer') => {
    if (!isBroadcasting || !auth.currentUser) return;

    try {
      const broadcastId = auth.currentUser.uid;
      const ref = doc(db, 'timer_broadcasts', broadcastId);
      
      await setDoc(ref, {
        userId: auth.currentUser.uid,
        userName: auth.currentUser.displayName || 'Instrutor',
        mode: overrideMode || mode,
        isRunning: overrideIsRunning !== undefined ? overrideIsRunning : isRunning,
        time: overrideTime !== undefined ? overrideTime : time,
        timerValue: timerValue,
        syncTime: serverTimestamp()
      });
    } catch (error) {
      console.error('Error syncing timer:', error);
    }
  };

  const toggleBroadcast = async () => {
    if (!auth.currentUser) {
      await showAlert('Você precisa estar logado para transmitir o cronômetro.', 'Aviso');
      return;
    }

    const nextState = !isBroadcasting;
    setIsBroadcasting(nextState);

    if (nextState) {
      await syncToFirestore();
    } else {
      try {
        await deleteDoc(doc(db, 'timer_broadcasts', auth.currentUser.uid));
      } catch (e) {
        console.error('Error stopping broadcast:', e);
      }
    }
  };

  const copyBroadcastLink = () => {
    if (!auth.currentUser) return;
    const url = `${window.location.origin}/timer?id=${auth.currentUser.uid}`;
    navigator.clipboard.writeText(url);
    setCopying(true);
    setTimeout(() => setCopying(false), 2000);
  };

  // Sync on broadcast toggle
  useEffect(() => {
    if (isBroadcasting) {
      syncToFirestore();
    }
  }, [isBroadcasting]);

  if (!isOpen) return (
    <button 
      onClick={() => setIsOpen(true)}
      className="fixed bottom-6 portrait:bottom-20 right-6 bg-primary-200 text-white p-3.5 rounded-2xl shadow-xl hover:bg-primary-150 transition-all hover:scale-105 active:scale-95 z-40 flex items-center justify-center cursor-pointer ring-2 ring-primary-200/30"
      title="Abrir Cronômetro"
    >
      <Clock size={22} strokeWidth={2.2} />
    </button>
  );

  return (
    <motion.div
      drag
      dragMomentum={false}
      initial={{ x: 0, y: 0 }}
      className="fixed bottom-6 portrait:bottom-20 right-6 z-50 select-none"
    >
      <div className={`bg-surface-100 rounded-3xl shadow-2xl border border-surface-300 overflow-hidden transition-all duration-300 relative text-typography-900 ${isMinimized ? 'w-52' : 'w-76'}`}>
        {/* Top Accent Stripe */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary-200 via-primary-150 to-transparent z-10" />

        {/* Header/Handle */}
        <div className="bg-surface-200/70 p-3 pt-3.5 flex items-center justify-between cursor-move border-b border-surface-300/80">
          <div className="flex items-center gap-2 text-typography-500">
            <GripHorizontal size={16} />
            <span className="text-[10px] font-black uppercase tracking-wider text-typography-700">Cronômetro</span>
          </div>
          <div className="flex items-center gap-1">
            <button 
              onClick={() => setIsMinimized(!isMinimized)}
              className="p-1.5 hover:bg-surface-200 rounded-xl text-typography-500 hover:text-typography-900 transition-colors cursor-pointer"
              title={isMinimized ? "Expandir" : "Minimizar"}
            >
              {isMinimized ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            <button 
              onClick={() => setIsOpen(false)}
              className="p-1.5 hover:bg-rose-500/10 hover:text-rose-600 rounded-xl text-typography-500 transition-colors cursor-pointer"
              title="Fechar"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Content */}
        {!isMinimized && (
          <div className="p-5 space-y-5">
            {/* Display */}
            <div className={`text-center py-6 bg-surface-200/60 rounded-2xl shadow-inner border border-surface-300/80 relative overflow-hidden ${time < 60 && mode === 'timer' && time > 0 ? 'animate-pulse' : ''}`}>
              <div className="absolute inset-0 bg-gradient-to-b from-primary-200/5 to-transparent pointer-events-none" />
              <span className={`text-4xl sm:text-5xl font-mono font-black tracking-tight transition-colors ${time <= 0 && mode === 'timer' ? 'text-rose-600 dark:text-rose-400' : 'text-primary-200 dark:text-primary-150'}`}>
                {formatTime(time)}
              </span>
              <div className="text-[10px] uppercase font-black text-typography-400 mt-2 tracking-widest">
                {mode === 'stopwatch' ? 'Decorrido' : 'Restante'}
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={handleReset}
                className="p-3 hover:bg-surface-200 rounded-full text-typography-500 hover:text-typography-900 transition-all active:scale-90 cursor-pointer"
                title="Reiniciar"
              >
                <RotateCcw size={20} />
              </button>
              
              <button
                onClick={handleStartPause}
                className={`p-5 rounded-full shadow-lg transition-all active:scale-95 flex items-center justify-center cursor-pointer ${
                  isRunning 
                    ? 'bg-amber-500 text-white hover:bg-amber-600 shadow-amber-500/25' 
                    : 'bg-primary-200 text-white hover:bg-primary-150 shadow-primary-200/25'
                }`}
              >
                {isRunning ? <Pause size={30} fill="currentColor" /> : <Play size={30} fill="currentColor" className="ml-1" />}
              </button>

              <button
                onClick={() => setShowSettings(!showSettings)}
                className={`p-3 rounded-full transition-all active:scale-90 cursor-pointer ${showSettings ? 'bg-primary-200/10 text-primary-200' : 'hover:bg-surface-200 text-typography-500'}`}
                title="Ajustes"
              >
                <Settings size={20} />
              </button>
            </div>

            {/* Settings Panel */}
            <AnimatePresence>
              {showSettings && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="bg-surface-200/70 rounded-2xl p-4 space-y-4 border border-surface-300">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-typography-600 uppercase tracking-wider">Modo</span>
                      <button 
                        onClick={toggleMode}
                        className="text-[10px] font-black px-3 py-1.5 bg-surface-100 border border-surface-300 rounded-xl uppercase text-primary-200 hover:border-primary-200 shadow-2xs transition-all cursor-pointer"
                      >
                        {mode === 'stopwatch' ? 'Timer' : 'Crono'}
                      </button>
                    </div>

                    {mode === 'timer' && (
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-typography-600 uppercase tracking-wider">Minutos</span>
                        <div className="flex items-center gap-2.5">
                          <button onClick={() => adjustTimer(-1)} className="w-8 h-8 flex items-center justify-center bg-surface-100 border border-surface-300 rounded-xl hover:bg-surface-200 shadow-2xs active:scale-90 transition-all font-bold text-typography-700 cursor-pointer">-</button>
                          <span className="text-sm font-mono font-bold w-6 text-center text-typography-900">{timerValue}</span>
                          <button onClick={() => adjustTimer(1)} className="w-8 h-8 flex items-center justify-center bg-surface-100 border border-surface-300 rounded-xl hover:bg-surface-200 shadow-2xs active:scale-90 transition-all font-bold text-typography-700 cursor-pointer">+</button>
                        </div>
                      </div>
                    )}

                    <div className="pt-2 border-t border-surface-300/80 flex flex-col gap-2.5">
                      <button 
                        onClick={toggleBroadcast}
                        className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl border transition-all cursor-pointer ${
                          isBroadcasting 
                            ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20' 
                            : 'bg-primary-200/10 text-primary-200 border-primary-200/20'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Radio size={15} className={isBroadcasting ? 'animate-pulse' : ''} />
                          <span className="text-[10px] font-black uppercase tracking-wider">
                            {isBroadcasting ? 'Transmitindo...' : 'Transmitir Link'}
                          </span>
                        </div>
                        <div className={`w-8 h-4 rounded-full relative transition-colors ${isBroadcasting ? 'bg-rose-500' : 'bg-surface-300'}`}>
                          <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${isBroadcasting ? 'left-4.5' : 'left-0.5'}`} />
                        </div>
                      </button>

                      {isBroadcasting && (
                        <button 
                          onClick={copyBroadcastLink}
                          className="flex items-center justify-center gap-2 w-full py-2 bg-surface-100 border border-surface-300 rounded-xl hover:border-primary-200 shadow-2xs transition-all cursor-pointer text-typography-700"
                        >
                          {copying ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} className="text-typography-400" />}
                          <span className="text-[10px] font-bold uppercase tracking-wider">
                            {copying ? 'Copiado!' : 'Copiar Link'}
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Minimized View */}
        {isMinimized && (
          <div className="p-3.5 flex items-center justify-between bg-surface-200/70 text-primary-200">
            <span className="text-2xl font-mono font-black tracking-tight">{formatTime(time)}</span>
            <button
              onClick={handleStartPause}
              className={`p-2 rounded-xl transition-colors cursor-pointer ${isRunning ? 'bg-amber-500/10 text-amber-600 hover:bg-amber-500/20' : 'bg-primary-200/10 text-primary-200 hover:bg-primary-200/20'}`}
            >
              {isRunning ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}
