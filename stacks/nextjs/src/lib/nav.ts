/**
 * The site-wide primary navigation, shared by every page shell
 * (`area1/html.ts`'s `page()`, `render.ts`'s `page()`, and the root
 * `layout.tsx`).
 *
 * `coordination/review/2026-09-06_5巡目.md`（レーンR 5巡目, Next.js宛て）:
 * 検算8のクローラーは**辿り着けたリンクが生きているか**しか見ないので、
 * 「クローラーが辿れる画面数が35で最多」であることと「人が見つけられる
 * 画面が少ない」ことは両立する——実際、ここに無かった時期のヘッダーは
 * `/` `/today` `/search`（area1画面）または `/` `/settings*` `/about`
 * （settings画面）の3〜6個しか無く、`/reservations` `/ward` `/staff`
 * `/dm` `/sales` `/animals/new` はURLを知っていれば200が返るのに、
 * トップからも本日の患者からも辿る手段が無かった（深さ2クロールで
 * 到達38パス、他4実装は59〜123パス、と指摘された）。
 *
 * 領域ごとの詳細ナビ（例: `/settings/features` への導線）は各画面が
 * 自前で足してよい（`page()`の`nav`引数）。ここに載せるのは
 * 「どの画面からも1クリックで行ける、領域の入口」だけに絞る。
 */
// spec/screens.md 追記（2026-09-06）「共通ナビ」の並びそのまま
// （`/` へのトップ導線だけは、その表に無いがどの画面からも要るため先頭に足す）。
export const PRIMARY_NAV: readonly { href: string; label: string }[] = [
  ['/', 'トップ'],
  ['/today', '本日の患者'],
  ['/search', '検索'],
  ['/reservations', '予約'],
  ['/ward', '入院'],
  ['/dm', 'DM'],
  ['/sales', '売上集計'],
  ['/staff', 'スタッフ'],
  ['/settings', '設定'],
  ['/about', 'このシステムについて'],
].map(([href, label]) => ({ href, label }));

// spec/screens.md 追記（2026-09-06）: <title> は「画面名 — 動物病院 窓口業務システム」の
// 形にする。レーン名・実装名（「clinic-ops (Next.js)」等）は画面に出す言葉ではない
// （どのスタックかはポート番号で分かる）。
export const SITE_TITLE = '動物病院 窓口業務システム';

export function pageTitle(screenName: string): string {
  return `${screenName} — ${SITE_TITLE}`;
}
