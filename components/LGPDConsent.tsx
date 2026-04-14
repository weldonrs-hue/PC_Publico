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
          className="fixed bottom-4 left-4 right-4 md:left-auto md:right-8 md:max-w-md z-[3000]"
        >
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 space-y-4">
            <div className="flex items-start gap-4">
              <div className="bg-green-100 p-2 rounded-xl text-green-600 shrink-0">
                <ShieldCheck size={24} />
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-gray-900 text-sm">Privacidade e Proteção de Dados (LGPD)</h4>
                <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                  Este aplicativo processa dados pessoais para fins de gestão das atividades do circuito. 
                  Ao continuar, você concorda com o processamento de dados conforme a Lei Geral de Proteção de Dados (Lei nº 13.709/2018).
                </p>
              </div>
              <button 
                onClick={() => setShowBanner(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={handleAccept}
                className="flex-1 bg-[#6c40bd] text-white text-xs font-bold py-2.5 px-4 rounded-xl hover:bg-[#5a32a3] transition-colors shadow-sm"
              >
                Aceitar e Continuar
              </button>
              <button
                onClick={() => window.open('https://www.gov.br/esporte/pt-br/acesso-a-informacao/lgpd', '_blank')}
                className="flex items-center justify-center gap-1 text-xs font-semibold text-gray-500 hover:text-gray-700 transition-colors py-2 px-4"
              >
                Saber mais <ExternalLink size={12} />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
