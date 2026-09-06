import { page, htmlResponse } from '@/lib/area1/html';

/**
 * GET /papers/no-paper -- spec/openapi.yaml `screen_papers_no_paper`.
 * No path parameters on this contract path (unlike `/animals/{karte_no}/papers`)
 * -- a generic informational screen, not one animal's flag view. screens.md
 * 13's per-animal「元から無い」の印付け itself has no dedicated screen route
 * in openapi.yaml (only `setNoPaperFlag` in `clinical/papers.ts` implements
 * the toggle); this page explains what the flag means and links back to the
 * animal's own papers screen, where the flag's current state is shown.
 */
export async function GET(): Promise<Response> {
  const body = `
    <p>この画面は、動物の紙カルテが「元から無い」ことを示す案内です。</p>
    <p>個別の動物にこの印を付けたい場合は、その動物の
      <a href="/today">本日の患者</a>からカルテNo経由で「書類」画面を開いてください。</p>
    <p><a href="/today">本日の患者へ戻る</a></p>`;
  return htmlResponse(page({ title: '書類（紙カルテなし）', screenKey: 'screen-papers-no-paper', body }));
}
