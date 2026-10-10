'use client';

import { useParams } from 'next/navigation';
import FieldServiceReportView from '@/components/FieldServiceReportView';
import ThemeSwitcher from '@/components/ui/theme-switcher';
import Image from 'next/image';

export default function PublicReportPage() {
  const params = useParams();
  const rawProfileId = params?.profileId;
  const profileId = Array.isArray(rawProfileId) ? rawProfileId[0] : (rawProfileId as string);

  return (
    <div className="min-h-screen bg-surface-50 text-typography-900 transition-colors duration-300">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 bg-surface-100/80 backdrop-blur-md border-b border-surface-300 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Image
              src="/logo.png"
              alt="ProgCir"
              width={28}
              height={28}
              className="rounded-lg shadow-2xs"
            />
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-sm sm:text-base tracking-tight text-typography-900">ProgCir</span>
              <span className="text-[10px] uppercase font-bold tracking-wider text-pink-600 dark:text-pink-400 px-1.5 py-0.5 rounded-md bg-pink-500/10 border border-pink-500/20">
                Relatório
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeSwitcher />
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
        <FieldServiceReportView 
          profileId={profileId || ''} 
          isPublic={true} 
        />
      </main>
    </div>
  );
}

