'use client';

interface LogoProps {
  className?: string;
  iconSize?: number;
  textSize?: string;
  showText?: boolean;
  textColor?: string;
  outlineColor?: string;
}

export default function Logo({ 
  className = '', 
  iconSize = 32, 
  textSize = 'text-2xl', 
  showText = true,
  textColor = '#FFFFFF',
  outlineColor = '#FFFFFF'
}: LogoProps) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Brand Icon - Using the new ProgCir_Ico.svg */}
      <div 
        className="relative flex-shrink-0 flex items-center justify-center" 
        style={{ width: iconSize, height: iconSize }}
      >
        <img 
          src="/ProgCir_Ico.svg" 
          alt="ProgCir Logo"
          className="w-full h-full object-contain drop-shadow-md"
        />
      </div>

      {/* Text Component with the specific Prog/Cir/Web style */}
      {showText && (
        <div className="flex flex-col leading-none select-none">
          <div className={`flex items-center font-bold tracking-tight ${textSize} font-sans`}>
            <span style={{ color: textColor }}>Prog</span>
            <span 
              className="ml-[1px]" 
              style={{ 
                WebkitTextStroke: `1.2px ${outlineColor}`, 
                color: 'transparent',
                opacity: 0.95
              }}
            >
              Cir
            </span>
            <span className="ml-1.5" style={{ color: textColor }}>Web</span>
          </div>
          <div 
            className="text-[#C084FC] font-black text-[10px] uppercase tracking-[0.2em] mt-0.5"
            style={{ filter: 'drop-shadow(0 0 8px rgba(192, 132, 252, 0.3))' }}
          >
            Web Interface
          </div>
        </div>
      )}
    </div>
  );
}
