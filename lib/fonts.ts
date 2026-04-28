import { Inter, JetBrains_Mono, Playfair_Display, Arimo } from 'next/font/google';

export const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

export const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const playfairDisplay = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-serif',
  display: 'swap',
});

export const arimo = Arimo({
  subsets: ['latin'],
  variable: '--font-arimo',
  display: 'swap',
});
