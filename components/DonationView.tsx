'use client';

import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Copy, Check, Coffee, Rocket, ArrowLeft, ShieldCheck, Zap, QrCode as QrIcon } from 'lucide-react';
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
      color: 'bg-blue-50 text-blue-600',
      borderColor: 'border-blue-100'
    },
    {
      title: 'Banco de Dados',
      description: 'Armazenamento seguro e de alta disponibilidade para todos os dados das congregações e itinerários.',
      icon: Zap,
      color: 'bg-amber-50 text-amber-600',
      borderColor: 'border-amber-100'
    },
    {
      title: 'Servidor e Hospedagem',
      description: 'Infraestrutura em nuvem para garantir que a plataforma esteja online 24/7 com performance estável.',
      icon: ShieldCheck,
      color: 'bg-emerald-50 text-emerald-600',
      borderColor: 'border-emerald-100'
    },
    {
      title: 'Segurança e LGPD',
      description: 'Certificados SSL, criptografia de dados e sistemas de proteção para garantir a privacidade das informações.',
      icon: ShieldCheck,
      color: 'bg-violet-50 text-violet-600',
      borderColor: 'border-violet-100'
    }
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto"
    >
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button 
          onClick={onBack}
          className="p-3 bg-white hover:bg-gray-50 rounded-2xl shadow-sm text-gray-600 transition-all active:scale-95"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight uppercase">Apoio ao Projeto</h1>
          <p className="text-gray-500 font-medium">Contribua para a manutenção do ProgCir</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Main Content Card */}
        <div className="space-y-6">
          <div className="bg-white rounded-[2.5rem] p-8 md:p-10 shadow-xl shadow-violet-100/50 border border-violet-50 relative overflow-hidden">
            <div className="relative z-10 space-y-8">
              <div className="space-y-4">
                <h2 className="text-3xl font-black text-gray-900 leading-tight">
                  Infraestrutura <span className="text-violet-600">Necessária</span>
                </h2>
                <p className="text-gray-600 leading-relaxed">
                  Para manter o ProgCir funcionando com excelência e segurança para todos os usuários, dependemos de uma estrutura técnica robusta que demanda investimentos mensais.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {technicalNeeds.map((need, index) => (
                  <div key={index} className={`p-5 bg-white rounded-3xl border ${need.borderColor} shadow-sm space-y-3`}>
                    <div className={`w-12 h-12 ${need.color} rounded-2xl flex items-center justify-center flex-shrink-0`}>
                      <need.icon size={24} />
                    </div>
                    <div>
                      <h4 className="font-black text-gray-900 text-sm uppercase tracking-tight">{need.title}</h4>
                      <p className="text-xs text-gray-500 leading-relaxed mt-1">{need.description}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-col md:flex-row gap-6">
                <div className="flex-1 p-6 bg-gray-900 rounded-[2rem] text-white space-y-4 shadow-xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-black uppercase tracking-wider">Apoio via PIX</h3>
                      <p className="text-xs text-gray-400">Qualquer valor contribui para estas necessidades técnicas.</p>
                    </div>
                    <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center">
                      <Zap className="text-violet-400" />
                    </div>
                  </div>

                  <div className="bg-white/5 backdrop-blur-md rounded-2xl p-4 flex items-center justify-between gap-4 border border-white/10">
                    <code className="text-sm md:text-base font-mono font-bold text-violet-200 break-all">
                      {displayKey}
                    </code>
                    <button 
                      onClick={handleCopy}
                      className={`flex-shrink-0 p-3 rounded-xl transition-all ${
                        copied ? 'bg-emerald-500 text-white' : 'bg-white text-gray-900 hover:bg-gray-100'
                      }`}
                    >
                      {copied ? <Check size={20} /> : <Copy size={20} />}
                    </button>
                  </div>
                </div>

                <div className="md:w-48 bg-white border-2 border-dashed border-gray-200 rounded-[2rem] flex flex-col items-center justify-center p-6 space-y-3 group hover:border-violet-300 transition-colors">
                  <div className="w-32 h-32 bg-gray-50 rounded-2xl flex items-center justify-center group-hover:bg-violet-50 transition-colors p-3 overflow-hidden">
                    {pixPayload ? (
                      <QRCodeSVG 
                        value={pixPayload} 
                        size={112} 
                        level="M"
                        includeMargin={false}
                        className="w-full h-full"
                      />
                    ) : (
                      <QrIcon size={48} className="text-gray-300 group-hover:text-violet-400 transition-colors" />
                    )}
                  </div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Escaneie o<br/>QR Code PIX</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
