import { getDb } from '@/lib/db';
import { getVisitWithNotes } from '@/lib/area1/data';
import { updateVisit } from '@/lib/karte';
import { withApiErrors, ApiError } from '@/lib/errors';
import type { VisitInput, ProgressNoteInput } from '@/lib/karte';

type Params = { params: Promise<{ visit_id: string }> };

function parseId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id)) throw new ApiError('not_found');
  return id;
}

function toProgressNoteInput(raw: unknown, i: number): ProgressNoteInput {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    row_no: typeof r.row_no === 'number' ? r.row_no : i + 1,
    entry_date: typeof r.entry_date === 'string' ? r.entry_date : '',
    temperature_c: typeof r.temperature_c === 'number' ? r.temperature_c : null,
    pulse: typeof r.pulse === 'number' ? r.pulse : null,
    respiration: typeof r.respiration === 'number' ? r.respiration : null,
    body_weight_kg: typeof r.body_weight_kg === 'number' ? r.body_weight_kg : null,
    symptom_course: typeof r.symptom_course === 'string' ? r.symptom_course : '',
    treatment_rx: typeof r.treatment_rx === 'string' ? r.treatment_rx : '',
    note: typeof r.note === 'string' ? r.note : '',
  };
}

/**
 * GET /api/visits/{visit_id} -- spec/openapi.yaml `api_get_visit`, 検算9.
 *
 * Deliberately does not filter on `deleted_at`: a soft-deleted Visit
 * disappears from *listings* (karte, search, 来院履歴), not from direct
 * lookup by id -- spec/acceptance.md 検算9 ("消したものが数に残る").
 */
export async function GET(_req: Request, { params }: Params): Promise<Response> {
  return withApiErrors(async () => {
    const { visit_id } = await params;
    const v = getVisitWithNotes(getDb(), parseId(visit_id));
    if (!v) throw new ApiError('not_found');
    return Response.json(v);
  });
}

// PATCH /api/visits/{visit_id} -- spec/openapi.yaml `api_update_visit`.
// Same `updateVisit()` the /karte screen's save form uses for an existing
// Visit -- one save path shared by the screen and the API.
export async function PATCH(req: Request, { params }: Params): Promise<Response> {
  return withApiErrors(async () => {
    const { visit_id } = await params;
    const id = parseId(visit_id);
    const before = getVisitWithNotes(getDb(), id);
    if (!before) throw new ApiError('not_found');

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      throw new ApiError('invalid_json');
    }
    const b = (body ?? {}) as Record<string, unknown>;
    const notesRaw = Array.isArray(b.progress_notes) ? b.progress_notes : before.progress_notes;
    const input: VisitInput = {
      visit_date: typeof b.visit_date === 'string' ? b.visit_date : before.visit_date,
      visit_time: typeof b.visit_time === 'string' ? b.visit_time : before.visit_time,
      body_weight_kg: typeof b.body_weight_kg === 'number' ? b.body_weight_kg : before.body_weight_kg,
      chief_complaint: typeof b.chief_complaint === 'string' ? b.chief_complaint : before.chief_complaint,
      symptom: typeof b.symptom === 'string' ? b.symptom : before.symptom,
      diagnosis: typeof b.diagnosis === 'string' ? b.diagnosis : before.diagnosis,
      treatment: typeof b.treatment === 'string' ? b.treatment : before.treatment,
      staff_id: typeof b.staff_id === 'number' ? b.staff_id : before.staff_id,
      notes: notesRaw.map(toProgressNoteInput),
    };
    const after = updateVisit(before.patient_id, id, input);
    const { notes, ...rest } = after;
    return Response.json({ ...rest, progress_notes: notes });
  });
}
