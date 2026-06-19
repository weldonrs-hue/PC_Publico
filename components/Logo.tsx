'use client';

interface LogoProps {
  className?: string;
  iconSize?: number | string;
  textSize?: string;
  showText?: boolean;
  forceShowText?: boolean;
  textColor?: string;
  outlineColor?: string;
}

export default function Logo({ 
  className = '', 
  iconSize = 32, 
  textSize = 'text-2xl', 
  showText = true,
  forceShowText = false,
  textColor = '#FFFFFF',
  outlineColor = '#FFFFFF'
}: LogoProps) {
  // Determine if iconSize is a number or a class string
  const iconSizingClass = typeof iconSize === 'string' ? iconSize : '';
  const iconInlineStyle = typeof iconSize === 'number' ? { width: iconSize, height: iconSize } : {};

  return (
    <div className={`inline-flex items-center gap-1.5 md:gap-2.5 ${className}`}>
      {/* Brand Icon - Using the new ProgCir_Ico.svg */}
      <div 
        className={`relative flex-shrink-0 flex items-center justify-center transition-all duration-300 ${iconSizingClass}`} 
        style={iconInlineStyle}
      >
        <img 
          src="/ProgCir_Ico.svg" 
          alt="ProgCir Logo"
          className="w-full h-full object-contain drop-shadow-sm group-hover:scale-110 transition-transform"
        />
      </div>

      {/* Text Component with the specific Prog/Cir/Web style */}
      {showText && (
        <div className={`${forceShowText ? 'flex' : 'hidden lg:flex'} flex-col leading-none select-none overflow-visible whitespace-nowrap antialiased`}>
          <div className={`flex items-baseline font-black tracking-tight ${textSize} font-sans`}>
            <span style={{ color: textColor }}>Prog</span>
            <span 
              className="ml-[0.5px]" 
              style={{ 
                WebkitTextStroke: `calc(1px + 0.02em) ${outlineColor}`, 
                color: 'transparent',
                opacity: 0.95,
                paintOrder: 'stroke fill'
              }}
            >
              Cir
            </span>
          </div>
          <div 
            className={`${forceShowText ? 'block' : 'hidden lg:block'} text-[#C084FC] font-black text-[7px] md:text-[8px] uppercase tracking-[0.2em] md:tracking-[0.25em] -mt-0.5 opacity-90`}
          >
            Web Interface
          </div>
        </div>
      )}
    </div>
  );
}
