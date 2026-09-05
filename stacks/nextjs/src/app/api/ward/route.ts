import { hospitalizationsActiveOn } from '../../_area4/repo';
import { todayJst } from '@/lib/jst';

// GET /api/ward?date=YYYY-MM-DD -- spec/openapi.yaml `api_ward_day`.
// Patients hospitalized on `date` (default: today JST): admitted_on <= date
// <= discharged_on, or still admitted (discharged_on is null).
export function GET(req: Request): Response {
  const url = new URL(req.url);
  const date = url.searchParams.get('date') ?? todayJst();
  const items = hospitalizationsActiveOn(date);
  return Response.json({ items, total: items.length });
}
