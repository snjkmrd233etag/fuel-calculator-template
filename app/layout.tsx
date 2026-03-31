import type { Metadata } from 'next';

import './globals.css';

export const metadata: Metadata = {
  title: 'Fuel Calculator',
  description: 'Calculate fuel needed, trip cost, and budget driving range.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-[linear-gradient(180deg,_#fff8f0_0%,_#f8fafc_100%)] antialiased">
        {children}
      </body>
    </html>
  );
}
