import {
  findPatientForKarte,
  listVisitsForKarte,
  resolveCurrentVisit,
  createVisit,
  updateVisit,
  blankVisitDraft,
  type VisitInput,
  type ProgressNoteInput,
} from '@/lib/karte';
import { renderKarteScreen } from '@/lib/karte-render';
import { notFoundHtml } from '@/lib/area1/html';
import { ApiError } from '@/lib/errors';
import type { VisitWithNotes } from '@/lib/karte';

type Params = { params: Promise<{ karte_no: string }> };

function draftFromVisit(v: VisitWithNotes): VisitInput {
  return {
    visit_date: v.visit_date,
    visit_time: v.visit_time,
    body_weight_kg: v.body_weight_kg,
    chief_complaint: v.chief_complaint,
    symptom: v.symptom,
    diagnosis: v.diagnosis,
    treatment: v.treatment,
    staff_id: v.staff_id,
    notes: v.notes,
  };
}

// GET /animals/{karte_no}/karte -- spec/openapi.yaml `screen_karte`.
// ?visit_id= switches which past diagnosis is open (screens.md 9「診察の切替」).
export async function GET(req: Request, { params }: Params): Promise<Response> {
  const { karte_no } = await params;
  try {
    const patient = findPatientForKarte(karte_no);
    const visits = listVisitsForKarte(patient.id);
    const current = resolveCurrentVisit(patient.id, new URL(req.url).searchParams.get('visit_id'));
    const draft = current ? draftFromVisit(current) : blankVisitDraft();
    return renderKarteScreen(patient, visits, { visitId: current?.id ?? null, draft, current });
  } catch (e) {
    if (e instanceof ApiError && e.code === 'not_found') return notFoundHtml();
    throw e;
  }
}

/**
 * Reads `note_row_no` / `note_entry_date` / ... as parallel `getAll()`
 * arrays (one `<input>` per column per row in `karte-render.ts`'s edit
 * table) and zips them back into rows. A row with no `entry_date` is
 * dropped -- the extra blank rows the form always renders are spare
 * capacity, not required fields.
 */
function notesFromForm(form: FormData): ProgressNoteInput[] {
  const rowNos = form.getAll('note_row_no');
  const entryDates = form.getAll('note_entry_date');
  const temps = form.getAll('note_temperature_c');
  const pulses = form.getAll('note_pulse');
  const resps = form.getAll('note_respiration');
  const weights = form.getAll('note_body_weight_kg');
  const courses = form.getAll('note_symptom_course');
  const rxs = form.getAll('note_treatment_rx');
  const memos = form.getAll('note_note');

  const num = (v: FormDataEntryValue | undefined): number | null => {
    const s = String(v ?? '').trim();
    return s.length === 0 ? null : Number(s);
  };

  const rows: ProgressNoteInput[] = [];
  for (let i = 0; i < rowNos.length; i++) {
    const entryDate = String(entryDates[i] ?? '').trim();
    if (entryDate.length === 0) continue; // blank spare row -- not saved
    rows.push({
      row_no: Number(rowNos[i]) || i + 1,
      entry_date: entryDate,
      temperature_c: num(temps[i]),
      pulse: num(pulses[i]),
      respiration: num(resps[i]),
      body_weight_kg: num(weights[i]),
      symptom_course: String(courses[i] ?? ''),
      treatment_rx: String(rxs[i] ?? ''),
      note: String(memos[i] ?? ''),
    });
  }
  return rows;
}

function visitInputFromForm(form: FormData): VisitInput {
  const num = (v: FormDataEntryValue | null): number | null => {
    const s = String(v ?? '').trim();
    return s.length === 0 ? null : Number(s);
  };
  return {
    visit_date: String(form.get('visit_date') ?? ''),
    visit_time: String(form.get('visit_time') ?? '').trim() || null,
    body_weight_kg: num(form.get('body_weight_kg')),
    chief_complaint: String(form.get('chief_complaint') ?? ''),
    symptom: String(form.get('symptom') ?? ''),
    diagnosis: String(form.get('diagnosis') ?? ''),
    treatment: String(form.get('treatment') ?? ''),
    staff_id: num(form.get('staff_id')),
    notes: notesFromForm(form),
  };
}

// POST /animals/{karte_no}/karte -- spec/openapi.yaml `screen_save_karte`.
// `visit_id` present & non-empty = update that Visit; absent/empty = create
// a new one (this is what /karte/new's and /karte/copy_prev's forms submit).
export async function POST(req: Request, { params }: Params): Promise<Response> {
  const { karte_no } = await params;
  let patient;
  try {
    patient = findPatientForKarte(karte_no);
  } catch (e) {
    if (e instanceof ApiError && e.code === 'not_found') return notFoundHtml();
    throw e;
  }

  const form = await req.formData();
  const visitIdRaw = String(form.get('visit_id') ?? '').trim();
  const visitId = visitIdRaw.length > 0 ? Number(visitIdRaw) : null;
  const input = visitInputFromForm(form);
  const visits = listVisitsForKarte(patient.id);

  try {
    const saved = visitId !== null ? updateVisit(patient.id, visitId, input) : createVisit(patient.id, input);
    const freshVisits = listVisitsForKarte(patient.id);
    return renderKarteScreen(
      patient,
      freshVisits,
      { visitId: saved.id, draft: draftFromVisit(saved), current: saved },
      { kind: 'success', message: '保存しました。' },
    );
  } catch (e) {
    if (e instanceof ApiError) {
      // spec/screens.md 9「保存を断ったときは、打った値をそのままフォームへ
      // 返す（確定済みの値で上書きしない）」-- re-render with what was typed,
      // not with a fresh DB read.
      return renderKarteScreen(
        patient,
        visits,
        { visitId, draft: input },
        { kind: 'error', message: e.message },
      );
    }
    throw e;
  }
}
