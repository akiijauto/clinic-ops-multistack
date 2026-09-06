import { getDb } from '@/lib/db';
import { getPatientWithOwner } from '@/lib/area1/data';
import { listPapersForKarteNo, noPaperFlag, type Paper } from '@/lib/clinical/papers';
import { escapeHtml, page, htmlResponse, notFoundHtml } from '@/lib/area1/html';

const e = escapeHtml;

type Params = { params: Promise<{ karte_no: string }> };

function rowHtml(p: Paper): string {
  return `<tr data-testid="row-paper">
    <td>${e(p.period)}</td>
    <td>${p.visit_id ? `診察#${p.visit_id}` : '動物ぜんぶ'}</td>
    <td>${e(p.filename)}</td>
    <td>${e(p.created_at)}</td>
    <td>${e(p.note)}</td>
    <td><a href="/papers/${p.id}">詳細</a></td>
  </tr>`;
}

// GET /animals/{karte_no}/papers -- spec/openapi.yaml `screen_papers`.
export async function GET(_req: Request, { params }: Params): Promise<Response> {
  const { karte_no } = await params;
  const patient = getPatientWithOwner(getDb(), karte_no);
  if (!patient) return notFoundHtml();

  const papers = listPapersForKarteNo(karte_no);
  const rows = papers.length
    ? papers.map(rowHtml).join('\n')
    : `<tr data-testid="empty-papers"><td colspan="6">取り込み済みのPDFはまだありません。</td></tr>`;
  const noPaper = noPaperFlag(patient.id);

  const body = `
    <p>カルテNo: ${e(karte_no)} ｜ 動物名: ${e(patient.name_kanji)}</p>
    <p>${noPaper ? '「この子の紙カルテは元から無い」の印が付いています。' : (papers.length === 0 ? '<a href="/papers/no-paper">この子の紙カルテは元から無い場合はこちら</a>' : '')}</p>
    <table>
      <thead><tr><th>時期</th><th>付け先</th><th>ファイル名</th><th>取込日</th><th>メモ</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p><a href="/animals/${e(karte_no)}/history">来院履歴へ</a></p>`;
  return htmlResponse(page({ title: `書類 — ${patient.name_kanji}`, screenKey: 'screen-papers', body }));
}
