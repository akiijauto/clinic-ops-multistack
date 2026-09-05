import type { ReactNode } from 'react';
import './globals.css';

export const metadata = {
  title: 'clinic-ops (Next.js)',
  description: 'Lane E implementation - study/research purposes only.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
