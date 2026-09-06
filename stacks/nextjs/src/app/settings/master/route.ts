import { DEFAULT_MASTER_KEY } from '@/lib/settings-masters';
import { renderMasterBody } from '@/lib/settings-masters-render';
import { page } from '@/lib/render';

// GET /settings/master -- spec/screens.md「25. マスタ」(既定のカテゴリ。一覧のみ、編集は作らない).
export async function GET(): Promise<Response> {
  return page('マスタ', 'screen-settings-master', renderMasterBody(DEFAULT_MASTER_KEY));
}
