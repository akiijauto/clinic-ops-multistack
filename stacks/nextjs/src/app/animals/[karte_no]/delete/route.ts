import { getDb } from '@/lib/db';
import { getPatientWithOwner, deletePatient } from '@/lib/area1/data';
import { escapeHtml, page, htmlResponse, notFoundHtml, successBanner, errorBanner, parseForm } from '@/lib/area1/html';

type Params = { params: Promise<{ karte_no: string }> };

/**
 * /animals/{karte_no}/delete -- openapi「削除（確認画面）」。
 * spec/model.md「消さずに印を付ける」: 物理削除しない。この動物がその飼主の
 * 最後の1頭なら Owner も一緒に論理削除される（`deletePatient` 側で処理）。
 */
function render(karteNo: string, name: string, deletedAt: string | null, banner: string): string {
  const body = `
${banner}
<p>カルテNo ${escapeHtml(karteNo)}（${escapeHtml(name)}）を削除します。</p>
<p>現在の状態: ${deletedAt ? `削除済み（${escapeHtml(deletedAt)}）` : '未削除'}</p>
${
  deletedAt
    ? `<p><a href="/animals/${escapeHtml(karteNo)}">顧客画面へ戻る</a></p>`
    : `<form method="post">
        <button type="submit">削除する</button>
      </form>
      <p><a href="/animals/${escapeHtml(karteNo)}">キャンセルして戻る</a></p>`
}`;
  return page({ title: '削除確認', screenKey: 'screen-delete-confirm', body });
}

export async function GET(_req: Request, { params }: Params): Promise<Response> {
  const { karte_no: karteNo } = await params;
  const record = getPatientWithOwner(getDb(), karteNo);
  if (!record) return notFoundHtml();
  return htmlResponse(render(karteNo, record.name_kanji, record.deleted_at, ''));
}

export async function POST(req: Request, { params }: Params): Promise<Response> {
  const { karte_no: karteNo } = await params;
  const db = getDb();
  const before = getPatientWithOwner(db, karteNo);
  if (!before) return notFoundHtml();

  await parseForm(req); // no fields required; reads the body so the connection closes cleanly
  const after = deletePatient(db, karteNo, null);
  const banner = after?.deleted_at ? successBanner('削除しました。') : errorBanner('削除できませんでした。');
  return htmlResponse(render(karteNo, before.name_kanji, after?.deleted_at ?? null, banner));
}
