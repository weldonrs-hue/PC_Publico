import type { Metadata } from 'next';
import { Inter, Manrope } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-manrope',
});

export const metadata: Metadata = {
  title: 'ProgCir Web - Gestão de Circuitos',
  description: 'Plataforma administrativa para gestão de circuitos e congregações.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-br" className={`${inter.variable} ${manrope.variable}`}>
      <body suppressHydrationWarning className="bg-gray-50 font-sans">
        {children}
      </body>
    </html>
  );
}
