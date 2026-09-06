import { getDb } from '@/lib/db';
import { getPatientByKarteNo } from '@/lib/area1/data';
import { listVisitsForKarteNo } from '@/lib/area1/data';
import { createVisit } from '@/lib/karte';
import { withApiErrors, ApiError } from '@/lib/errors';
import type { VisitInput, ProgressNoteInput } from '@/lib/karte';

type Params = { params: Promise<{ karte_no: string }> };

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

// GET /api/patients/{karte_no}/visits -- spec/openapi.yaml `api_list_visits`.
export async function GET(req: Request, { params }: Params): Promise<Response> {
  return withApiErrors(async () => {
    const { karte_no } = await params;
    const patient = getPatientByKarteNo(getDb(), karte_no);
    if (!patient) throw new ApiError('not_found');
    const url = new URL(req.url);
    const includeDeleted = url.searchParams.get('include_deleted') === 'true';
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? '50') || 50, 1), 200);
    const offset = Math.max(Number(url.searchParams.get('offset') ?? '0') || 0, 0);
    const all = listVisitsForKarteNo(getDb(), karte_no, includeDeleted);
    return Response.json({ items: all.slice(offset, offset + limit), total: all.length });
  });
}

// POST /api/patients/{karte_no}/visits -- spec/openapi.yaml `api_create_visit`.
// Same `createVisit()` the /karte screen's save form uses -- one save path.
export async function POST(req: Request, { params }: Params): Promise<Response> {
  return withApiErrors(async () => {
    const { karte_no } = await params;
    const patient = getPatientByKarteNo(getDb(), karte_no);
    if (!patient) throw new ApiError('not_found');

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      throw new ApiError('invalid_json');
    }
    const b = (body ?? {}) as Record<string, unknown>;
    const notesRaw = Array.isArray(b.progress_notes) ? b.progress_notes : [];
    const input: VisitInput = {
      visit_date: typeof b.visit_date === 'string' ? b.visit_date : '',
      visit_time: typeof b.visit_time === 'string' ? b.visit_time : null,
      body_weight_kg: typeof b.body_weight_kg === 'number' ? b.body_weight_kg : null,
      chief_complaint: typeof b.chief_complaint === 'string' ? b.chief_complaint : '',
      symptom: typeof b.symptom === 'string' ? b.symptom : '',
      diagnosis: typeof b.diagnosis === 'string' ? b.diagnosis : '',
      treatment: typeof b.treatment === 'string' ? b.treatment : '',
      staff_id: typeof b.staff_id === 'number' ? b.staff_id : null,
      notes: notesRaw.map(toProgressNoteInput),
    };
    const visit = createVisit(patient.id, input);
    // openapi.yaml `Visit.progress_notes`, not `notes` (karte.ts's internal shape).
    const { notes, ...rest } = visit;
    return Response.json({ ...rest, progress_notes: notes }, { status: 201 });
  });
}
