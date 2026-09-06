import { findPatientByKarteNo } from '../../_area4/repo';
import { renderForm } from '../../_area4/reservation-screen';
import { page, htmlResponse } from '@/lib/area1/html';

// GET /reservations/new?karte_no=... -- spec/openapi.yaml `screen_reservation_new_form`.
export function GET(req: Request): Response {
  const url = new URL(req.url);
  const karteNo = url.searchParams.get('karte_no');
  const patient = karteNo ? findPatientByKarteNo(karteNo) : undefined;

  const body = renderForm({ mode: 'new', values: patient ? { patient_id: String(patient.id) } : undefined });
  return htmlResponse(page({ title: '予約（新規）', screenKey: 'screen-reservations', body }));
}
