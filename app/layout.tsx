import type { Metadata, Viewport } from 'next';
import { Inter, Manrope, Libre_Baskerville, Dancing_Script, Playfair_Display, Pacifico, Caveat, Satisfy, Marck_Script, Noto_Sans, Noto_Serif } from 'next/font/google';
import './globals.css';
import ErrorBoundary from '@/components/ErrorBoundary';
import LGPDConsent from '@/components/LGPDConsent';
import { DialogProvider } from '@/hooks/useDialog';
import { ThemeProvider } from '@/context/ThemeContext';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

const notoSans = Noto_Sans({
  subsets: ['latin'],
  variable: '--font-noto-sans',
  weight: ['400', '700', '900'],
});

const notoSerif = Noto_Serif({
  subsets: ['latin'],
  variable: '--font-noto-serif',
  weight: ['400', '700'],
});

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-manrope',
});

const libreBaskerville = Libre_Baskerville({
  weight: ['400', '700'],
  subsets: ['latin'],
  variable: '--font-serif-libre',
});

const playfairDisplay = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-serif',
});

const dancingScript = Dancing_Script({
  subsets: ['latin'],
  variable: '--font-signature',
});

const pacifico = Pacifico({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-signature-pacifico',
});

const caveat = Caveat({
  subsets: ['latin'],
  variable: '--font-signature-caveat',
});

const satisfy = Satisfy({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-signature-satisfy',
});

const marckScript = Marck_Script({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-signature-marck',
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
      { url: '/ProgCir_Ico.svg', type: 'image/svg+xml' },
    ],
    apple: [
      { url: '/ProgCir_Ico.svg', type: 'image/svg+xml' },
    ],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-br" suppressHydrationWarning className={`${inter.variable} ${notoSans.variable} ${notoSerif.variable} ${manrope.variable} ${libreBaskerville.variable} ${playfairDisplay.variable} ${dancingScript.variable} ${pacifico.variable} ${caveat.variable} ${satisfy.variable} ${marckScript.variable}`}>
      <body suppressHydrationWarning className="font-sans antialiased min-h-screen">
        <ErrorBoundary>
          <ThemeProvider>
            <DialogProvider>
              {children}
              <LGPDConsent />
            </DialogProvider>
          </ThemeProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
