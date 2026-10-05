'use client';

import { useTheme } from '@/context/ThemeContext';

interface LogoProps {
  className?: string;
  iconSize?: number | string;
  textSize?: string;
  showText?: boolean;
  forceShowText?: boolean;
  textColor?: string;
  outlineColor?: string;
  monochrome?: boolean;
}

export default function Logo({ 
  className = '', 
  iconSize = 32, 
  textSize = 'text-2xl', 
  showText = true,
  forceShowText = false,
  textColor,
  outlineColor,
  monochrome,
}: LogoProps) {
  const { theme } = useTheme();

  // Se monochrome for passado explicitamente, respeita a prop.
  // Caso contrário, decide automaticamente com base no tema ativo:
  // - Tema Roxo (padrão '') e Tema Escuro ('theme-dark') exibem a logo original colorida.
  // - Demais temas ('theme-teal' e 'theme-blue') exibem a versão monocromática elegante.
  const isMonochrome = typeof monochrome === 'boolean'
    ? monochrome
    : (theme === 'theme-teal' || theme === 'theme-blue');

  // Determine if iconSize is a number or a class string
  const iconSizingClass = typeof iconSize === 'string' ? iconSize : '';
  const iconInlineStyle = typeof iconSize === 'number' ? { width: iconSize, height: iconSize } : {};

  return (
    <div className={`inline-flex items-center gap-1.5 md:gap-2.5 ${className}`}>
      {/* Brand Icon Badge - Clean, balanced, modern */}
      <div 
        className={`relative flex-shrink-0 flex items-center justify-center rounded-xl p-1.5 transition-all duration-300 ${
          isMonochrome 
            ? 'bg-white/10 shadow-2xs border border-white/15' 
            : 'bg-white/15 shadow-2xs border border-white/20 backdrop-blur-xs'
        } ${iconSizingClass}`} 
        style={iconInlineStyle}
      >
        <img 
          src="/ProgCir_Ico.svg" 
          alt="ProgCir Logo"
          className={`w-full h-full object-contain transition-all duration-300 group-hover:scale-105 ${
            isMonochrome 
              ? 'brightness-0 invert opacity-95' 
              : 'drop-shadow-xs'
          }`}
        />
      </div>

      {/* Clean Text Typography */}
      {showText && (
        <div className={`${forceShowText ? 'flex' : 'hidden lg:flex'} flex-col leading-tight select-none overflow-visible whitespace-nowrap antialiased`}>
          <div className={`flex items-baseline tracking-tight ${textSize} font-sans`}>
            <span 
              className="font-extrabold"
              style={textColor ? { color: textColor } : { color: '#ffffff' }}
            >
              Prog
            </span>
            <span 
              className="font-light ml-[1px]"
              style={textColor ? { color: textColor, opacity: 0.9 } : { color: 'rgba(255, 255, 255, 0.9)' }}
            >
              Cir
            </span>
          </div>
          <div 
            className={`${forceShowText ? 'block' : 'hidden lg:block'} font-semibold text-[8px] uppercase tracking-wider -mt-0.5`}
            style={textColor ? { color: textColor, opacity: 0.7 } : { color: 'rgba(255, 255, 255, 0.7)' }}
          >
            Gestão do Circuito
          </div>
        </div>
      )}
    </div>
  );
}
