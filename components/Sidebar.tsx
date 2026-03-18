'use client';
// Force rebuild
import { useState, useRef, useEffect } from 'react';
import { LayoutDashboard, School, Calendar, Layers, Settings, LogOut, Square, ChevronLeft, ChevronRight, HelpCircle, UserCheck, User } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Link from 'next/link';

const navItems = [
  { icon: LayoutDashboard, label: 'Circuito', view: 'dashboard' },
  { icon: School, label: 'Escolas', view: 'schools' },
  { icon: Calendar, label: 'Eventos', view: 'events' },
  { icon: UserCheck, label: 'Substitutos', view: 'substitutes' },
  { icon: Layers, label: 'Diversos', view: 'misc' },
  { icon: Settings, label: 'Ajustes', view: 'settings' },
];

interface SidebarProps {
  onLogout: () => void;
  user: any;
  personalData: any;
  currentView: string;
  onBack: () => void;
  onViewChange: (view: any) => void;
}

export default function Sidebar({ onLogout, user, personalData, currentView, onBack, onViewChange }: SidebarProps) {
  const navRef = useRef<HTMLElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Determine if an item is active. For now, 'Circuito' is active for dashboard, congregations, and personal_data
  const isActive = (itemView: string) => {
    if (itemView === 'dashboard') {
      return ['dashboard', 'congregations', 'personal_data'].includes(currentView);
    }
    return currentView === itemView;
  };

  const checkScroll = () => {
    if (navRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = navRef.current;
      setCanScrollLeft(scrollLeft > 5);
      setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 5);
    }
  };

  useEffect(() => {
    const nav = navRef.current;
    if (nav) {
      nav.addEventListener('scroll', checkScroll);
      // Initial check
      checkScroll();
      // Check on resize
      window.addEventListener('resize', checkScroll);
    }
    return () => {
      if (nav) nav.removeEventListener('scroll', checkScroll);
      window.removeEventListener('resize', checkScroll);
    };
  }, []);

  const scroll = (direction: 'left' | 'right') => {
    if (navRef.current) {
      const scrollAmount = 150;
      navRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  return (
    <aside className="
      fixed z-50 bg-[#512da8] text-white transition-all duration-500 ease-in-out
      portrait:bottom-0 portrait:left-0 portrait:right-0 portrait:h-16 portrait:flex-row portrait:w-full
      landscape:top-0 landscape:left-0 landscape:bottom-0 landscape:w-20 landscape:lg:w-64 landscape:flex-col
      flex overflow-y-auto landscape:custom-scrollbar
    ">
      {/* Logo Section */}
      <div className="p-4 lg:p-6 landscape:block portrait:hidden">
        <div className="flex items-center gap-3 mb-2 lg:mb-8">
          <div className="bg-white w-8 h-8 lg:w-10 lg:h-10 rounded flex items-center justify-center flex-shrink-0">
            <Square className="text-[#512da8] fill-[#512da8]" size={20} />
          </div>
          <p className="text-[10px] lg:text-sm text-white font-extrabold uppercase tracking-widest hidden lg:block">PROGCIR WEB</p>
        </div>
      </div>

      {/* Navigation Items */}
      <div className="relative flex-1 flex items-center overflow-hidden">
        {/* Left Scroll Arrow (Portrait only) */}
        <AnimatePresence>
          {canScrollLeft && (
            <motion.button
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              onClick={() => scroll('left')}
              className="landscape:hidden absolute left-0 z-10 h-full px-1 bg-gradient-to-r from-[#512da8] to-transparent text-white/80"
            >
              <ChevronLeft size={20} />
            </motion.button>
          )}
        </AnimatePresence>

        <nav 
          ref={navRef}
          className="
            flex-1 px-2 lg:px-4 
            landscape:space-y-1 lg:landscape:space-y-2 landscape:py-2 lg:landscape:py-0
            portrait:flex portrait:flex-row portrait:items-center portrait:px-2 portrait:space-y-0
            portrait:overflow-x-auto portrait:scrollbar-hide portrait:gap-1
          "
        >
          {navItems.map((item) => (
            <Link
              key={item.label}
              href="#"
              onClick={(e) => {
                e.preventDefault();
                onViewChange(item.view);
              }}
              className={`
                flex items-center rounded-xl transition-all group
                landscape:justify-center lg:landscape:justify-start
                landscape:gap-3 landscape:px-2 lg:landscape:px-4 landscape:py-3 landscape:font-bold
                portrait:flex-col portrait:justify-center portrait:p-2 portrait:min-w-[60px]
                ${isActive(item.view) ? 'bg-[#673ab7] text-white' : 'text-white/70 hover:text-white hover:bg-white/10'}
              `}
            >
              <item.icon size={20} className="flex-shrink-0" />
              <span className="font-sans hidden lg:landscape:block text-[10px] landscape:text-base">
                {item.label}
              </span>
              <span className="portrait:block landscape:hidden text-[9px] font-bold mt-1 truncate w-full text-center">
                {item.label}
              </span>
            </Link>
          ))}

          {/* Logout item for Portrait (inside scroll) */}
          <button
            onClick={onLogout}
            className="
              portrait:flex landscape:hidden flex-col items-center justify-center p-2 min-w-[60px] rounded-xl transition-all
              text-white/70 hover:text-white hover:bg-white/10
            "
          >
            <LogOut size={20} className="flex-shrink-0" />
            <span className="text-[9px] font-bold mt-1 truncate w-full text-center">
              Sair
            </span>
          </button>
        </nav>

        {/* Right Scroll Arrow (Portrait only) */}
        <AnimatePresence>
          {canScrollRight && (
            <motion.button
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              onClick={() => scroll('right')}
              className="landscape:hidden absolute right-0 z-10 h-full px-1 bg-gradient-to-l from-[#512da8] to-transparent text-white/80"
            >
              <ChevronRight size={20} />
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Support Section - Replacing Documentation with Logout */}
      <div className="mt-auto landscape:flex portrait:hidden flex-col">
        {currentView !== 'dashboard' && (
          <div className="px-4 lg:px-6 mb-4">
            <button 
              onClick={onBack}
              className="w-full border border-white/20 p-2 flex items-center justify-center lg:justify-start gap-2 transition-colors group hover:bg-white/10 text-xs font-bold rounded-lg"
            >
              <ChevronLeft size={16} />
              <span className="hidden lg:block">Voltar ao Painel</span>
            </button>
          </div>
        )}

        <div className="bg-[#4527a0] p-4 lg:p-6 border-t border-white/10">
          <div className="hidden lg:block mb-4">
            <p className="text-[10px] font-bold text-white/40 uppercase tracking-wider mb-2">VIAJANTE</p>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center text-white">
                <User size={16} />
              </div>
              <div className="overflow-hidden">
                <p className="text-sm font-bold text-white truncate">
                  {user?.usuario}
                </p>
                {user?.usuario === '2283701' && (
                  <p className="text-[9px] font-bold text-amber-400 uppercase tracking-tighter">Administrador</p>
                )}
              </div>
            </div>
          </div>
          
          <button 
            onClick={onLogout}
            className="flex items-center justify-center lg:justify-start gap-3 text-white hover:text-white/80 transition-colors w-full group"
          >
            <div className="w-8 h-8 flex items-center justify-center">
              <LogOut size={20} />
            </div>
            <span className="font-bold text-sm hidden lg:block">Sair do Sistema</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
