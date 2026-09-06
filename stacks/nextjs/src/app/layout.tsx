import type { ReactNode } from 'react';
import './globals.css';

export const metadata = {
  title: 'clinic-ops (Next.js)',
  description: 'Lane E implementation - study/research purposes only.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <head>
        {/* Shared 5-implementation stylesheet, served verbatim from
            `public/ui.css` (`spec/ui.css`, unmodified) at a fixed path --
            never the hashed name Next.js gives a bundled/CSS-module import. */}
        <link rel="stylesheet" href="/ui.css" />
      </head>
      <body>{children}</body>
    </html>
  );
}
