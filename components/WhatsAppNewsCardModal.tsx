'use client';

import React, { useRef, useState, useEffect } from 'react';
import { 
  X, 
  Download, 
  Copy, 
  Check, 
  Share2, 
  Sparkles, 
  MessageCircle,
  FileSpreadsheet,
  SlidersHorizontal,
  MonitorSmartphone,
  Zap,
  ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface WhatsAppNewsCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  customTitle?: string;
  customContent?: string;
  version?: string;
}

export default function WhatsAppNewsCardModal({
  isOpen,
  onClose,
  customTitle,
  customContent,
  version = 'v2.0'
}: WhatsAppNewsCardModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Default highlights reflecting the latest app enhancements
  const highlights = [
    {
      title: 'Novos Temas Visuais',
      desc: 'Personalize o app com diferentes temas modernos, confortáveis e elegantes.',
      tag: 'Novo'
    },
    {
      title: 'Área de Eventos & Tarefas',
      desc: 'Organização completa dos eventos, reuniões e tarefas com datas e responsáveis.',
      tag: 'Novo'
    },
    {
      title: 'Recibo de Despesas Flexível',
      desc: 'Opção para Semana Livre, Congresso, Escolas, Assembleias e Reuniões Especiais.',
      tag: 'Melhoria'
    },
    {
      title: 'Visualização Inteligente',
      desc: 'Inicia em Tabela / Folha A4 no computador e Lista ágil no celular.',
      tag: 'Design'
    }
  ];

  const headline = customTitle || 'Novidades & Atualizações no ProgCir';
  
  // Formatted WhatsApp text ready to copy or send
  const whatsappMessage = `📢 *NOVIDADES NO PROGCIR (${version})* ✨

Olá irmãos! O aplicativo de gestão do circuito foi atualizado com novos recursos incríveis:

🎨 *1. Novos Temas para o App:*
Personalize o visual do sistema escolhendo entre diferentes temas modernos, com ótima legibilidade para o dia ou para a noite.

📅 *2. Área de Eventos & Tarefas:*
Espaço exclusivo para gerenciar o calendário do circuito, programações, pendências e tarefas com responsáveis e datas.

📋 *3. Recibo de Despesas Flexível:*
Agora com opções completas para congregação, Semana Livre, Congresso, Escolas, Assembleias e Reuniões Especiais.

💻📱 *4. Visualização Inteligente:*
No computador, abre direto no modo *Tabela / Folha A4* para impressão. No celular, abre em *Lista / Cards* para uso rápido no bolso.

👉 *Acesse pelo link oficial:* https://prog-cir-web.vercel.app/`;

  // Draw high-resolution 1200x1200 canvas
  const drawCardOnCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = 1200;
    const height = 1200;
    canvas.width = width;
    canvas.height = height;

    // Background Gradient (Deep modern navy / royal blue)
    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, '#0F172A'); // Slate 900
    bgGrad.addColorStop(0.4, '#1E1B4B'); // Indigo 950
    bgGrad.addColorStop(1, '#090D16'); // Dark slate
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Decorative Glowing Orbs
    const drawGlow = (x: number, y: number, radius: number, color: string) => {
      const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
      grad.addColorStop(0, color);
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    };

    drawGlow(200, 180, 350, 'rgba(99, 102, 241, 0.25)'); // Indigo glow
    drawGlow(1050, 250, 400, 'rgba(168, 85, 247, 0.2)'); // Purple glow
    drawGlow(950, 1050, 380, 'rgba(14, 165, 233, 0.2)'); // Sky glow
    drawGlow(150, 1050, 320, 'rgba(16, 185, 129, 0.15)'); // Emerald glow

    // Subtle Grid pattern
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1;
    for (let x = 60; x < width; x += 60) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 60; y < height; y += 60) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Top Card Glass container
    const drawRoundedRect = (x: number, y: number, w: number, h: number, r: number) => {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
    };

    // Header Badge: "PROGCIR • ATUALIZAÇÃO DO SISTEMA"
    drawRoundedRect(80, 80, 480, 56, 28);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Dot in badge
    ctx.beginPath();
    ctx.arc(115, 108, 7, 0, Math.PI * 2);
    ctx.fillStyle = '#38BDF8'; // Sky 400
    ctx.fill();

    // Text in badge
    ctx.fillStyle = '#E2E8F0';
    ctx.font = 'bold 22px system-ui, -apple-system, sans-serif';
    ctx.fillText('PROGCIR WEB • NOVIDADES', 140, 116);

    // Version pill on right
    drawRoundedRect(1000, 80, 120, 56, 28);
    ctx.fillStyle = 'rgba(99, 102, 241, 0.25)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(129, 140, 248, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#C7D2FE';
    ctx.font = 'bold 22px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(version, 1060, 116);
    ctx.textAlign = 'left';

    // Main Title
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 58px system-ui, -apple-system, sans-serif';
    ctx.fillText('O que há de novo no sistema?', 80, 210);

    // Subtitle
    ctx.fillStyle = '#94A3B8';
    ctx.font = '500 28px system-ui, -apple-system, sans-serif';
    ctx.fillText('Confira as melhorias mais recentes preparadas para você:', 80, 260);

    // Feature Cards (4 boxes)
    const cardData = [
      {
        icon: '🎨',
        title: 'Novos Temas para o App',
        tag: 'NOVO',
        tagBg: '#7C3AED',
        desc: 'Personalização visual com temas modernos adaptados para cada preferência e iluminação.',
        borderColor: 'rgba(168, 85, 247, 0.35)',
        accentColor: '#C084FC'
      },
      {
        icon: '📅',
        title: 'Área de Eventos & Tarefas',
        tag: 'NOVO',
        tagBg: '#0284C7',
        desc: 'Gestão completa do calendário, eventos do circuito e tarefas com responsáveis.',
        borderColor: 'rgba(14, 165, 233, 0.35)',
        accentColor: '#38BDF8'
      },
      {
        icon: '📋',
        title: 'Recibo de Despesas Flexível',
        tag: 'MELHORIA',
        tagBg: '#059669',
        desc: 'Opção para Semana Livre, Congresso, Escolas, Assembleias e Reuniões Especiais.',
        borderColor: 'rgba(16, 185, 129, 0.35)',
        accentColor: '#34D399'
      },
      {
        icon: '💻',
        title: 'Visualização Inteligente',
        tag: 'DESIGN',
        tagBg: '#EA580C',
        desc: 'No computador abre em Tabela / Folha A4; no celular prioriza Lista prática.',
        borderColor: 'rgba(249, 115, 22, 0.35)',
        accentColor: '#FB923C'
      }
    ];

    let currentY = 320;
    cardData.forEach((item) => {
      const cardHeight = 160;

      // Card Background (Glass effect)
      drawRoundedRect(80, currentY, 1040, cardHeight, 24);
      ctx.fillStyle = 'rgba(30, 41, 59, 0.65)';
      ctx.fill();
      ctx.strokeStyle = item.borderColor;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Icon bubble
      drawRoundedRect(110, currentY + 35, 90, 90, 20);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.font = '46px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(item.icon, 155, currentY + 97);
      ctx.textAlign = 'left';

      // Card Title
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 34px system-ui, -apple-system, sans-serif';
      ctx.fillText(item.title, 230, currentY + 65);

      // Tag Pill next to title
      const titleWidth = ctx.measureText(item.title).width;
      const tagX = 230 + titleWidth + 24;
      if (tagX < 950) {
        drawRoundedRect(tagX, currentY + 38, 120, 34, 17);
        ctx.fillStyle = item.tagBg;
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 16px system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(item.tag, tagX + 60, currentY + 61);
        ctx.textAlign = 'left';
      }

      // Card Description
      ctx.fillStyle = '#CBD5E1';
      ctx.font = '400 24px system-ui, -apple-system, sans-serif';
      
      // Simple word wrapping for description
      const maxWidth = 800;
      const words = item.desc.split(' ');
      let line = '';
      let descY = currentY + 112;

      for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + ' ';
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && n > 0) {
          ctx.fillText(line, 230, descY);
          line = words[n] + ' ';
          descY += 30;
        } else {
          line = testLine;
        }
      }
      ctx.fillText(line, 230, descY);

      currentY += cardHeight + 28;
    });

    // Bottom Footer Banner
    drawRoundedRect(80, 1080, 1040, 70, 20);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#94A3B8';
    ctx.font = '500 22px system-ui, -apple-system, sans-serif';
    ctx.fillText('Acesse pelo seu navegador em computador, tablet ou celular:', 110, 1124);

    ctx.fillStyle = '#38BDF8';
    ctx.font = 'bold 24px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('prog-cir-web.vercel.app 🌐', 1090, 1124);
    ctx.textAlign = 'left';
  };

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        drawCardOnCanvas();
      }, 100);
    }
  }, [isOpen]);

  const handleDownloadImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setIsGenerating(true);
    try {
      const link = document.createElement('a');
      link.download = `progcir-novidades-${version}.png`;
      link.href = canvas.toDataURL('image/png', 1.0);
      link.click();
    } catch (err) {
      console.error('Erro ao baixar imagem:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(whatsappMessage);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      console.error('Erro ao copiar texto:', err);
    }
  };

  const handleShareWhatsApp = () => {
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(whatsappMessage)}`;
    window.open(url, '_blank');
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-[10000] flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md overflow-y-auto"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          className="bg-slate-900 text-white rounded-3xl shadow-2xl max-w-4xl w-full flex flex-col max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-3rem)] overflow-hidden border border-slate-800 my-auto relative"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-slate-900 border-b border-slate-800 p-4 sm:p-5 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
                <MessageCircle size={22} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-black tracking-tight text-white leading-none">
                    Divulgar Novidades no WhatsApp
                  </h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Card HD
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 font-medium mt-1">
                  Baixe a imagem quadrada pronta para o grupo e copie a mensagem formatada
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-white cursor-pointer active:scale-95"
            >
              <X size={20} />
            </button>
          </div>

          {/* Main Body */}
          <div className="overflow-y-auto custom-scrollbar flex-1 p-4 sm:p-6 space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* Preview Card (Left / Center) */}
              <div className="lg:col-span-7 flex flex-col items-center">
                <div className="w-full flex items-center justify-between mb-2 px-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Sparkles size={13} className="text-amber-400" />
                    Prévia da Imagem (1:1 Quadrada)
                  </span>
                  <span className="text-[10px] text-slate-500 font-medium">
                    1200 x 1200 px (Alta Resolução)
                  </span>
                </div>

                {/* Canvas container with frame */}
                <div className="w-full max-w-[420px] aspect-square rounded-2xl overflow-hidden border border-slate-700/80 shadow-2xl bg-slate-950 relative group">
                  <canvas 
                    ref={canvasRef} 
                    className="w-full h-full object-contain block"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                    <span className="bg-slate-900/90 text-white text-xs font-bold px-3 py-1.5 rounded-xl border border-slate-700 shadow-lg">
                      Pronto para Download
                    </span>
                  </div>
                </div>

                <p className="text-[11px] text-slate-400 text-center mt-2">
                  Formato quadrado perfeito para o feed e fotos de perfil de grupos do WhatsApp.
                </p>
              </div>

              {/* Action Buttons & Text Preview (Right) */}
              <div className="lg:col-span-5 flex flex-col space-y-4">
                
                {/* 1. Download Image Action */}
                <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center gap-2 text-white font-bold text-sm">
                    <Download size={18} className="text-emerald-400" />
                    <span>Passo 1: Baixar a Imagem</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Clique abaixo para salvar a imagem no seu computador ou celular para anexar no WhatsApp.
                  </p>
                  <button
                    onClick={handleDownloadImage}
                    disabled={isGenerating}
                    className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Download size={16} strokeWidth={2.5} />
                    <span>Baixar Imagem PNG (1200x1200)</span>
                  </button>
                </div>

                {/* 2. Copy Message Action */}
                <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-white font-bold text-sm">
                      <Copy size={18} className="text-sky-400" />
                      <span>Passo 2: Mensagem para o Grupo</span>
                    </div>
                    {copied && (
                      <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                        <Check size={12} strokeWidth={3} />
                        Copiado!
                      </span>
                    )}
                  </div>

                  <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 text-[11px] text-slate-300 font-mono leading-relaxed max-h-36 overflow-y-auto custom-scrollbar whitespace-pre-wrap select-all">
                    {whatsappMessage}
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      onClick={handleCopyText}
                      className="py-2.5 px-3 bg-slate-700 hover:bg-slate-600 active:scale-98 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                      <span>{copied ? 'Copiado!' : 'Copiar Texto'}</span>
                    </button>

                    <button
                      onClick={handleShareWhatsApp}
                      className="py-2.5 px-3 bg-[#25D366] hover:bg-[#20ba59] active:scale-98 text-slate-950 font-black text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Share2 size={14} strokeWidth={2.5} />
                      <span>Abrir WhatsApp</span>
                    </button>
                  </div>
                </div>

                {/* Instructions tip */}
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3.5 flex items-start gap-3">
                  <div className="p-1.5 bg-amber-500/20 rounded-lg text-amber-300 shrink-0 mt-0.5">
                    <Sparkles size={15} />
                  </div>
                  <div className="text-[11px] text-amber-200/90 leading-relaxed">
                    <strong className="text-amber-100 font-bold block mb-0.5">Dica de envio:</strong>
                    Abra o WhatsApp do grupo, envie a imagem baixada e, na legenda da foto, cole o texto copiado. Fica perfeito e muito profissional!
                  </div>
                </div>

              </div>

            </div>
          </div>

          {/* Footer */}
          <div className="p-3.5 sm:p-4 bg-slate-900 border-t border-slate-800 flex items-center justify-end gap-2.5 shrink-0">
            <button
              onClick={onClose}
              className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer"
            >
              Fechar
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
