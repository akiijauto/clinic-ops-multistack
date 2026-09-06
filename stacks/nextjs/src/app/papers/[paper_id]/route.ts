import { getPaper } from '@/lib/clinical/papers';
import { getDb } from '@/lib/db';
import { getPatientById } from '@/lib/area1/data';
import { escapeHtml, page, htmlResponse, notFoundHtml } from '@/lib/area1/html';

const e = escapeHtml;

type Params = { params: Promise<{ paper_id: string }> };

// GET /papers/{paper_id} -- spec/openapi.yaml `screen_paper_detail`.
export async function GET(_req: Request, { params }: Params): Promise<Response> {
  const { paper_id } = await params;
  const id = Number(paper_id);
  const paper = Number.isInteger(id) ? getPaper(id) : undefined;
  if (!paper) return notFoundHtml();
  const patient = getPatientById(getDb(), paper.patient_id);

  const body = `
    <dl>
      <dt>動物</dt><dd>${patient ? `<a href="/animals/${e(patient.karte_no)}/papers">${e(patient.name_kanji)}（${e(patient.karte_no)}）</a>` : '（不明）'}</dd>
      <dt>時期</dt><dd>${e(paper.period)}</dd>
      <dt>付け先</dt><dd>${paper.visit_id ? `診察#${paper.visit_id}` : '動物ぜんぶ'}</dd>
      <dt>ファイル名</dt><dd>${e(paper.filename)}</dd>
      <dt>取込日</dt><dd>${e(paper.created_at)}</dd>
      <dt>メモ</dt><dd>${e(paper.note)}</dd>
      <dt>状態</dt><dd>${paper.removed_at ? `取り消し済み（${e(paper.removed_at)}）` : '有効'}</dd>
    </dl>
    ${paper.removed_at ? '' : `<form method="post" action="/papers/${paper.id}/remove"><button type="submit">取り消す</button></form>`}`;
  return htmlResponse(page({ title: `書類 #${paper.id}`, screenKey: 'screen-paper-detail', body }));
}
