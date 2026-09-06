import { renderWardDay } from '../_area4/ward-screen';
import { todayJst } from '@/lib/jst';

// GET /ward -- spec/screens.md「18. 入院」の一覧側 (本日時点)。
export function GET(): Response {
  return renderWardDay(todayJst());
}
