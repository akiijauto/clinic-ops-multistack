import { loadMaster } from '@/lib/settings-masters';
import { renderMasterBody } from '@/lib/settings-masters-render';
import { page } from '@/lib/render';
import { errorResponse } from '@/lib/errors';

type Params = { params: Promise<{ key: string }> };

// GET /settings/master/{key} -- spec/screens.md「25. マスタ」(参照のみ。編集フォームは無い).
export async function GET(_req: Request, { params }: Params): Promise<Response> {
  const { key } = await params;
  if (!loadMaster(key)) return errorResponse('not_found');
  return page('マスタ', 'screen-settings-master', renderMasterBody(key));
}
