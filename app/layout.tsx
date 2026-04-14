import type { Metadata, Viewport } from 'next';
import { Inter, Manrope, Libre_Baskerville } from 'next/font/google';
import './globals.css';
import ErrorBoundary from '@/components/ErrorBoundary';
import LGPDConsent from '@/components/LGPDConsent';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-manrope',
});

const libreBaskerville = Libre_Baskerville({
  weight: ['400', '700'],
  subsets: ['latin'],
  variable: '--font-serif',
});

export const viewport: Viewport = {
  themeColor: '#673ab7',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  title: 'ProgCir - Programador de Atividades do Circuito',
  description: 'Sistema de gestão e programação das atividades do circuito',
  icons: {
    icon: [
      { url: '/LogoNovo.svg', type: 'image/svg+xml' },
    ],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-br" className={`${inter.variable} ${manrope.variable} ${libreBaskerville.variable}`}>
      <body suppressHydrationWarning className="bg-gray-50 font-sans">
        <ErrorBoundary>
          {children}
          <LGPDConsent />
        </ErrorBoundary>
      </body>
    </html>
  );
}
