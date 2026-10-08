'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, FileText, X, Check } from 'lucide-react';

interface TermsAndPrivacyProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'terms' | 'privacy';
  defaultTab?: 'terms' | 'privacy';
}

export default function TermsAndPrivacy({ isOpen, onClose, initialTab, defaultTab }: TermsAndPrivacyProps) {
  const [activeTab, setActiveTab] = useState<'terms' | 'privacy'>(initialTab || defaultTab || 'terms');

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[4000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-surface-100 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-surface-300 flex flex-col max-h-[90vh] relative text-typography-900"
        >
          {/* Top gradient accent line */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary-200 via-primary-150 to-transparent z-10" />

          {/* Header */}
          <div className="bg-surface-200/50 border-b border-surface-300 p-4 sm:p-5 flex justify-between items-center shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-primary-200/10 border border-primary-200/30 text-primary-200 flex items-center justify-center shrink-0">
                <Shield size={18} />
              </div>
              <h3 className="font-bold text-sm sm:text-base tracking-tight uppercase text-typography-900">Termos e Privacidade</h3>
            </div>
            <button 
              onClick={onClose}
              className="p-1.5 hover:bg-surface-200 text-typography-500 hover:text-typography-900 rounded-xl transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-surface-300 shrink-0 bg-surface-200/30">
            <button
              onClick={() => setActiveTab('terms')}
              className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'terms' 
                  ? 'text-primary-200 border-b-2 border-primary-200 bg-primary-200/10' 
                  : 'text-typography-500 hover:text-typography-900'
              }`}
            >
              <FileText size={16} />
              Termos de Uso
            </button>
            <button
              onClick={() => setActiveTab('privacy')}
              className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'privacy' 
                  ? 'text-primary-200 border-b-2 border-primary-200 bg-primary-200/10' 
                  : 'text-typography-500 hover:text-typography-900'
              }`}
            >
              <Shield size={16} />
              Privacidade
            </button>
          </div>

          {/* Content Area */}
          <div className="p-6 overflow-y-auto custom-scrollbar flex-1 text-xs sm:text-sm text-typography-600 leading-relaxed space-y-4">
            {activeTab === 'terms' ? (
              <div className="space-y-4">
                <section>
                  <h4 className="font-bold text-typography-900 border-b border-surface-300/80 pb-1 mb-2">1. Aceitação dos Termos</h4>
                  <p>Ao acessar e usar o sistema ProgCir, você concorda em cumprir e estar vinculado aos seguintes termos e condições de uso.</p>
                </section>
                <section>
                  <h4 className="font-bold text-typography-900 border-b border-surface-300/80 pb-1 mb-2">2. Uso do Sistema</h4>
                  <p>Este sistema é destinado exclusivamente para a gestão de atividades relacionadas ao circuito. O uso indevido, acesso não autorizado ou compartilhamento de credenciais é estritamente proibido.</p>
                </section>
                <section>
                  <h4 className="font-bold text-typography-900 border-b border-surface-300/80 pb-1 mb-2">3. Responsabilidade do Usuário</h4>
                  <p>Você é responsável por manter a confidencialidade de sua senha e por todas as atividades que ocorrem em sua conta. Notifique imediatamente os administradores sobre qualquer uso não autorizado.</p>
                </section>
                <section>
                  <h4 className="font-bold text-typography-900 border-b border-surface-300/80 pb-1 mb-2">4. Modificações</h4>
                  <p>Reservamo-nos o direito de modificar estes termos a qualquer momento. O uso continuado do sistema após tais alterações constitui sua aceitação dos novos termos.</p>
                </section>
                <section>
                  <h4 className="font-bold text-typography-900 border-b border-surface-300/80 pb-1 mb-2">5. Propriedade Intelectual</h4>
                  <p>Todo o conteúdo, design e código deste aplicativo são protegidos por direitos de propriedade intelectual.</p>
                </section>
              </div>
            ) : (
              <div className="space-y-4">
                <section>
                  <h4 className="font-bold text-typography-900 border-b border-surface-300/80 pb-1 mb-2">1. Coleta de Dados</h4>
                  <p>Coletamos informações necessárias para a organização das atividades, incluindo dados de congregações, itinerários e relatórios de atividades.</p>
                </section>
                <section>
                  <h4 className="font-bold text-typography-900 border-b border-surface-300/80 pb-1 mb-2">2. Uso das Informações</h4>
                  <p>Os dados são processados com a finalidade exclusiva de facilitar a gestão do circuito, geração de documentos (como cartas de designação e relatórios S-303) e análise de estatísticas.</p>
                </section>
                <section>
                  <h4 className="font-bold text-typography-900 border-b border-surface-300/80 pb-1 mb-2">3. LGPD (Lei Geral de Proteção de Dados)</h4>
                  <p>Em conformidade com a Lei nº 13.709/2018, garantimos a proteção de dados pessoais e implementamos medidas para evitar vazamentos ou acesso não autorizado.</p>
                </section>
                <section>
                  <h4 className="font-bold text-typography-900 border-b border-surface-300/80 pb-1 mb-2">4. Compartilhamento</h4>
                  <p>Não compartilhamos dados pessoais com terceiros fora da organização do circuito, exceto quando exigido por lei ou para cumprir propósitos administrativos internos.</p>
                </section>
                <section>
                  <h4 className="font-bold text-typography-900 border-b border-surface-300/80 pb-1 mb-2">5. Seus Direitos</h4>
                  <p>Você tem o direito de solicitar o acesso, correção ou exclusão de seus dados pessoais a qualquer momento através dos administradores do sistema.</p>
                </section>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 bg-surface-200/40 border-t border-surface-300 flex justify-end shrink-0">
            <button
              onClick={onClose}
              className="px-6 py-2.5 bg-primary-200 hover:bg-primary-150 text-white rounded-xl font-bold text-xs transition-all cursor-pointer shadow-xs flex items-center gap-1.5"
            >
              <Check size={16} strokeWidth={2.5} />
              <span>Entendido</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
