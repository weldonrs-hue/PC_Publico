'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldCheck, X, ExternalLink } from 'lucide-react';

export default function LGPDConsent() {
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('lgpd_consent');
    if (!consent) {
      const timer = setTimeout(() => setShowBanner(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem('lgpd_consent', 'true');
    setShowBanner(false);
  };

  return (
    <AnimatePresence>
      {showBanner && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-[3000]"
        >
          <div className="relative overflow-hidden bg-surface-100 rounded-3xl shadow-2xl border border-surface-300 p-5 sm:p-6 space-y-4 text-typography-900">
            {/* Top gradient accent line */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary-200 via-primary-150 to-transparent" />

            <div className="flex items-start gap-3.5">
              <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 p-2.5 rounded-2xl shrink-0 shadow-xs">
                <ShieldCheck size={24} strokeWidth={2.2} />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-typography-900 text-sm sm:text-base tracking-tight">Privacidade e Proteção de Dados (LGPD)</h4>
                <p className="text-xs text-typography-600 mt-1 leading-relaxed">
                  Este aplicativo processa dados pessoais para fins de gestão das atividades do circuito. 
                  Ao continuar, você concorda com o processamento de dados conforme a Lei Geral de Proteção de Dados (Lei nº 13.709/2018).
                </p>
              </div>
              <button 
                onClick={() => setShowBanner(false)}
                className="text-typography-400 hover:text-typography-800 hover:bg-surface-200 p-1.5 rounded-xl transition-all cursor-pointer shrink-0"
                title="Fechar"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
              <button
                onClick={handleAccept}
                className="flex-1 bg-primary-200 hover:bg-primary-150 text-white text-xs font-bold py-2.5 px-4 rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer text-center"
              >
                Aceitar e Continuar
              </button>
              <button
                onClick={() => window.open('https://www.gov.br/esporte/pt-br/acesso-a-informacao/lgpd', '_blank')}
                className="flex items-center justify-center gap-1.5 text-xs font-semibold text-typography-600 hover:text-typography-900 hover:bg-surface-200 transition-all py-2 px-3.5 rounded-xl cursor-pointer"
              >
                <span>Saber mais</span>
                <ExternalLink size={13} />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
