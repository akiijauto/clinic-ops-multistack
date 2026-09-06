import { getDb } from '@/lib/db';
import { getPatientWithOwner, getPatientById } from '@/lib/area1/data';
import { listBillingsByPatient, listBillingsByOwner, listAllBillings, type BillingWire } from '@/lib/billing';
import { renderAccountingHistoryScreen } from '@/lib/billing-render';
import { notFoundHtml } from '@/lib/area1/html';

type Params = { params: Promise<{ karte_no: string }> };

type Scope = 'patient' | 'owner' | 'all';

function parseScope(raw: string | null): Scope {
  return raw === 'owner' || raw === 'all' ? raw : 'patient';
}

/** Attaches each billing's own karte_no (`billing-render.ts`'s note on why owner/all rows can't all share `patient`'s). */
function withKarteNo(db: ReturnType<typeof getDb>, items: BillingWire[]): (BillingWire & { karte_no: string })[] {
  const cache = new Map<number, string>();
  return items.map((b) => {
    let karteNo = cache.get(b.patient_id);
    if (karteNo === undefined) {
      karteNo = getPatientById(db, b.patient_id)?.karte_no ?? '';
      cache.set(b.patient_id, karteNo);
    }
    return { ...b, karte_no: karteNo };
  });
}

// GET /animals/{karte_no}/accounting/history -- spec/openapi.yaml `screen_accounting_history`.
export async function GET(req: Request, { params }: Params): Promise<Response> {
  const { karte_no } = await params;
  const db = getDb();
  const patient = getPatientWithOwner(db, karte_no);
  if (!patient) return notFoundHtml();

  const scope = parseScope(new URL(req.url).searchParams.get('scope'));
  const { items } =
    scope === 'owner'
      ? listBillingsByOwner(patient.owner.owner_no, 1000, 0)
      : scope === 'all'
        ? listAllBillings(undefined, undefined, 1000, 0)
        : listBillingsByPatient(karte_no, 1000, 0);

  return renderAccountingHistoryScreen({ patient, scope, billings: withKarteNo(db, items) });
}
