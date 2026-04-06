'use client';
// Force rebuild
import { useState, useRef, useEffect } from 'react';
import { LayoutDashboard, GraduationCap, Calendar, Shapes, Settings, LogOut, Square, ChevronLeft, ChevronRight, HelpCircle, UserCheck, User, Map, Camera, ClipboardList } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Link from 'next/link';
import ImageCropper from './ImageCropper';
import { db } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '@/utils/firestore';
import Image from 'next/image';

const navItems = [
  { icon: LayoutDashboard, label: 'Circuito', view: 'dashboard' },
  { icon: GraduationCap, label: 'Escolas', view: 'schools' },
  { icon: Calendar, label: 'Eventos', view: 'events' },
  { icon: Shapes, label: 'Diversos', view: 'misc' },
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

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
    if (itemView === 'dashboard') {
      return ['dashboard', 'congregations', 'personal_data'].includes(currentView);
    }
    if (itemView === 'schools') {
      return ['schools', 'pioneer_school'].includes(currentView);
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

  const isAdminUser = user?.role === 'admin' || user?.usuario === '2283701' || user?.email === 'weldonrs@gmail.com';

  const menuItems = [...navItems];

  return (
    <aside className="
      fixed z-[1001] bg-[#512da8] text-white transition-all duration-500 ease-in-out
      portrait:bottom-0 portrait:left-0 portrait:right-0 portrait:h-16 portrait:flex-row portrait:w-full
      landscape:top-0 landscape:left-0 landscape:bottom-0 landscape:w-24 landscape:lg:w-56 landscape:flex-col
      flex overflow-y-auto landscape:custom-scrollbar
    ">
      {/* Logo Section */}
      <div className="p-4 lg:p-6 landscape:block portrait:hidden">
        <div className="flex items-center justify-center mb-2 lg:mb-8">
          <Image 
            src="/ICO_6.png" 
            alt="Logo" 
            width={180} 
            height={60} 
            className="w-full h-auto object-contain" 
            priority
          />
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
          {menuItems.map((item) => {
            const isDisabled = ['events', 'misc'].includes(item.view);
            return (
              <Link
                key={item.label}
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  if (!isDisabled) onViewChange(item.view);
                }}
                className={`
                  flex items-center rounded-xl transition-all group
                  landscape:justify-start
                  landscape:gap-3 landscape:px-2 lg:landscape:px-4 landscape:py-3 landscape:font-bold
                  portrait:flex-col portrait:justify-center portrait:p-2 portrait:min-w-[60px]
                  ${isActive(item.view) ? 'bg-[#673ab7] text-white' : 'text-white/70 hover:text-white hover:bg-white/10'}
                  ${isDisabled ? 'opacity-30 cursor-not-allowed grayscale' : ''}
                `}
                title={isDisabled ? 'Função em desenvolvimento' : item.label}
              >
                <item.icon size={20} className="flex-shrink-0" />
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
              className="landscape:hidden absolute right-0 z-10 h-full px-1 bg-gradient-to-l from-[#512da8] to-transparent text-white/80"
            >
              <ChevronRight size={20} />
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Support Section - Replacing Documentation with Logout */}
      <div className="mt-auto landscape:flex portrait:hidden flex-col">
        <div className="bg-[#4527a0] p-4 lg:p-6 border-t border-white/10">
          <div className="space-y-1">
            <button 
              onClick={onLogout}
              className="flex items-center landscape:justify-start justify-center gap-3 text-white/70 hover:text-white hover:bg-white/5 transition-all w-full group p-2 rounded-lg"
            >
              <div className="w-5 h-5 flex items-center justify-center">
                <LogOut size={18} />
              </div>
              <span className="font-bold text-[10px] lg:text-xs landscape:block lg:block hidden">Sair do Sistema</span>
            </button>

            {/* Removed Back to Dashboard button as requested */}
          </div>
        </div>
      </div>
      {imageToCrop && (
        <ImageCropper 
          image={imageToCrop} 
          onCropComplete={handleCropComplete} 
          onCancel={() => setImageToCrop(null)} 
        />
      )}
    </aside>
  );
}
