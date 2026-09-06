import type { ReactNode } from 'react';
import Link from 'next/link';
import './globals.css';
import { PRIMARY_NAV, pageTitle } from '@/lib/nav';

// このレイアウトが実際に効くのは `page.tsx`（React描画）である `/` だけ
// （他の全画面は route.ts が自前で組み立てる完全なHTML文書を返し、layoutを経由しない）。
// タイトルは spec/screens.md「画面名 — 動物病院 窓口業務システム」の形に合わせる。
export const metadata = {
  title: pageTitle('トップ'),
  description: 'study/research purposes only.',
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
            one /folded page.
            `<nav>` (not `<header>`) is load-bearing: spec/ui.css styles the
            `nav` element and hides it under `@media print`, and
            tests/inventory.py's checker only looks inside a real `<nav>`.
            No `｜` separator between links -- `spec/ui.css`'s `nav a { margin-right }`
            already spaces them, and a hand-added separator only makes this
            lane's nav look different from the other 4 (2026-09-06、指揮役の指摘)。 */}
        <nav data-testid="primary-nav">
          {PRIMARY_NAV.map(({ href, label }) => (
            <Link key={href} href={href}>
              {label}
            </Link>
          ))}
        </nav>
        {children}
      </body>
    </html>
  );
}
