import { getPaper, removePaper } from '@/lib/clinical/papers';
import { getDb } from '@/lib/db';
import { getPatientById } from '@/lib/area1/data';
import { escapeHtml, page, htmlResponse, notFoundHtml, successBanner } from '@/lib/area1/html';

const e = escapeHtml;

type Params = { params: Promise<{ paper_id: string }> };

// POST /papers/{paper_id}/remove -- spec/openapi.yaml `screen_paper_remove`.
// screens.md 13「取り消したPDFは一覧から消えるが、記録（行）自体は保持される」
// -- logical delete via `removePaper`, then the animal's papers list
// (`screen-papers`, per the contract's x-data-testids for this path) is
// re-rendered with the success banner.
export async function POST(_req: Request, { params }: Params): Promise<Response> {
  const { paper_id } = await params;
  const id = Number(paper_id);
  const before = Number.isInteger(id) ? getPaper(id) : undefined;
  if (!before) return notFoundHtml();

  const after = removePaper(id);
  const patient = getPatientById(getDb(), after.patient_id);

  const body = `
    ${successBanner('取り消しました。')}
    <p>ファイル名: ${e(after.filename)}</p>
    <p><a href="/animals/${e(patient?.karte_no ?? '')}/papers">書類一覧へ戻る</a> ｜ <a href="/papers/${after.id}">この書類の詳細へ</a></p>`;
  return htmlResponse(page({ title: '書類の取り消し', screenKey: 'screen-papers', body }));
}
