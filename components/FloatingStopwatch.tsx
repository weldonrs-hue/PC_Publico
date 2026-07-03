'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, Pause, RotateCcw, X, GripHorizontal, ChevronUp, ChevronDown, Clock, Settings } from 'lucide-react';

export default function FloatingStopwatch() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [time, setTime] = useState(0); // seconds
  const [isRunning, setIsRunning] = useState(false);
  const [mode, setMode] = useState<'stopwatch' | 'timer'>('stopwatch');
  const [timerValue, setTimerValue] = useState(10); // minutes for timer
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRunning) {
      interval = setInterval(() => {
        if (mode === 'stopwatch') {
          setTime((prev) => prev + 1);
        } else {
          setTime((prev) => {
            if (prev <= 0) {
              setIsRunning(false);
              return 0;
            }
            return prev - 1;
          });
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning, mode]);

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs > 0 ? `${hrs.toString().padStart(2, '0')}:` : ''}${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStartPause = () => setIsRunning(!isRunning);
  
  const handleReset = () => {
    setIsRunning(false);
    if (mode === 'stopwatch') {
      setTime(0);
    } else {
      setTime(timerValue * 60);
    }
  };

  const toggleMode = () => {
    setIsRunning(false);
    const newMode = mode === 'stopwatch' ? 'timer' : 'stopwatch';
    setMode(newMode);
    if (newMode === 'stopwatch') {
      setTime(0);
    } else {
      setTime(timerValue * 60);
    }
  };

  const adjustTimer = (amount: number) => {
    const newValue = Math.max(1, timerValue + amount);
    setTimerValue(newValue);
    if (mode === 'timer' && !isRunning) {
      setTime(newValue * 60);
    }
  };

  if (!isOpen) return (
    <button 
      onClick={() => setIsOpen(true)}
      className="fixed bottom-6 right-6 bg-violet-600 text-white p-4 rounded-full shadow-2xl hover:bg-violet-700 transition-all hover:scale-110 active:scale-95 z-50 flex items-center justify-center"
      title="Abrir Cronômetro"
    >
      <Clock size={24} />
    </button>
  );

  return (
    <motion.div
      drag
      dragMomentum={false}
      initial={{ x: 0, y: 0 }}
      className="fixed bottom-6 right-6 z-50 select-none"
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
              <span className={`text-5xl font-mono font-bold tracking-tighter transition-colors ${time === 0 && mode === 'timer' ? 'text-red-500' : 'text-emerald-400'}`}>
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
