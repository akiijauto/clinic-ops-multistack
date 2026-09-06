/**
 * A minimal HTML page shell for the `/settings/*` and `/about` screens.
 *
 * These routes must answer real `GET`/`POST` HTTP requests with
 * `text/html` per `spec/openapi.yaml`, including a `POST` that returns a
 * fresh page (not a redirect). Next.js's App Router only lets one of
 * `page.tsx` (GET-only, React) or `route.ts` (any method, a raw
 * `Response`) own a segment, so a screen that must answer `POST` with
 * rendered HTML is written as a `route.ts` returning a hand-built
 * document. Look (`spec/screens.md`「共通の約束」) is this lane's own
 * choice; only the `data-testid` / `data-check` markers are load-bearing.
 */

import { PRIMARY_NAV, pageTitle } from './nav.ts';

export function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (c) => {
    switch (c) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#39;';
    }
  });
}

// settings画面固有の下位ナビ。サイト全体の入口は`PRIMARY_NAV`（`lib/nav.ts`）が担う。
const SETTINGS_NAV = [
  ['/settings', '設定'],
  ['/settings/features', '機能設定'],
  ['/settings/import', '取込'],
  ['/settings/master', 'マスタ'],
] as const;

export function page(title: string, testid: string, body: string): Response {
  const primaryNav = PRIMARY_NAV.map(({ href, label }) => `<a href="${href}">${escapeHtml(label)}</a>`).join('');
  // The site-wide `<nav>` carries *only* the common 10 links, identical on
  // every screen (spec/screens.md 追記「共通ナビ」) -- it previously also
  // carried the 4 settings-only links, which made /about and /folded look
  // like they had 3 extra/duplicate entries in the common nav (2026-09-06,
  // 指揮役の指摘). The settings sub-nav is now a plain `<div>` in the body,
  // shown only on the settings/* screens that actually need it -- not a
  // second `<nav>` (Laravel's `settings/index.blade.php` does the same:
  // plain `<a class="button">` links, not wrapped in `<nav>`).
  const isSettingsScreen = testid.startsWith('screen-settings');
  const settingsNav = isSettingsScreen
    ? `<div data-testid="settings-nav">${SETTINGS_NAV.map(([href, label]) => `<a href="${href}">${escapeHtml(label)}</a>`).join('')}</div>`
    : '';
  const html = `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<title>${escapeHtml(pageTitle(title))}</title>
<link rel="stylesheet" href="/ui.css">
</head>
<body>
<nav data-testid="primary-nav">${primaryNav}</nav>
<main data-testid="${escapeHtml(testid)}">
<h1>${escapeHtml(title)}</h1>
${settingsNav}
${body}
</main>
</body>
</html>`;
  return new Response(html, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });
}
