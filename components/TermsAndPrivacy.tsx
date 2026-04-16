'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Shield, FileText, ChevronRight } from 'lucide-react';

interface TermsAndPrivacyProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'terms' | 'privacy';
}

export default function TermsAndPrivacy({ isOpen, onClose, initialTab = 'terms' }: TermsAndPrivacyProps) {
  const [activeTab, setActiveTab] = useState<'terms' | 'privacy'>(initialTab);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[4000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-gray-100 flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="bg-[#6c40bd] p-4 text-white flex justify-between items-center shrink-0">
            <div className="flex items-center gap-2">
              <Shield size={20} />
              <h3 className="font-bold text-sm tracking-tight uppercase">Termos e Privacidade</h3>
            </div>
            <button 
              onClick={onClose}
              className="p-1.5 hover:bg-white/20 rounded-full transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-gray-100 shrink-0">
            <button
              onClick={() => setActiveTab('terms')}
              className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                activeTab === 'terms' ? 'text-[#6c40bd] border-b-2 border-[#6c40bd] bg-purple-50/50' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <FileText size={16} />
              Termos de Uso
            </button>
            <button
              onClick={() => setActiveTab('privacy')}
              className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                activeTab === 'privacy' ? 'text-[#6c40bd] border-b-2 border-[#6c40bd] bg-purple-50/50' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <Shield size={16} />
              Privacidade
            </button>
          </div>

          {/* Content Area */}
          <div className="p-6 overflow-y-auto custom-scrollbar flex-1 text-sm text-gray-700 leading-relaxed">
            {activeTab === 'terms' ? (
              <div className="space-y-4">
                <section>
                  <h4 className="font-bold text-gray-900 border-b pb-1 mb-2">1. Aceitação dos Termos</h4>
                  <p>Ao acessar e usar o sistema ProgCir, você concorda em cumprir e estar vinculado aos seguintes termos e condições de uso.</p>
                </section>
                <section>
                  <h4 className="font-bold text-gray-900 border-b pb-1 mb-2">2. Uso do Sistema</h4>
                  <p>Este sistema é destinado exclusivamente para a gestão de atividades relacionadas ao circuito. O uso indevido, acesso não autorizado ou compartilhamento de credenciais é estritamente proibido.</p>
                </section>
                <section>
                  <h4 className="font-bold text-gray-900 border-b pb-1 mb-2">3. Responsabilidade do Usuário</h4>
                  <p>Você é responsável por manter a confidencialidade de sua senha e por todas as atividades que ocorrem em sua conta. Notifique imediatamente os administradores sobre qualquer uso não autorizado.</p>
                </section>
                <section>
                  <h4 className="font-bold text-gray-900 border-b pb-1 mb-2">4. Modificações</h4>
                  <p>Reservamo-nos o direito de modificar estes termos a qualquer momento. O uso continuado do sistema após tais alterações constitui sua aceitação dos novos termos.</p>
                </section>
                <section>
                  <h4 className="font-bold text-gray-900 border-b pb-1 mb-2">5. Propriedade Intelectual</h4>
                  <p>Todo o conteúdo, design e código deste aplicativo são protegidos por direitos de propriedade intelectual.</p>
                </section>
              </div>
            ) : (
              <div className="space-y-4">
                <section>
                  <h4 className="font-bold text-gray-900 border-b pb-1 mb-2 underline decoration-purple-300">1. Coleta de Dados</h4>
                  <p>Coletamos informações necessárias para a organização das atividades, incluindo dados de congregações, itinerários e relatórios de atividades.</p>
                </section>
                <section>
                  <h4 className="font-bold text-gray-900 border-b pb-1 mb-2 underline decoration-purple-300">2. Uso das Informações</h4>
                  <p>Os dados são processados com a finalidade exclusiva de facilitar a gestão do circuito, geração de documentos (como cartas de designação e relatórios S-303) e análise de estatísticas.</p>
                </section>
                <section>
                  <h4 className="font-bold text-gray-900 border-b pb-1 mb-2 underline decoration-purple-300">3. LGPD (Lei Geral de Proteção de Dados)</h4>
                  <p>Em conformidade com a Lei nº 13.709/2018, garantimos a proteção de dados pessoais e implementamos medidas para evitar vazamentos ou acesso não autorizado.</p>
                </section>
                <section>
                  <h4 className="font-bold text-gray-900 border-b pb-1 mb-2 underline decoration-purple-300">4. Compartilhamento</h4>
                  <p>Não compartilhamos dados pessoais com terceiros fora da organização do circuito, exceto quando exigido por lei ou para cumprir propósitos administrativos internos.</p>
                </section>
                <section>
                  <h4 className="font-bold text-gray-900 border-b pb-1 mb-2 underline decoration-purple-300">5. Seus Direitos</h4>
                  <p>Você tem o direito de solicitar o acesso, correção ou exclusão de seus dados pessoais a qualquer momento através dos administradores do sistema.</p>
                </section>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end shrink-0">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-[#6c40bd] text-white rounded-xl font-bold text-xs hover:bg-[#5a32a3] transition-all"
            >
              Entendido
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
