/**
 * Tiny server-rendered HTML helpers for area 4 (入院・予約・業務).
 *
 * These routes are plain Route Handlers (`route.ts`), not React pages: the
 * spec's HtmlOk response is just "some text/html", and the acceptance suite
 * reads it with `data-testid`/`data-check` attribute lookups, not hydration.
 * Keeping this server-only (no client JS) means every form works with a
 * plain POST and there is nothing to hydrate incorrectly.
 *
 * This file lives under `_area4/` (a Next.js "private folder" -- the `_`
 * prefix excludes it from routing) so it stays out of the other areas' way
 * even though nothing stops another area from writing its own equivalent.
 */

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** `null`/`undefined` render as an empty cell, never the string "null". */
export function text(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return '';
  return escapeHtml(String(v));
}

const NAV = [
  ['/ward', '入院（本日）'],
  ['/reservations', '予約'],
  ['/staff', 'スタッフ'],
] as const;

/** Wraps a body fragment in a full HTML document with a small shared nav. */
export function page(title: string, bodyHtml: string): string {
  const nav = NAV.map(([href, label]) => `<a href="${href}">${label}</a>`).join(' | ');
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)} - clinic-ops (Next.js)</title>
</head>
<body>
<p><a href="/">トップ</a> | ${nav}</p>
<h1>${escapeHtml(title)}</h1>
${bodyHtml}
</body>
</html>`;
}

export function htmlResponse(body: string, init?: ResponseInit): Response {
  return new Response(body, {
    ...init,
    headers: { 'content-type': 'text/html; charset=utf-8', ...init?.headers },
  });
}

/** `data-testid="success-banner"` / `"error-banner"`, per spec/openapi.yaml. */
export function banner(kind: 'success' | 'error', message: string): string {
  return `<p data-testid="${kind}-banner">${escapeHtml(message)}</p>`;
}
