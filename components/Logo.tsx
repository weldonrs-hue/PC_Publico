'use client';

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
  monochrome = false,
}: LogoProps) {
  // Determine if iconSize is a number or a class string
  const iconSizingClass = typeof iconSize === 'string' ? iconSize : '';
  const iconInlineStyle = typeof iconSize === 'number' ? { width: iconSize, height: iconSize } : {};

  return (
    <div className={`inline-flex items-center gap-1.5 md:gap-2.5 ${className}`}>
      {/* Brand Icon Badge - Clean, balanced, modern */}
      <div 
        className={`relative flex-shrink-0 flex items-center justify-center rounded-xl p-1.5 transition-all duration-200 ${
          monochrome 
            ? 'bg-white/10 shadow-2xs border border-white/15' 
            : 'bg-surface-200/80 shadow-2xs'
        } ${iconSizingClass}`} 
        style={iconInlineStyle}
      >
        <img 
          src="/ProgCir_Ico.svg" 
          alt="ProgCir Logo"
          className={`w-full h-full object-contain transition-transform group-hover:scale-105 ${
            monochrome 
              ? 'brightness-0 invert opacity-95' 
              : ''
          }`}
        />
      </div>

      {/* Clean Text Typography */}
      {showText && (
        <div className={`${forceShowText ? 'flex' : 'hidden lg:flex'} flex-col leading-tight select-none overflow-visible whitespace-nowrap antialiased`}>
          <div className={`flex items-baseline tracking-tight ${textSize} font-sans`}>
            <span className="font-extrabold text-white">Prog</span>
            <span className="font-light text-white/90 ml-[1px]">Cir</span>
          </div>
          <div 
            className={`${forceShowText ? 'block' : 'hidden lg:block'} text-white/70 font-semibold text-[8px] uppercase tracking-wider -mt-0.5`}
          >
            Gestão do Circuito
          </div>
        </div>
      )}
    </div>
  );
}
