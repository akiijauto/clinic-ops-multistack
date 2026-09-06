import { findPatientForKarte, listVisitsForKarte, draftFromPreviousVisit, blankVisitDraft } from '@/lib/karte';
import { renderKarteScreen } from '@/lib/karte-render';
import { notFoundHtml } from '@/lib/area1/html';
import { ApiError } from '@/lib/errors';

type Params = { params: Promise<{ karte_no: string }> };

// GET /animals/{karte_no}/karte/copy_prev -- spec/openapi.yaml
// `screen_karte_copy_prev`. "直前の診察が無いときだけ灰色でよい" is the
// *link into* this screen (from `/karte`); the route itself always answers
// 200 -- with no previous visit it degrades to the same blank form `/new`
// shows, which is a legitimate state, not an error.
export async function GET(_req: Request, { params }: Params): Promise<Response> {
  const { karte_no } = await params;
  try {
    const patient = findPatientForKarte(karte_no);
    const visits = listVisitsForKarte(patient.id);
    const draft = draftFromPreviousVisit(patient.id) ?? blankVisitDraft();
    return renderKarteScreen(patient, visits, { visitId: null, draft });
  } catch (e) {
    if (e instanceof ApiError && e.code === 'not_found') return notFoundHtml();
    throw e;
  }
}
