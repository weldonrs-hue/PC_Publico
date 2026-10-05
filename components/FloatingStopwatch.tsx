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
      className="fixed bottom-6 portrait:bottom-20 right-6 bg-primary-200 text-white p-3.5 rounded-full shadow-lg hover:opacity-90 transition-all hover:scale-105 active:scale-95 z-40 flex items-center justify-center cursor-pointer"
      title="Abrir Cronômetro"
    >
      <Clock size={22} />
    </button>
  );

  return (
    <motion.div
      drag
      dragMomentum={false}
      initial={{ x: 0, y: 0 }}
      className="fixed bottom-6 portrait:bottom-20 right-6 z-50 select-none"
    >
      <div className={`bg-white rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.2)] border border-gray-100 overflow-hidden transition-all duration-300 ${isMinimized ? 'w-48' : 'w-72'}`}>
        {/* Header/Handle */}
        <div className="bg-gray-50/50 p-2.5 flex items-center justify-between cursor-move border-b border-gray-100">
          <div className="flex items-center gap-2 text-gray-400">
            <GripHorizontal size={16} />
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Cronômetro</span>
          </div>
          <div className="flex items-center gap-1">
            <button 
              onClick={() => setIsMinimized(!isMinimized)}
              className="p-1.5 hover:bg-gray-200 rounded-lg text-gray-500 transition-colors"
            >
              {isMinimized ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            <button 
              onClick={() => setIsOpen(false)}
              className="p-1.5 hover:bg-red-50 hover:text-red-500 rounded-lg text-gray-500 transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Content */}
        {!isMinimized && (
          <div className="p-5 space-y-5">
            {/* Display */}
            <div className={`text-center py-6 bg-gray-950 rounded-2xl shadow-inner border border-white/5 relative overflow-hidden ${time < 60 && mode === 'timer' && time > 0 ? 'animate-pulse' : ''}`}>
              <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />
              <span className={`text-5xl font-mono font-bold tracking-tighter transition-colors ${time <= 0 && mode === 'timer' ? 'text-red-500' : 'text-emerald-400'}`}>
                {formatTime(time)}
              </span>
              <div className="text-[10px] uppercase font-black text-gray-600 mt-2 tracking-[0.2em]">
                {mode === 'stopwatch' ? 'Decorrido' : 'Restante'}
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={handleReset}
                className="p-3 hover:bg-gray-100 rounded-full text-gray-500 transition-all active:scale-90"
                title="Reiniciar"
              >
                <RotateCcw size={20} />
              </button>
              
              <button
                onClick={handleStartPause}
                className={`p-5 rounded-full shadow-xl transition-all active:scale-95 flex items-center justify-center ${
                  isRunning 
                    ? 'bg-amber-100 text-amber-600 hover:bg-amber-200 hover:shadow-amber-200/50' 
                    : 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200 hover:shadow-emerald-200/50'
                }`}
              >
                {isRunning ? <Pause size={32} fill="currentColor" /> : <Play size={32} fill="currentColor" className="ml-1" />}
              </button>

              <button
                onClick={() => setShowSettings(!showSettings)}
                className={`p-3 rounded-full transition-all active:scale-90 ${showSettings ? 'bg-violet-100 text-violet-600' : 'hover:bg-gray-100 text-gray-500'}`}
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
                  <div className="bg-gray-50 rounded-2xl p-4 space-y-4 border border-gray-100">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Modo</span>
                      <button 
                        onClick={toggleMode}
                        className="text-[10px] font-black px-3 py-1.5 bg-white border border-gray-200 rounded-lg uppercase text-violet-600 hover:border-violet-300 hover:shadow-sm transition-all"
                      >
                        {mode === 'stopwatch' ? 'Timer' : 'Crono'}
                      </button>
                    </div>

                    {mode === 'timer' && (
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Minutos</span>
                        <div className="flex items-center gap-3">
                          <button onClick={() => adjustTimer(-1)} className="w-8 h-8 flex items-center justify-center bg-white border rounded-lg hover:bg-gray-50 hover:shadow-sm active:scale-90 transition-all">-</button>
                          <span className="text-sm font-mono font-bold w-6 text-center text-gray-700">{timerValue}</span>
                          <button onClick={() => adjustTimer(1)} className="w-8 h-8 flex items-center justify-center bg-white border rounded-lg hover:bg-gray-50 hover:shadow-sm active:scale-90 transition-all">+</button>
                        </div>
                      </div>
                    )}

                    <div className="pt-2 border-t border-gray-100 flex flex-col gap-3">
                      <button 
                        onClick={toggleBroadcast}
                        className={`flex items-center justify-between px-3 py-2.5 rounded-xl transition-all ${
                          isBroadcasting 
                            ? 'bg-red-50 text-red-600 border border-red-100' 
                            : 'bg-blue-50 text-blue-600 border border-blue-100'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Radio size={16} className={isBroadcasting ? 'animate-pulse' : ''} />
                          <span className="text-[10px] font-black uppercase tracking-widest">
                            {isBroadcasting ? 'Transmitindo...' : 'Transmitir Link'}
                          </span>
                        </div>
                        <div className={`w-8 h-4 rounded-full relative transition-colors ${isBroadcasting ? 'bg-red-500' : 'bg-gray-300'}`}>
                          <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${isBroadcasting ? 'left-4.5' : 'left-0.5'}`} />
                        </div>
                      </button>

                      {isBroadcasting && (
                        <button 
                          onClick={copyBroadcastLink}
                          className="flex items-center justify-center gap-2 w-full py-2 bg-white border border-gray-200 rounded-xl hover:border-blue-300 hover:shadow-sm transition-all"
                        >
                          {copying ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} className="text-gray-400" />}
                          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-600">
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
          <div className="p-3.5 flex items-center justify-between bg-gray-950 text-emerald-400">
            <span className="text-2xl font-mono font-bold tracking-tighter">{formatTime(time)}</span>
            <button
              onClick={handleStartPause}
              className={`p-2 rounded-lg transition-colors ${isRunning ? 'bg-amber-400/10 text-amber-400 hover:bg-amber-400/20' : 'bg-emerald-400/10 text-emerald-400 hover:bg-emerald-400/20'}`}
            >
              {isRunning ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}
