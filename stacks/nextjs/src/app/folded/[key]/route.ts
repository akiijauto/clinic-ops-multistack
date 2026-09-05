import { DROPPED_FEATURES } from '@/lib/dropped-features';
import { escapeHtml, page } from '@/lib/render';
import { errorResponse } from '@/lib/errors';

type Params = { params: Promise<{ key: string }> };

// GET /folded/{key} -- spec/screens.md「7. 折りたたみ表示」: the detail view
// `/settings/features` links to for each dropped feature.
export async function GET(_req: Request, { params }: Params): Promise<Response> {
  const { key } = await params;
  const feature = DROPPED_FEATURES.find((f) => f.key === key);
  if (!feature) return errorResponse('not_found');

  const body = `
<p><a href="/settings/features">機能設定へ戻る</a></p>
<h2>${escapeHtml(feature.title)}</h2>
<p>${escapeHtml(feature.message)}</p>`;
  return page(feature.title, 'screen-folded', body);
}
