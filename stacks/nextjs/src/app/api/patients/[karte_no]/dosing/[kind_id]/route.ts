import { getPatientByKarteNo } from '@/lib/area1/data';
import { getDb } from '@/lib/db';
import { requireDosingKind, getDosingYear, saveDosingYear, MONTH_KEYS, type MonthMarks } from '@/lib/clinical/dosing';
import type { Dosing } from '@/lib/model';
import { withApiErrors, ApiError, parseJsonBody } from '@/lib/errors';

type Params = { params: Promise<{ karte_no: string; kind_id: string }> };

function requirePatient(karteNo: string) {
  const p = getPatientByKarteNo(getDb(), karteNo);
  if (!p) throw new ApiError('not_found');
  return p;
}

function currentFiscalYear(): number {
  return new Date().getFullYear();
}

/** A not-yet-created fiscal year has every month blank, not a 404 -- 404 is
 * for an unknown patient/kind only. Every check across the multi-stack
 * comparison (`stacks/laravel`'s `DosingController::show` does the same
 * `firstOrNew`-style fallback) treats "no row for this year" as "an empty
 * year", since screens.md 11's own screen shows a blank year for
 * fiscal_year values with no saved row yet. */
function blankDosing(patientId: number, kindCode: string, fiscalYear: number): Omit<Dosing, 'id'> & { id: null } {
  const blank = Object.fromEntries(MONTH_KEYS.map((k) => [k, ''])) as Record<(typeof MONTH_KEYS)[number], string>;
  return { id: null, patient_id: patientId, kind: kindCode, fiscal_year: fiscalYear, ...blank };
}

// GET /api/patients/{karte_no}/dosing/{kind_id} -- spec/openapi.yaml `api_get_dosing`.
export async function GET(req: Request, { params }: Params): Promise<Response> {
  return withApiErrors(async () => {
    const { karte_no, kind_id } = await params;
    const patient = requirePatient(karte_no);
    const kind = requireDosingKind(kind_id);
    const url = new URL(req.url);
    const fiscalYearParam = url.searchParams.get('fiscal_year');
    const fiscalYear = fiscalYearParam ? Number(fiscalYearParam) : currentFiscalYear();
    const row = getDosingYear(patient.id, kind.code, fiscalYear);
    return Response.json(row ?? blankDosing(patient.id, kind.code, fiscalYear));
  });
}

// PATCH /api/patients/{karte_no}/dosing/{kind_id} -- spec/openapi.yaml `api_update_dosing`.
// The `Dosing` body carries its own `fiscal_year` (there is no separate query
// param on this method), matching screens.md 11「送られなかった月」と「外した
// 月」を混同しない -- every m01..m12 key is read explicitly, defaulting an
// absent one to '', same rule `saveDosingYear` documents for the screen form.
export async function PATCH(req: Request, { params }: Params): Promise<Response> {
  return withApiErrors(async () => {
    const { karte_no, kind_id } = await params;
    const patient = requirePatient(karte_no);
    const kind = requireDosingKind(kind_id);
    const body = (await parseJsonBody(req)) as Record<string, unknown>;
    const fiscalYear = typeof body.fiscal_year === 'number' ? body.fiscal_year : undefined;
    if (fiscalYear === undefined) {
      throw new ApiError('invalid_input', [{ field: 'fiscal_year', message: '年度（fiscal_year）は必須です。' }]);
    }
    const marks: MonthMarks = {};
    for (const key of MONTH_KEYS) {
      const v = body[key];
      marks[key] = typeof v === 'string' ? v : '';
    }
    const saved = saveDosingYear(patient.id, kind.code, fiscalYear, marks);
    return Response.json(saved);
  });
}
