import { getDb } from '@/lib/db';
import { getPatientWithOwner } from '@/lib/area1/data';
import { listPapersForKarteNo, noPaperFlag, setNoPaperFlag, createPaper, type Paper } from '@/lib/clinical/papers';
import { escapeHtml, page, htmlResponse, notFoundHtml, successBanner, errorBanner, parseForm } from '@/lib/area1/html';
import { ApiError } from '@/lib/errors';
import type { Patient, Owner } from '@/lib/model';

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

/**
 * spec/screens.md 13「できること」: PDFを取り込む・取り消す・「元から無い」の
 * 印を付ける／外す。取り消しは `/papers/{paper_id}/remove`（契約にある）で
 * 別途実装済みだが、取り込みと印の付け外しは`/animals/{karte_no}/papers`に
 * POSTを足すしかない -- openapi.yamlはこのパスにGETしか定義していないが、
 * レーンB（Rails）・C（Laravel）も同じ理由で同じパスにPOSTを足している
 * （契約外の追加は「作らない」より安全側、`coordination/review/2026-09-06_5巡目.md`
 * 5-XX「書類画面の登録UIが一切存在しない」の指摘に対する対処）。
 */
function render(karteNo: string, patient: Patient & { owner: Owner }, papers: Paper[], noPaper: boolean, banner: string): string {
  const rows = papers.length
    ? papers.map(rowHtml).join('\n')
    : `<tr data-testid="empty-papers"><td colspan="6">取り込み済みのPDFはまだありません。</td></tr>`;

  const importForm = `<form method="post">
    <input type="hidden" name="action" value="import">
    <fieldset>
      <legend>PDFを取り込む</legend>
      <label>ファイル名（.pdf、必須） <input type="text" name="filename" placeholder="例: 2024-karte.pdf" required></label>
      <label>時期 <input type="text" name="period" placeholder="例: 2024年分"></label>
      <label>付け先の診察ID（空なら動物ぜんぶ） <input type="number" name="visit_id" min="1"></label>
      <label>タイトル <input type="text" name="title"></label>
      <label>メモ <input type="text" name="note"></label>
      <button type="submit">取り込む</button>
    </fieldset>
  </form>`;

  const noPaperToggle = `<form method="post" style="display:inline">
    <input type="hidden" name="action" value="${noPaper ? 'unset_no_paper' : 'set_no_paper'}">
    <button type="submit">${noPaper ? '「元から無い」の印を外す' : '「この子の紙カルテは元から無い」の印を付ける'}</button>
  </form>`;

  const body = `
    <p>カルテNo: ${e(karteNo)} ｜ 動物名: ${e(patient.name_kanji)}</p>
    ${banner}
    <p>${noPaper ? '「この子の紙カルテは元から無い」の印が付いています。' : ''} ${noPaperToggle}</p>
    <table>
      <thead><tr><th>時期</th><th>付け先</th><th>ファイル名</th><th>取込日</th><th>メモ</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    ${importForm}
    <p><a href="/animals/${e(karteNo)}/history">来院履歴へ</a></p>`;
  return page({ title: '書類', screenKey: 'screen-papers', body });
}

// GET /animals/{karte_no}/papers -- spec/openapi.yaml `screen_papers`.
export async function GET(_req: Request, { params }: Params): Promise<Response> {
  const { karte_no } = await params;
  const patient = getPatientWithOwner(getDb(), karte_no);
  if (!patient) return notFoundHtml();

  const papers = listPapersForKarteNo(karte_no);
  const noPaper = noPaperFlag(patient.id);
  return htmlResponse(render(karte_no, patient, papers, noPaper, ''));
}

// POST /animals/{karte_no}/papers -- 契約外の追加（上の注記参照）。取り込み・
// 「元から無い」の印の付け外しをこの画面から完結させる。
export async function POST(req: Request, { params }: Params): Promise<Response> {
  const { karte_no } = await params;
  const patient = getPatientWithOwner(getDb(), karte_no);
  if (!patient) return notFoundHtml();

  const form = await parseForm(req);
  let banner = '';
  try {
    switch (form.action) {
      case 'import': {
        const filename = (form.filename ?? '').trim();
        createPaper(karte_no, {
          filename,
          title: form.title || undefined,
          period: form.period || undefined,
          note: form.note || undefined,
          visit_id: form.visit_id ? Number(form.visit_id) : null,
        });
        banner = successBanner('取り込みました。');
        break;
      }
      case 'set_no_paper':
        setNoPaperFlag(karte_no, true);
        banner = successBanner('「元から無い」の印を付けました。');
        break;
      case 'unset_no_paper':
        setNoPaperFlag(karte_no, false);
        banner = successBanner('「元から無い」の印を外しました。');
        break;
      default:
        banner = errorBanner('入力の形式が正しくありません。必須の項目や値の型を確認してください。');
    }
  } catch (err) {
    if (err instanceof ApiError) {
      banner = errorBanner(err.message);
    } else {
      throw err;
    }
  }

  const papers = listPapersForKarteNo(karte_no);
  const noPaper = noPaperFlag(patient.id);
  return htmlResponse(render(karte_no, patient, papers, noPaper, banner));
}
