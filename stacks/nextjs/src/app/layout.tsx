import type { ReactNode } from 'react';
import Link from 'next/link';
import './globals.css';
import { PRIMARY_NAV } from '@/lib/nav';

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
      <body>
        {/* Same primary nav as every non-React page shell (`lib/area1/html.ts`,
            `lib/render.ts`) -- coordination/review/2026-09-06_5巡目.md: the
            crawler reaching 35 screens didn't mean a person could find them
            from the top page, since `/` only linked to /today, /about and
            one /folded page. */}
        <header data-testid="primary-nav">
          {PRIMARY_NAV.map(({ href, label }, i) => (
            <span key={href}>
              {i > 0 ? ' ｜ ' : ''}
              <Link href={href}>{label}</Link>
            </span>
          ))}
        </header>
        {children}
      </body>
    </html>
  );
}
