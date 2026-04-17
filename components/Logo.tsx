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
      {/* Refined Circuit/Tech Icon */}
      <div 
        className="relative flex-shrink-0" 
        style={{ width: iconSize, height: iconSize }}
      >
        <svg
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full drop-shadow-md"
        >
          {/* Main Circuit Hexagon/Shape */}
          <path
            d="M50 5L90 25V75L50 95L10 75V25L50 5Z"
            fill="#C0A9E2"
            fillOpacity="0.8"
          />
          {/* Internal Circuit Path */}
          <path
            d="M30 35H70M30 50H70M30 65H55"
            stroke="#4C1D95"
            strokeWidth="6"
            strokeLinecap="round"
          />
          {/* Tech Nodes/Dots */}
          <circle cx="70" cy="65" r="8" fill="#9C7FC7" />
          <circle cx="30" cy="35" r="4" fill="white" />
          <circle cx="70" cy="50" r="4" fill="white" />
        </svg>
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
