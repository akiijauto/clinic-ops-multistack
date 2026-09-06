import { getDb } from '@/lib/db';
import { getVisit, getPatientByKarteNo, restoreVisit } from '@/lib/area1/data';
import { escapeHtml, htmlResponse, notFoundHtml, successBanner, parseForm } from '@/lib/area1/html';
import { PRIMARY_NAV, pageTitle } from '@/lib/nav';

type Params = { params: Promise<{ karte_no: string; visit_id: string }> };

/** /animals/{karte_no}/karte/{visit_id}/restore -- spec/screens.md「6. 削除（診察の削除・復元）」の復元側. Reason is optional here (unlike delete). */
export async function POST(req: Request, { params }: Params): Promise<Response> {
  const { karte_no: karteNo, visit_id: visitIdParam } = await params;
  const db = getDb();
  const patient = getPatientByKarteNo(db, karteNo);
  const visit = getVisit(db, Number(visitIdParam));
  if (!patient || !visit || visit.patient_id !== patient.id) return notFoundHtml();

  const form = await parseForm(req);
  const reason = form.reason || null;
  restoreVisit(db, visit.id, null, reason);

  const primaryNav = PRIMARY_NAV.map(({ href, label }) => `<a href="${escapeHtml(href)}">${escapeHtml(label)}</a>`).join('');
  const body = `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><title>${escapeHtml(pageTitle('診察の復元'))}</title><link rel="stylesheet" href="/ui.css"></head>
<body>
<nav data-testid="primary-nav">${primaryNav}</nav>
<div data-testid="screen-karte">
<h1>診察の復元</h1>
${successBanner('復元しました。')}
<p><a href="/animals/${escapeHtml(karteNo)}/history">来院履歴へ戻る</a> ｜ <a href="/animals/${escapeHtml(karteNo)}/karte">カルテへ</a></p>
</div>
</body></html>`;
  return htmlResponse(body);
}
