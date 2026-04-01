import type { Metadata } from 'next';

import { PwaRegister } from '@/components/pwa-register';

import './globals.css';

export const metadata: Metadata = {
  title: 'Fuel Calculator - Road Trip Cost Planner | India & Global',
  description:
    'Modern fuel and road trip cost calculator with trip mode, budget mode, vehicle profiles, fuel logs, and multi-unit support for India and global drivers.',
  manifest: '/manifest.webmanifest',
  keywords: [
    'fuel calculator',
    'road trip cost planner',
    'petrol calculator india',
    'diesel trip cost',
    'electric vehicle energy cost calculator',
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-slate-50 antialiased transition-colors duration-300 dark:bg-slate-950">
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
