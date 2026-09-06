import { findPatientForKarte, resolveCurrentVisit } from '@/lib/karte';
import { renderVisitPrint, noVisitPrint } from '@/lib/karte-render';
import { notFoundHtml } from '@/lib/area1/html';
import { ApiError } from '@/lib/errors';

type Params = { params: Promise<{ karte_no: string }> };

/**
 * GET /animals/{karte_no}/karte/print -- spec/openapi.yaml `screen_karte_print`.
 *
 * Prints "いま保存されている内容" (spec/screens.md 9) -- i.e. whichever Visit
 * `/karte`'s `?visit_id=` (or its default, the latest) currently has open --
 * through `resolveCurrentVisit()`, the exact same resolution `/karte` uses.
 *
 * This used to print every Visit concatenated, while `/karte` showed only
 * the current one; spec/acceptance.md 検算4 caught the two pages disagreeing
 * for patients with more than one Visit (10002: latest visit's temperature
 * vs. all visits' temperatures is a different value *set*, not just a
 * differently-computed number). Resolving "current" through one function
 * removes the second place a scope decision could be made.
 *
 * `/karte/{visit_id}/print` (same `renderVisitPrint`) stays separate: an
 * explicit, stable link to one past visit from the history list, regardless
 * of which visit happens to be "current" right now.
 */
export async function GET(req: Request, { params }: Params): Promise<Response> {
  const { karte_no } = await params;
  try {
    const patient = findPatientForKarte(karte_no);
    const current = resolveCurrentVisit(patient.id, new URL(req.url).searchParams.get('visit_id'));
    return current ? renderVisitPrint(patient, current) : noVisitPrint(patient);
  } catch (e) {
    if (e instanceof ApiError && e.code === 'not_found') return notFoundHtml();
    throw e;
  }
}
