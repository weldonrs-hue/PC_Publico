'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import {
  LayoutDashboard,
  GraduationCap,
  Calendar,
  Shapes,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  User,
  Camera,
  Mail,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ImageCropper from './ImageCropper';
import Logo from './Logo';
import { db } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '@/utils/firestore';
import { cn } from '@/lib/utils';

const navItems = [
  { icon: LayoutDashboard, label: 'Circuito', view: 'dashboard' },
  { icon: GraduationCap, label: 'Escolas', view: 'schools' },
  { icon: Calendar, label: 'Eventos', view: 'events' },
  { icon: Mail, label: 'Cartas', view: 'cartas' },
  { icon: Shapes, label: 'Diversos', view: 'misc' },
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
  hasPendingInvites?: boolean;
}

export default function Sidebar({
  onLogout,
  user,
  personalData,
  currentView,
  espInitialMode,
  onBack,
  onViewChange,
  hasGuestInvites = false,
  hasPendingInvites = false,
}: SidebarProps) {
  const navRef = useRef<HTMLElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleCropComplete = async (croppedImage: string) => {
    if (!user?.id) return;

    setIsUploading(true);
    try {
      const userDocRef = doc(db, 'users', user.id);
      await updateDoc(userDocRef, {
        photoURL: croppedImage,
      });
      setImageToCrop(null);
    } catch (error) {
      console.error('Error updating profile photo:', error);
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.id}`);
    } finally {
      setIsUploading(false);
    }
  };

  const isActive = (itemView: string) => {
    if (currentView === itemView) return true;

    if (itemView === 'dashboard') {
      const dashboardViews = [
        'dashboard',
        'congregations',
        'personal_data',
        'substitutes',
        'itineraries',
        'statistics',
        'aviso_de_visitas',
      ];
      return dashboardViews.includes(currentView);
    }
    if (itemView === 'schools') {
      return (
        ['schools', 'pioneer_school', 'emr_ancians_program', 'emr_servants_program'].includes(
          currentView
        ) || currentView.startsWith('pioneer_school_guest')
      );
    }
    if (itemView === 'events') {
      return (
        [
          'events',
          'regional_convention_program',
          'circuit_assembly_supt_program',
          'circuit_assembly_branch_program',
        ].includes(currentView) || currentView.startsWith('regional_convention_guest')
      );
    }
    if (itemView === 'misc') {
      const miscViews = [
        'misc',
        'field_service_report',
        'file_viewer',
        'weekly_expenses',
        'inbox',
      ];
      return miscViews.includes(currentView);
    }
    if (itemView === 'cartas') {
      const cartasViews = [
        'cartas',
        'cartas_esp',
        'cartas_dashboard',
        'cartas_emr',
        'cartas_congresso',
        'cartas_assembleias',
        'cartas_programacoes',
      ];
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
      checkScroll();
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
        behavior: 'smooth',
      });
    }
  };

  const isAdminUser = 
    user?.role === 'admin' || 
    user?.usuario === '2283701' || 
    user?.email === 'weldonrs@gmail.com' ||
    user?.email === '2283701@progcir.app' ||
    user?.email === '2283701@progcir.com' ||
    user?.email === '2283701@gmail.com' ||
    user?.id === '2283701';

  const menuItems = navItems.filter((item) => {
    const role = personalData?.role || 'viajante';
    if (role === 'pioneiro_especial' || role === 'pioneiro_regular') {
      if (['events', 'cartas'].includes(item.view)) return false;
      if (item.view === 'schools') return hasGuestInvites;
    }
    return true;
  });

  return (
    <aside
      className="
        fixed z-[1001]
        sidebar-theme
        transition-all duration-300 ease-in-out select-none
        portrait:bottom-0 portrait:left-0 portrait:right-0 portrait:h-16 portrait:flex-row portrait:w-full portrait:border-t portrait:shadow-2xl
        landscape:top-0 landscape:left-0 landscape:bottom-0 landscape:w-20 landscape:sm:w-24 landscape:lg:w-64 landscape:flex-col landscape:border-r landscape:shadow-2xl
        flex overflow-y-auto overflow-x-hidden
      "
    >
      {/* Top Logo Section (Landscape / Desktop) */}
      <div 
        className="p-3.5 lg:p-5 landscape:block portrait:hidden border-b backdrop-blur-xs"
        style={{ borderColor: 'var(--sidebar-border)', backgroundColor: 'var(--sidebar-header-bg)' }}
      >
        <div className="flex items-center justify-center lg:justify-start">
          <Logo
            iconSize="w-9 h-9 lg:w-11 lg:h-11"
            textSize="text-xl lg:text-2xl"
            showText={true}
            textColor="#ffffff"
            outlineColor="#ffffff"
          />
        </div>
      </div>

      {/* Navigation Items */}
      <div className="relative flex-1 flex items-center landscape:items-start overflow-hidden landscape:overflow-visible">
        {/* Left Scroll Arrow (Mobile Portrait only) */}
        <AnimatePresence>
          {canScrollLeft && (
            <motion.button
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              onClick={() => scroll('left')}
              className="landscape:hidden absolute left-0 z-10 h-full px-1.5 bg-gradient-to-r from-[var(--sidebar-from)] to-transparent text-white/90 flex items-center justify-center"
            >
              <ChevronLeft size={18} />
            </motion.button>
          )}
        </AnimatePresence>

        <nav
          ref={navRef}
          className="
            flex-1 px-2 lg:px-3
            landscape:flex landscape:flex-col landscape:space-y-1 landscape:py-4
            portrait:flex portrait:flex-row portrait:items-center portrait:justify-around portrait:px-1 portrait:space-y-0
            portrait:overflow-x-auto portrait:scrollbar-hide portrait:gap-1 portrait:h-full
          "
        >
          {menuItems.map((item) => {
            const active = isActive(item.view);
            const Icon = item.icon;

            return (
              <button
                key={item.label}
                type="button"
                onClick={() => onViewChange(item.view)}
                className={cn(
                  'relative flex items-center transition-all duration-150 group rounded-xl cursor-pointer hover:bg-white/10',
                  // Landscape (Sidebar Desktop)
                  'landscape:w-full landscape:justify-center lg:landscape:justify-start landscape:gap-3 landscape:px-3 landscape:py-2.5',
                  // Portrait (Mobile Bottom Bar)
                  'portrait:flex-col portrait:justify-center portrait:items-center portrait:py-1 portrait:px-1 portrait:min-w-[48px] portrait:flex-1',
                  active
                    ? 'font-bold shadow-2xs border backdrop-blur-xs'
                    : 'font-medium active:scale-95'
                )}
                style={active ? {
                  backgroundColor: 'var(--sidebar-active-bg)',
                  borderColor: 'var(--sidebar-active-border)',
                  color: 'var(--sidebar-active-text)'
                } : {
                  color: 'var(--sidebar-text)'
                }}
                title={item.label}
              >
                {/* Active Pill Indicator (Desktop only) */}
                {active && (
                  <span 
                    className="hidden lg:block absolute right-2 top-1/2 -translate-y-1/2 w-1.5 h-4 rounded-full animate-fade-in shadow-xs" 
                    style={{ backgroundColor: 'var(--sidebar-indicator)' }}
                  />
                )}

                {/* Active Indicator Bar (Mobile Bottom Bar) */}
                {active && (
                  <span 
                    className="portrait:block hidden absolute top-0 left-1/2 -translate-x-1/2 w-8 h-1 rounded-b-full shadow-xs" 
                    style={{ backgroundColor: 'var(--sidebar-indicator)' }}
                  />
                )}

                <span
                  className={cn(
                    'flex items-center justify-center transition-transform duration-150 shrink-0',
                    active ? 'scale-105' : 'group-hover:scale-105 group-hover:text-white'
                  )}
                  style={{ color: active ? 'var(--sidebar-active-text)' : undefined }}
                >
                  <Icon size={20} strokeWidth={active ? 2.4 : 1.8} />
                </span>

                {/* Text: Desktop */}
                <span className="font-sans text-xs lg:text-sm truncate hidden lg:block" style={{ color: active ? 'var(--sidebar-active-text)' : undefined }}>
                  {item.label}
                </span>

                {/* Text: Mobile Bottom Bar */}
                <span
                  className="portrait:block lg:hidden landscape:hidden text-[10px] tracking-tight mt-0.5 truncate w-full text-center"
                  style={{ color: active ? 'var(--sidebar-active-text)' : undefined }}
                >
                  {item.label}
                </span>

                {/* Pending Invites Notification Dot */}
                {item.view === 'settings' && hasPendingInvites && (
                  <span className="absolute landscape:right-3 landscape:top-3 portrait:right-3 portrait:top-1 w-2 h-2 bg-amber-300 rounded-full animate-pulse ring-2 ring-primary-200" />
                )}
              </button>
            );
          })}

          {/* Mobile Logout (portrait only) */}
          <button
            type="button"
            onClick={onLogout}
            className="portrait:flex landscape:hidden flex-col items-center justify-center py-1 px-1 min-w-[48px] flex-1 rounded-xl hover:bg-white/10 transition-all cursor-pointer active:scale-95"
            style={{ color: 'var(--sidebar-text)' }}
            title="Sair"
          >
            <LogOut size={18} strokeWidth={1.8} />
            <span className="text-[10px] font-medium mt-0.5 truncate" style={{ color: 'var(--sidebar-text)' }}>Sair</span>
          </button>
          <div className="portrait:flex landscape:hidden items-center justify-center px-4 opacity-20 select-none">
            <span className="text-[8px] font-black tracking-widest">v1.5.0</span>
          </div>
        </nav>

        {/* Right Scroll Arrow (Mobile Portrait only) */}
        <AnimatePresence>
          {canScrollRight && (
            <motion.button
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              onClick={() => scroll('right')}
              className="landscape:hidden absolute right-0 z-10 h-full px-1.5 bg-gradient-to-l from-[var(--sidebar-to)] to-transparent text-white/90 flex items-center justify-center"
            >
              <ChevronRight size={18} />
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Footer / User Profile & Logout (Desktop / Landscape) */}
      <div 
        className="mt-auto landscape:flex portrait:hidden flex-col border-t p-3 lg:p-4"
        style={{ borderColor: 'var(--sidebar-border)', backgroundColor: 'var(--sidebar-footer-bg)' }}
      >
        <button
          type="button"
          onClick={onLogout}
          className="flex items-center justify-center lg:justify-start gap-3 w-full p-2.5 rounded-xl transition-all group cursor-pointer hover:bg-white/10"
          style={{ color: 'var(--sidebar-text)' }}
          title="Encerrar Sessão"
        >
          <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 text-white/80 group-hover:bg-rose-500/80 group-hover:text-white transition-colors shrink-0">
            <LogOut size={16} strokeWidth={2} />
          </div>
          <span className="text-xs font-semibold hidden lg:block tracking-wide group-hover:text-white transition-colors">
            Sair do Sistema
          </span>
        </button>

        <div className="pt-2 text-[9px] text-white/40 font-bold uppercase tracking-wider text-center hidden lg:block">
          ProgCir v1.5.0
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
