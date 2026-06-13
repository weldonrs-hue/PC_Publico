'use client';
// Force rebuild - updated
import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { LayoutDashboard, GraduationCap, Calendar, Shapes, Settings, LogOut, Square, ChevronLeft, ChevronRight, HelpCircle, UserCheck, User, Map, Camera, ClipboardList, Mail, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Link from 'next/link';
import ImageCropper from './ImageCropper';
import { db } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '@/utils/firestore';

const navItems = [
  { icon: LayoutDashboard, label: 'Circuito', view: 'dashboard' },
  { icon: GraduationCap, label: 'Escolas', view: 'schools' },
  { icon: Calendar, label: 'Eventos', view: 'events' },
  { icon: Mail, label: 'Cartas', view: 'cartas' },
  { icon: Shapes, label: 'Diversos', view: 'misc' },
  { icon: MessageSquare, label: 'Chat', view: 'chat' },
  { icon: Settings, label: 'Ajustes', view: 'settings' },
];

interface SidebarProps {
  onLogout: () => void;
  user: any;
  personalData: any;
  currentView: string;
  espInitialMode?: 'geracao' | 'manager';
  onBack: () => void;
  onViewChange: (view: any) => void;
  hasGuestInvites?: boolean;
  onToggleChat?: () => void;
  isChatOpen?: boolean;
  chatEnabled?: boolean;
}

import Logo from './Logo';

export default function Sidebar({ 
  onLogout, 
  user, 
  personalData, 
  currentView, 
  espInitialMode, 
  onBack, 
  onViewChange,
  hasGuestInvites = false,
  onToggleChat,
  isChatOpen = false,
  chatEnabled = false
}: SidebarProps) {
  const navRef = useRef<HTMLElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [totalUnreadChatCount, setTotalUnreadChatCount] = useState(0);

  // Listen for unread notification updates
  useEffect(() => {
    const handleUnreadUpdate = (e: any) => {
      setTotalUnreadChatCount(e.detail.count || 0);
    };
    window.addEventListener('chat_unread_update', handleUnreadUpdate);
    return () => window.removeEventListener('chat_unread_update', handleUnreadUpdate);
  }, []);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        setImageToCrop(reader.result as string);
      });
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const handleCropComplete = async (croppedImage: string) => {
    if (!user?.id) return;
    
    setIsUploading(true);
    try {
      const userDocRef = doc(db, 'users', user.id);
      await updateDoc(userDocRef, {
        photoURL: croppedImage
      });
      setImageToCrop(null);
    } catch (error) {
      console.error('Error updating profile photo:', error);
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.id}`);
    } finally {
      setIsUploading(false);
    }
  };

  // Determine if an item is active. For now, 'Circuito' is active for dashboard, congregations, and personal_data
  const isActive = (itemView: string) => {
    // Exact match takes precedence
    if (currentView === itemView) return true;

    if (itemView === 'dashboard') {
      const dashboardViews = ['dashboard', 'congregations', 'personal_data', 'substitutes', 'itineraries', 'statistics', 'aviso_de_visitas'];
      return dashboardViews.includes(currentView);
    }
    if (itemView === 'schools') {
      return ['schools', 'pioneer_school'].includes(currentView) || currentView.startsWith('pioneer_school_guest');
    }
    if (itemView === 'events') {
      return ['events', 'regional_convention_program'].includes(currentView);
    }
    if (itemView === 'misc') {
      const miscViews = ['misc', 'field_service_report', 'file_viewer'];
      return miscViews.includes(currentView);
    }
    if (itemView === 'cartas') {
      const cartasViews = ['cartas', 'cartas_esp', 'cartas_dashboard', 'cartas_emr', 'cartas_congresso', 'cartas_assembleias', 'cartas_programacoes'];
      return cartasViews.includes(currentView);
    }
    return false;
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

  const isAdminUser = user?.role === 'admin' || user?.usuario === '2283701' || user?.email === 'weldonrs@gmail.com';
  
  const menuItems = navItems.filter(item => {
    const role = personalData?.role || 'viajante';
    if (role === 'pioneiro_especial' || role === 'pioneiro_regular') {
      // Forbidden modules for pioneers
      if (['events', 'cartas'].includes(item.view)) return false;
      
      // Schools only if they have guest invites
      if (item.view === 'schools') return hasGuestInvites;
    }
    
    if (item.view === 'chat' && !chatEnabled && !isAdminUser) return false;
    
    return true;
  });

  return (
    <aside className="
      fixed z-[1001] bg-gradient-to-b from-[#2E1065] via-[#4C1D95] to-[#5B21B6] text-white transition-all duration-500 ease-in-out
      portrait:bottom-0 portrait:left-0 portrait:right-0 portrait:h-16 portrait:flex-row portrait:w-full
      landscape:top-0 landscape:left-0 landscape:bottom-0 landscape:w-20 landscape:sm:w-28 landscape:lg:w-64 landscape:flex-col
      flex overflow-y-auto overflow-x-hidden landscape:custom-scrollbar shadow-2xl
    ">
      {/* Logo Section */}
      <div className="p-2 lg:p-6 landscape:block portrait:hidden">
        <div className="flex items-center justify-center mb-2 lg:mb-8">
          <div className="bg-white/10 backdrop-blur-md p-1.5 lg:p-2 rounded-2xl shadow-xl w-full relative h-14 lg:h-16 flex items-center justify-center lg:justify-start lg:px-4 border border-white/20 overflow-hidden group">
            <div className="relative">
              <div className="absolute inset-0 bg-[#C084FC] blur-lg opacity-20 group-hover:opacity-40 transition-opacity rounded-full" />
              <Logo 
                iconSize="w-6 h-6 sm:w-8 sm:h-8 lg:w-10 lg:h-10" 
                textSize="text-sm sm:text-base lg:text-xl" 
                className="relative z-10 lg:gap-3" 
                showText={true} 
              />
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Items */}
      <div className="relative flex-1 flex items-center landscape:items-start overflow-hidden landscape:overflow-visible">
        {/* Left Scroll Arrow (Portrait only) */}
        <AnimatePresence>
          {canScrollLeft && (
            <motion.button
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              onClick={() => scroll('left')}
              className="landscape:hidden absolute left-0 z-10 h-full px-1 bg-gradient-to-r from-[#4C1D95] to-transparent text-white/80"
            >
              <ChevronLeft size={20} />
            </motion.button>
          )}
        </AnimatePresence>

        <nav 
          ref={navRef}
          className="
            flex-1 px-2 lg:px-4 
            landscape:flex landscape:flex-col landscape:space-y-1 lg:landscape:space-y-2 landscape:py-2 lg:landscape:py-0
            portrait:flex portrait:flex-row portrait:items-center portrait:px-2 portrait:space-y-0
            portrait:overflow-x-auto portrait:scrollbar-hide portrait:gap-1
          "
        >
          {menuItems.map((item) => {
            const isDisabled = [].includes(item.view as never);
            return (
              <Link
                key={item.label}
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  if (!isDisabled) {
                    if (item.view === 'chat' && onToggleChat) {
                      onToggleChat();
                    } else {
                      onViewChange(item.view);
                    }
                  }
                }}
                className={`
                  flex items-center rounded-xl transition-all duration-300 group relative overflow-hidden
                  landscape:justify-start
                  landscape:gap-3 landscape:px-2 lg:landscape:px-4 landscape:py-3 landscape:font-bold
                  portrait:flex-col portrait:justify-center portrait:p-2 portrait:min-w-[55px] md:portrait:min-w-[70px]
                  ${(isActive(item.view) || (item.view === 'chat' && isChatOpen))
                    ? 'bg-gradient-to-r from-white/15 to-transparent border-l-4 border-[#C084FC] text-white shadow-lg' 
                    : 'text-white/60 hover:text-white hover:bg-white/5 active:scale-95'}
                  ${isDisabled ? 'opacity-30 cursor-not-allowed grayscale' : ''}
                `}
                title={isDisabled ? 'Função em desenvolvimento' : item.label}
              >
                <item.icon size={20} className="flex-shrink-0" />
                {item.view === 'chat' && totalUnreadChatCount > 0 && !isChatOpen && (
                  <span className="absolute landscape:right-4 landscape:top-3 portrait:right-2 portrait:top-2 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-[#4C1D95] animate-pulse">
                    {totalUnreadChatCount > 99 ? '99+' : totalUnreadChatCount}
                  </span>
                )}
                <span className="font-sans landscape:block lg:block hidden text-[10px] lg:text-base">
                  {item.label}
                </span>
                <span className="portrait:block lg:hidden landscape:hidden text-[9px] font-bold mt-1 truncate w-full text-center">
                  {item.label}
                </span>
              </Link>
            );
          })}

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
              className="landscape:hidden absolute right-0 z-10 h-full px-1 bg-gradient-to-l from-[#2E1065] to-transparent text-white/80"
            >
              <ChevronRight size={20} />
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Support Section - Replacing Documentation with Logout */}
      <div className="mt-auto landscape:flex portrait:hidden flex-col">
        <div className="bg-black/20 p-4 lg:p-6 border-t border-white/5 backdrop-blur-md">
          <div className="space-y-1">
            <button 
              onClick={onLogout}
              className="flex items-center landscape:justify-start justify-center gap-3 text-white/50 hover:text-white hover:bg-red-500/10 transition-all w-full group p-2 rounded-xl group"
            >
              <div className="w-8 h-8 flex items-center justify-center bg-white/5 rounded-lg group-hover:bg-red-500/20 transition-all">
                <LogOut size={16} />
              </div>
              <span className="font-bold text-[10px] lg:text-xs landscape:block lg:block hidden tracking-wide">Finalizar Sessão</span>
            </button>
          </div>
        </div>
      </div>
      {imageToCrop && (
        <ImageCropper 
          image={imageToCrop} 
          onCropComplete={handleCropComplete} 
          onCancel={() => setImageToCrop(null)} 
          isProfileMode={true}
        />
      )}
    </aside>
  );
}
