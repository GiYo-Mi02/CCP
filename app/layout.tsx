import type {Metadata} from 'next';
import { Inter, Playfair_Display } from 'next/font/google';
import { DelegatePeriodNotifier } from '@/components/shared/DelegatePeriodNotifier';
import './globals.css'; // Global styles

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Constitutional Convention Platform',
  description: 'Shaping the Constitution, One Vote at a Time.',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable}`}>
      <body className="font-sans antialiased selection:bg-ccd-accent/40 bg-ccd-bg text-ccd-text min-h-screen" suppressHydrationWarning>
        <DelegatePeriodNotifier />
        {children}
      </body>
    </html>
  );
}
