import { findPatientForKarte, listVisitsForKarte } from '@/lib/karte';
import { renderKarteScreen } from '@/lib/karte-render';
import { notFoundHtml } from '@/lib/area1/html';
import { ApiError } from '@/lib/errors';

type Params = { params: Promise<{ karte_no: string }> };

// GET /animals/{karte_no}/karte -- spec/openapi.yaml `screen_karte`.
export async function GET(_req: Request, { params }: Params): Promise<Response> {
  const { karte_no } = await params;
  try {
    const patient = findPatientForKarte(karte_no);
    const visits = listVisitsForKarte(patient.id);
    return renderKarteScreen(patient, visits);
  } catch (e) {
    if (e instanceof ApiError && e.code === 'not_found') return notFoundHtml();
    throw e;
  }
}
