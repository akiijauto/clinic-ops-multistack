/**
 * Reservation overlap, from `spec/acceptance.md`「検算6」and `rulings.md` #6.
 *
 * Half-open interval: two slots overlap iff `starts1 < ends2 && starts2 <
 * ends1`. A slot ending exactly when the next one starts is NOT an overlap
 * (10:00-10:30 followed by 10:30-11:00 is fine). `cancelled` reservations
 * never count.
 */

export type ReservationSlot = {
  id?: number;
  starts_at: string; // ISO, comparable lexically since all values share the +09:00 convention
  ends_at: string;
  staff_id: number | null;
  room: string;
  status: 'booked' | 'cancelled';
};

function overlaps(a: { starts_at: string; ends_at: string }, b: { starts_at: string; ends_at: string }): boolean {
  return a.starts_at < b.ends_at && b.starts_at < a.ends_at;
}

/**
 * Finds a `booked` reservation that overlaps `candidate` on the same staff
 * member or the same room. `excludeId` lets an update check against every
 * *other* reservation. Returns the conflicting reservation, or `undefined`
 * if the slot is free.
 */
export function findConflict(
  candidate: Pick<ReservationSlot, 'starts_at' | 'ends_at' | 'staff_id' | 'room'>,
  existing: ReservationSlot[],
  excludeId?: number,
): ReservationSlot | undefined {
  return existing.find(
    (r) =>
      r.status === 'booked' &&
      r.id !== excludeId &&
      (r.staff_id === candidate.staff_id || r.room === candidate.room) &&
      overlaps(r, candidate),
  );
}

/** `ends_at` must be strictly after `starts_at` (spec/screens.md 19). */
export function isValidSpan(startsAt: string, endsAt: string): boolean {
  return startsAt < endsAt;
}
