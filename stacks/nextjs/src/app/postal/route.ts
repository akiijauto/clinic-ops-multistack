import { getDb } from '@/lib/db';
import { many } from '@/lib/area1/query';
import { errorResponse } from '@/lib/errors';

/**
 * GET /postal -- spec/openapi.yaml `/postal` (受付・患者の入力補助ユーティリティ).
 *
 * No postal-code master ships anywhere in `data/` (`spec/model.md`「変わらな
 * いもの」 lists only lab items / price items / masters / seed) and there is
 * no external network call in this project's scope, so this looks candidates
 * up in the addresses this lane already has (`owner.postal_code` /
 * `address1` / `address2` from `data/seed.json`) rather than inventing a
 * fake nationwide postal database. Real-world coverage is whatever the 40
 * seed owners happen to cover; `reason` says so when nothing matches.
 */
export async function GET(req: Request): Promise<Response> {
  const code = new URL(req.url).searchParams.get('code');
  if (!code) return errorResponse('invalid_input', [{ field: 'code', message: '郵便番号（code）は必須です。' }]);

  const normalized = code.replace(/[^0-9]/g, '');
  const db = getDb();
  const rows = many<{ postal_code: string; address1: string; address2: string }>(
    db.prepare(`SELECT DISTINCT postal_code, address1, address2 FROM owner WHERE REPLACE(postal_code, '-', '') = ?`),
    normalized,
  );

  return Response.json({
    candidates: rows,
    reason: rows.length === 0 ? 'この企画には外部の郵便番号データベースが無く、既存の住所録に一致がありませんでした。' : null,
  });
}
