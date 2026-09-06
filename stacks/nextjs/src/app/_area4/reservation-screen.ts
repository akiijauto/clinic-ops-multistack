import { listReservations, findPatientById, listStaff, type ReservationFilter } from './repo';
import { escapeHtml } from '@/lib/area1/html';
import type { Reservation } from '@/lib/model';

/**
 * Shared rendering for `/reservations`, `/reservations/new` and
 * `/reservations/{id}` -- spec design note #6 treats these as **one screen**
 * (list + inline create/edit), which is why every one of their
 * `x-data-testids` shares the same container id `screen-reservations`.
 */

function staffOptions(selected?: number): string {
  return listStaff(true)
    .map((s) => `<option value="${s.id}"${s.id === selected ? ' selected' : ''}>${escapeHtml(s.name)}</option>`)
    .join('');
}

export function renderList(filter: ReservationFilter, banner = ''): string {
  const { items, total } = listReservations(filter);
  const rowsHtml = items
    .map((r) => {
      const patient = findPatientById(r.patient_id);
      return `<tr data-testid="row-reservation">
  <td><a href="/reservations/${r.id}">${escapeHtml(r.starts_at)}</a></td>
  <td>${escapeHtml(r.ends_at)}</td>
  <td>${patient ? escapeHtml(`${patient.karte_no} ${patient.name_kanji}`) : escapeHtml(String(r.patient_id))}</td>
  <td>${escapeHtml(String(r.staff_id))}</td>
  <td>${escapeHtml(r.room)}</td>
  <td>${escapeHtml(r.purpose)}</td>
  <td>${escapeHtml(r.status)}</td>
</tr>`;
    })
    .join('\n');

  return `
${banner}
<p><a href="/reservations/new">新規予約</a></p>
<form method="get" action="/reservations">
  <label>期間 <input type="date" name="from" value="${escapeHtml(filter.from ?? '')}"> 〜 <input type="date" name="to" value="${escapeHtml(filter.to ?? '')}"></label>
  <label>担当 <input type="number" name="staff_id" value="${filter.staff_id ?? ''}"></label>
  <label>処置室 <input type="text" name="room" value="${escapeHtml(filter.room ?? '')}"></label>
  <button type="submit">絞り込み</button>
</form>
<p>件数: ${total}</p>
<table>
  <thead><tr><th>開始</th><th>終了</th><th>患者</th><th>担当</th><th>処置室</th><th>目的</th><th>状態</th></tr></thead>
  <tbody>${rowsHtml || '<tr data-testid="empty-reservation"><td colspan="7">予約はまだありません。</td></tr>'}</tbody>
</table>`;
}

export type ReservationFormValues = {
  patient_id?: string;
  starts_at?: string;
  ends_at?: string;
  staff_id?: string;
  room?: string;
  purpose?: string;
  note?: string;
};

/** `<input type="datetime-local">` wants `YYYY-MM-DDTHH:mm`, not the stored `...+09:00` ISO string. */
function toDatetimeLocal(iso: string): string {
  return iso.slice(0, 16);
}

/**
 * The inverse, for a form POST: a browser's `datetime-local` value
 * (`YYYY-MM-DDTHH:mm`, no seconds, no offset) back into this lane's stored
 * convention (`...+09:00`, seconds included) -- every reservation in the DB
 * carries that suffix and `reservation.ts` compares them lexically, so a
 * screen-submitted value that skipped this would silently sort wrong.
 * Screens in this app only ever run in JST, so the local value already *is*
 * JST wall-clock time; this just adds back what the input type strips.
 */
export function fromDatetimeLocal(v: string): string {
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) return `${v}:00+09:00`;
  return v;
}

function valuesFromReservation(r: Reservation): ReservationFormValues {
  return {
    patient_id: String(r.patient_id),
    starts_at: toDatetimeLocal(r.starts_at),
    ends_at: toDatetimeLocal(r.ends_at),
    staff_id: String(r.staff_id),
    room: r.room,
    purpose: r.purpose,
    note: r.note,
  };
}

export function renderForm(opts: {
  mode: 'new' | 'edit';
  reservation?: Reservation;
  values?: ReservationFormValues;
  banner?: string;
}): string {
  const { mode, reservation, banner = '' } = opts;
  const values = opts.values ?? (reservation ? valuesFromReservation(reservation) : {});
  const action = mode === 'new' ? '/reservations' : `/reservations/${reservation!.id}`;
  const staffId = values.staff_id ? Number(values.staff_id) : undefined;

  const cancelForm =
    mode === 'edit' && reservation && reservation.status === 'booked'
      ? `<form method="post" action="/reservations/${reservation.id}/cancel">
  <button type="submit">この予約を取り消す</button>
</form>`
      : '';

  return `
${banner}
<p><a href="/reservations">一覧へ戻る</a></p>
${reservation ? `<p>状態: ${escapeHtml(reservation.status)}</p>` : ''}
<form method="post" action="${action}">
  <label>患者ID(karte_noの動物のid) <input type="number" name="patient_id" value="${escapeHtml(values.patient_id ?? '')}" required></label>
  <label>開始 <input type="datetime-local" name="starts_at" value="${escapeHtml(values.starts_at ?? '')}" required></label>
  <label>終了 <input type="datetime-local" name="ends_at" value="${escapeHtml(values.ends_at ?? '')}" required></label>
  <label>担当 <select name="staff_id" required><option value="">選択してください</option>${staffOptions(staffId)}</select></label>
  <label>処置室 <input type="text" name="room" value="${escapeHtml(values.room ?? '')}" required></label>
  <label>目的 <input type="text" name="purpose" value="${escapeHtml(values.purpose ?? '')}"></label>
  <label>メモ <input type="text" name="note" value="${escapeHtml(values.note ?? '')}"></label>
  <button type="submit">${mode === 'new' ? '予約を登録' : '予約を変更'}</button>
</form>
${cancelForm}`;
}
