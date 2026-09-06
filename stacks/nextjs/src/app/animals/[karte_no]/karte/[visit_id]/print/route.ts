import { findPatientForKarte, findVisitInKarte } from '@/lib/karte';
import { renderVisitPrint } from '@/lib/karte-render';
import { notFoundHtml } from '@/lib/area1/html';
import { ApiError } from '@/lib/errors';

type Params = { params: Promise<{ karte_no: string; visit_id: string }> };

// GET /animals/{karte_no}/karte/{visit_id}/print -- spec/openapi.yaml
// `screen_visit_print`. Reuses `findVisitInKarte`/`visitBlock` from the same
// module the main screen uses, so this can't independently disagree with it
// (spec/acceptance.md 検算4).
export async function GET(_req: Request, { params }: Params): Promise<Response> {
  const { karte_no, visit_id } = await params;
  const id = Number(visit_id);
  if (!Number.isInteger(id)) return notFoundHtml();
  try {
    const patient = findPatientForKarte(karte_no);
    const visit = findVisitInKarte(patient.id, id);
    if (!visit) return notFoundHtml();
    return renderVisitPrint(patient, visit);
  } catch (e) {
    if (e instanceof ApiError && e.code === 'not_found') return notFoundHtml();
    throw e;
  }
}
