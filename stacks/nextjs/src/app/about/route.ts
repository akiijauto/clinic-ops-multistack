import { page } from '@/lib/render';

// GET /about -- linked from render.ts's shared settings-area nav.
export async function GET(): Promise<Response> {
  const body = `
<p>clinic-ops / Next.js（レーンE）。学習・研究目的の実装で、複製・再配布・改変・商用利用を許可しません。</p>
<p>領域1〜5のうち、現時点で動く画面と最小のスタブ画面をここから辿れます。</p>`;
  return page('このシステムについて', 'screen-about', body);
}
