import { getTodoReason } from '../../_area4/todo';
import { page, htmlResponse, escapeHtml } from '@/lib/area1/html';

type Params = { params: Promise<{ key: string }> };

// GET /todo/{key} -- spec/screens.md「20. ToDo（個別の理由表示）」.
// The landing page for every area's 状態C buttons (screens.md「共通の約束」),
// not just area4's own -- see `_area4/todo.ts` for the reason lookup and how
// `key` strings are coordinated across areas.
export async function GET(_req: Request, { params }: Params): Promise<Response> {
  const { key } = await params;
  const reason = getTodoReason(key);

  if (!reason) return notFound();

  const body = `
<p>${escapeHtml(reason.message)}</p>
<p><a href="/settings/features">この企画で作らないと決めた機能の一覧へ</a></p>
<p><a href="/today">本日の患者へ戻る</a></p>`;

  return htmlResponse(page({ title: reason.title, screenKey: 'screen-todo', body }));
}

function notFound(): Response {
  return new Response(
    `<!doctype html><html><body><p data-testid="error-banner">指定されたデータが見つかりません。</p></body></html>`,
    { status: 404, headers: { 'content-type': 'text/html; charset=utf-8' } },
  );
}
