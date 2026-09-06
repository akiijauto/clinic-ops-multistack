import { findPatientForKarte, listVisitsForKarte, latestVisitForKarte, blankVisitDraft } from '@/lib/karte';
import { renderKarteScreen } from '@/lib/karte-render';
import { notFoundHtml } from '@/lib/area1/html';
import { ApiError } from '@/lib/errors';

type Params = { params: Promise<{ karte_no: string }> };

/**
 * POST /animals/{karte_no}/karte/cancel -- spec/openapi.yaml
 * `screen_karte_cancel`. "捨てる書きかけが無いときだけ灰色でよい" describes
 * the *link*, same as copy_prev. There is no server-held draft to discard
 * (`KarteDraft`/自動保存 is dropped entirely per spec/model.md「落としたもの」
 * -- this app never writes an unsaved value anywhere), so this always
 * succeeds: it just re-renders the plain screen with a success banner.
 */
export async function POST(_req: Request, { params }: Params): Promise<Response> {
  const { karte_no } = await params;
  try {
    const patient = findPatientForKarte(karte_no);
    const visits = listVisitsForKarte(patient.id);
    const current = latestVisitForKarte(patient.id);
    const draft = current
      ? {
          visit_date: current.visit_date,
          visit_time: current.visit_time,
          body_weight_kg: current.body_weight_kg,
          chief_complaint: current.chief_complaint,
          symptom: current.symptom,
          diagnosis: current.diagnosis,
          treatment: current.treatment,
          staff_id: current.staff_id,
          notes: current.notes,
        }
      : blankVisitDraft();
    return renderKarteScreen(
      patient,
      visits,
      { visitId: current?.id ?? null, draft, current },
      { kind: 'success', message: '書きかけの入力を取り消しました。' },
    );
  } catch (e) {
    if (e instanceof ApiError && e.code === 'not_found') return notFoundHtml();
    throw e;
  }
}
