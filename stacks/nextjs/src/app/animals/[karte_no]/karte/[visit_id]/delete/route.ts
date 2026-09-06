import { getDb } from '@/lib/db';
import { getVisit, getPatientByKarteNo, deleteVisit } from '@/lib/area1/data';
import { escapeHtml, htmlResponse, notFoundHtml, successBanner, errorBanner, parseForm } from '@/lib/area1/html';

type Params = { params: Promise<{ karte_no: string; visit_id: string }> };

/**
 * /animals/{karte_no}/karte/{visit_id}/delete -- spec/screens.md「6. 削除
 * （診察の削除・復元）」. openapi only lists POST for this path, with the
 * response's required testid being `screen-karte` (not a testid of its
 * own) -- so a plain confirm/execute page here satisfies the contract as
 * long as it carries that testid too. Kept deliberately minimal (Visit
 * summary + the delete form only) per the team lead's brief: this must not
 * duplicate area2's `/animals/{karte_no}/karte` markup (ProgressNote table,
 * etc.).
 */
function render(karteNo: string, visitId: string, visit: { visit_date: string; diagnosis: string; chief_complaint: string; symptom: string; deleted_at: string | null }, banner: string): string {
  const body = `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><title>診察の削除</title><link rel="stylesheet" href="/ui.css"></head>
<body>
<div data-testid="screen-karte">
<div data-testid="screen-visit-delete">
${banner}
<h1>診察の削除</h1>
<dl>
  <dt>来院日</dt><dd>${escapeHtml(visit.visit_date)}</dd>
  <dt>病名</dt><dd>${escapeHtml(visit.diagnosis)}</dd>
  <dt>稟告</dt><dd>${escapeHtml(visit.chief_complaint)}</dd>
  <dt>現症</dt><dd>${escapeHtml(visit.symptom)}</dd>
</dl>
<p>状態: ${visit.deleted_at ? `削除済み（${escapeHtml(visit.deleted_at)}）` : '未削除'}</p>
${
  visit.deleted_at
    ? ''
    : `<form method="post">
        <label>理由（必須） <input name="reason" required></label>
        <button type="submit">削除する</button>
      </form>`
}
<p><a href="/animals/${escapeHtml(karteNo)}/karte">カルテへ戻る</a></p>
</div>
</div>
</body></html>`;
  return body;
}

export async function GET(_req: Request, { params }: Params): Promise<Response> {
  const { karte_no: karteNo, visit_id: visitIdParam } = await params;
  const db = getDb();
  const patient = getPatientByKarteNo(db, karteNo);
  const visit = getVisit(db, Number(visitIdParam));
  if (!patient || !visit || visit.patient_id !== patient.id) return notFoundHtml();
  return htmlResponse(render(karteNo, visitIdParam, visit, ''));
}

export async function POST(req: Request, { params }: Params): Promise<Response> {
  const { karte_no: karteNo, visit_id: visitIdParam } = await params;
  const db = getDb();
  const patient = getPatientByKarteNo(db, karteNo);
  const visit = getVisit(db, Number(visitIdParam));
  if (!patient || !visit || visit.patient_id !== patient.id) return notFoundHtml();

  const form = await parseForm(req);
  const reason = (form.reason ?? '').trim();
  // 満たすべきこと: 削除は理由が空だと成立しない（保存を拒否し、画面に留まる）。
  if (reason.length === 0) {
    return htmlResponse(render(karteNo, visitIdParam, visit, errorBanner('入力の形式が正しくありません。必須の項目や値の型を確認してください。')));
  }
  const after = deleteVisit(db, visit.id, null, reason);
  return htmlResponse(render(karteNo, visitIdParam, after ?? visit, successBanner('削除しました。')));
}
