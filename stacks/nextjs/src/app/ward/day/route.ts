import { renderWardDay } from '../../_area4/ward-screen';
import { todayJst } from '@/lib/jst';

// GET /ward/day?date=YYYY-MM-DD -- spec/screens.md「18. 入院」の一覧側 (指定日)。
export function GET(req: Request): Response {
  const url = new URL(req.url);
  const date = url.searchParams.get('date') ?? todayJst();
  return renderWardDay(date);
}
