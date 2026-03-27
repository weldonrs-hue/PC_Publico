import type { Metadata } from 'next';
import { Inter, Manrope, Libre_Baskerville } from 'next/font/google';
import './globals.css';

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

export const metadata: Metadata = {
  title: 'ProgCir Web - Gestão de Circuitos',
  description: 'Plataforma administrativa para gestão de circuitos e congregações.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-br" className={`${inter.variable} ${manrope.variable} ${libreBaskerville.variable}`}>
      <body suppressHydrationWarning className="bg-gray-50 font-sans">
        {children}
      </body>
    </html>
  );
}
