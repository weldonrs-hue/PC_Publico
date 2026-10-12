'use client';

import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Copy, Check, Rocket, ChevronLeft, ShieldCheck, Zap, QrCode as QrIcon } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Pix } from '@/lib/pix-utils';

interface DonationViewProps {
  onBack: () => void;
}

export default function DonationView({ onBack }: DonationViewProps) {
  const [copied, setCopied] = useState(false);
  const [pixPayload, setPixPayload] = useState('');
  const pixKey = '+5598987663875';
  const displayKey = '(98) 98766-3875';

  useEffect(() => {
    try {
      const pix = new Pix(
        pixKey,
        'Weldon Rodrigues da Silva',
        'Campina Grande'
      );
      setPixPayload(pix.getPayload());
    } catch (error) {
      console.error('Error generating PIX payload:', error);
    }
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(pixPayload || pixKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const technicalNeeds = [
    {
      title: 'Studio de Programação',
      description: 'Ambiente de desenvolvimento e licenças de ferramentas necessárias para a construção e manutenção do código.',
      icon: Rocket,
      color: 'bg-blue-500/10 text-blue-500',
    },
    {
      title: 'Banco de Dados',
      description: 'Armazenamento seguro e de alta disponibilidade para todos os dados das congregações e itinerários.',
      icon: Zap,
      color: 'bg-amber-500/10 text-amber-500',
    },
    {
      title: 'Servidor e Hospedagem',
      description: 'Infraestrutura em nuvem para garantir que a plataforma esteja online 24/7 com performance estável.',
      icon: ShieldCheck,
      color: 'bg-emerald-500/10 text-emerald-500',
    },
    {
      title: 'Segurança e LGPD',
      description: 'Certificados SSL, criptografia de dados e sistemas de proteção para garantir a privacidade das informações.',
      icon: ShieldCheck,
      color: 'bg-purple-500/10 text-purple-500',
    }
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto space-y-6"
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <button 
          onClick={onBack}
          className="p-2 hover:bg-surface-200 rounded-xl transition-all text-typography-700 bg-surface-100 shadow-xs border border-surface-300 cursor-pointer"
          title="Voltar"
        >
          <ChevronLeft size={20} />
        </button>
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-typography-900 tracking-tight">Apoio ao Projeto</h1>
          <p className="text-xs sm:text-sm text-typography-500 font-medium">Contribua para a manutenção e evolução do ProgCir</p>
        </div>
      </div>

      {/* Main Content Card */}
      <div className="bg-surface-100 border border-surface-300 rounded-3xl p-6 sm:p-8 md:p-10 shadow-xs relative overflow-hidden space-y-8">
        {/* Top gradient accent line */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary-200 via-primary-150 to-transparent" />

        <div className="space-y-3">
          <h2 className="text-2xl sm:text-3xl font-black text-typography-900 tracking-tight">
            Infraestrutura <span className="text-primary-200">Necessária</span>
          </h2>
          <p className="text-sm sm:text-base text-typography-600 leading-relaxed max-w-2xl">
            Para manter o ProgCir funcionando com excelência e segurança para todos os usuários, dependemos de uma estrutura técnica em nuvem que demanda investimentos contínuos.
          </p>
        </div>

        {/* Technical Needs Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {technicalNeeds.map((need, index) => (
            <div key={index} className="p-4 sm:p-5 bg-surface-200/40 border border-surface-300 rounded-2xl flex items-start gap-4">
              <div className={`w-11 h-11 ${need.color} rounded-xl border border-surface-300/40 flex items-center justify-center shrink-0`}>
                <need.icon size={22} />
              </div>
              <div className="space-y-1 min-w-0">
                <h4 className="font-bold text-sm text-typography-900 leading-snug">{need.title}</h4>
                <p className="text-xs text-typography-500 leading-relaxed">{need.description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* PIX Donation Box */}
        <div className="flex flex-col md:flex-row gap-5 items-stretch">
          <div className="flex-1 p-6 bg-surface-200/60 border border-surface-300 rounded-2xl flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center gap-2.5 mb-1.5">
                <div className="w-8 h-8 rounded-lg bg-primary-200/10 text-primary-200 flex items-center justify-center">
                  <Zap size={18} />
                </div>
                <h3 className="text-base sm:text-lg font-bold text-typography-900">Apoio via PIX</h3>
              </div>
              <p className="text-xs text-typography-500 leading-relaxed">
                Qualquer contribuição voluntária ajuda diretamente na sustentabilidade do projeto.
              </p>
            </div>

            <div className="space-y-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-typography-500 ml-0.5">Chave Celular</span>
              <div className="bg-surface-100 border border-surface-300 rounded-xl p-3 flex items-center justify-between gap-3 shadow-xs">
                <code className="text-sm sm:text-base font-mono font-bold text-typography-900 truncate">
                  {displayKey}
                </code>
                <button 
                  onClick={handleCopy}
                  className={`px-3.5 py-2 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                    copied 
                      ? 'bg-emerald-500 text-white' 
                      : 'bg-primary-200 hover:bg-primary-150 text-white shadow-xs'
                  }`}
                >
                  {copied ? (
                    <>
                      <Check size={14} strokeWidth={3} />
                      <span>Copiado</span>
                    </>
                  ) : (
                    <>
                      <Copy size={14} />
                      <span>Copiar</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* QR Code */}
          <div className="md:w-52 bg-surface-200/40 border border-surface-300 rounded-2xl flex flex-col items-center justify-center p-5 space-y-3">
            <div className="w-32 h-32 bg-white rounded-xl flex items-center justify-center p-2.5 shadow-xs border border-surface-300">
              {pixPayload ? (
                <QRCodeSVG 
                  value={pixPayload} 
                  size={108} 
                  level="M"
                  includeMargin={false}
                  className="w-full h-full"
                />
              ) : (
                <QrIcon size={44} className="text-typography-400" />
              )}
            </div>
            <p className="text-[11px] font-bold text-typography-500 uppercase tracking-wider text-center leading-tight">
              Escaneie o QR Code PIX
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
