/**
 * Tiny hand-rolled HTML helpers for area1 (受付・患者) screens.
 *
 * These screens are plain server-rendered HTML (`spec/openapi.yaml`'s
 * intro: "画面のルートが契約するのは200が返ることとx-data-testidsの存在の
 * 2点だけ"). Route handlers build strings directly rather than going through
 * React, so a failed form re-render is trivially "the same page, with the
 * values the user typed and an error banner" -- no client state to reconcile
 * (`spec/openapi.yaml`「HTMLフォーム送信時のエラーの出し方」).
 */

export function escapeHtml(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

const e = escapeHtml;

/** Wraps page content in the shared shell and a `screen-<key>` container. */
export function page(opts: { title: string; screenKey: string; nav?: string; body: string }): string {
  return `<!doctype html>
<html lang="ja">
<head><meta charset="utf-8"><title>${e(opts.title)}</title><link rel="stylesheet" href="/ui.css"></head>
<body>
<header><a href="/">トップ</a> ｜ <a href="/today">本日の患者</a> ｜ <a href="/search">検索</a></header>
<div data-testid="${e(opts.screenKey)}">
${opts.nav ?? ''}
${opts.body}
</div>
</body>
</html>`;
}

export function htmlResponse(body: string): Response {
  return new Response(body, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });
}

export function notFoundHtml(message = '指定されたデータが見つかりません。'): Response {
  return new Response(`<!doctype html><html><body><p data-testid="error-banner">${e(message)}</p></body></html>`, {
    status: 404,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
}

export function successBanner(message: string): string {
  return `<p data-testid="success-banner" class="success-banner">${e(message)}</p>`;
}

export function errorBanner(message: string): string {
  return `<p data-testid="error-banner" class="error-banner">${e(message)}</p>`;
}

/** Parses `application/x-www-form-urlencoded` bodies for screen POSTs. */
export async function parseForm(req: Request): Promise<Record<string, string>> {
  const text = await req.text();
  const params = new URLSearchParams(text);
  const out: Record<string, string> = {};
  for (const [k, v] of params.entries()) out[k] = v;
  return out;
}
