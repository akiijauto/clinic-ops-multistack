import { findPatientForKarte, listVisitsForKarte } from '@/lib/karte';
import { renderKartePrint } from '@/lib/karte-render';
import { notFoundHtml } from '@/lib/area1/html';
import { ApiError } from '@/lib/errors';

type Params = { params: Promise<{ karte_no: string }> };

// GET /animals/{karte_no}/karte/print -- spec/openapi.yaml `screen_karte_print`.
// Renders the same visits/notes as `screen_karte` through the same
// `karte-render.ts` functions, so a value can't come out differently here
// (spec/acceptance.md 検算4).
export async function GET(_req: Request, { params }: Params): Promise<Response> {
  const { karte_no } = await params;
  try {
    const patient = findPatientForKarte(karte_no);
    const visits = listVisitsForKarte(patient.id);
    return renderKartePrint(patient, visits);
  } catch (e) {
    if (e instanceof ApiError && e.code === 'not_found') return notFoundHtml();
    throw e;
  }
}
