import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { findConflict, isValidSpan, type ReservationSlot } from '../src/lib/reservation.ts';

test('half-open interval: back-to-back slots (end == next start) do not conflict', () => {
  const existing: ReservationSlot[] = [
    { id: 1, starts_at: '2026-09-05T10:00:00+09:00', ends_at: '2026-09-05T10:30:00+09:00', staff_id: 1, room: 'A', status: 'booked' },
  ];
  const conflict = findConflict(
    { starts_at: '2026-09-05T10:30:00+09:00', ends_at: '2026-09-05T11:00:00+09:00', staff_id: 1, room: 'A' },
    existing,
  );
  assert.equal(conflict, undefined);
});

test('an actually overlapping slot for the same staff is rejected', () => {
  const existing: ReservationSlot[] = [
    { id: 1, starts_at: '2026-09-05T10:00:00+09:00', ends_at: '2026-09-05T10:30:00+09:00', staff_id: 1, room: 'A', status: 'booked' },
  ];
  const conflict = findConflict(
    { starts_at: '2026-09-05T10:15:00+09:00', ends_at: '2026-09-05T10:45:00+09:00', staff_id: 1, room: 'B' },
    existing,
  );
  assert.equal(conflict?.id, 1);
});

test('an overlapping slot for a different staff and a different room does not conflict', () => {
  const existing: ReservationSlot[] = [
    { id: 1, starts_at: '2026-09-05T10:00:00+09:00', ends_at: '2026-09-05T10:30:00+09:00', staff_id: 1, room: 'A', status: 'booked' },
  ];
  const conflict = findConflict(
    { starts_at: '2026-09-05T10:15:00+09:00', ends_at: '2026-09-05T10:45:00+09:00', staff_id: 2, room: 'B' },
    existing,
  );
  assert.equal(conflict, undefined);
});

test('a cancelled reservation never conflicts, even for an identical slot', () => {
  const existing: ReservationSlot[] = [
    { id: 1, starts_at: '2026-09-05T10:00:00+09:00', ends_at: '2026-09-05T10:30:00+09:00', staff_id: 1, room: 'A', status: 'cancelled' },
  ];
  const conflict = findConflict(
    { starts_at: '2026-09-05T10:00:00+09:00', ends_at: '2026-09-05T10:30:00+09:00', staff_id: 1, room: 'A' },
    existing,
  );
  assert.equal(conflict, undefined);
});

test('an update excludes itself from the conflict check via excludeId', () => {
  const existing: ReservationSlot[] = [
    { id: 1, starts_at: '2026-09-05T10:00:00+09:00', ends_at: '2026-09-05T10:30:00+09:00', staff_id: 1, room: 'A', status: 'booked' },
  ];
  const conflict = findConflict(
    { starts_at: '2026-09-05T10:00:00+09:00', ends_at: '2026-09-05T10:30:00+09:00', staff_id: 1, room: 'A' },
    existing,
    1,
  );
  assert.equal(conflict, undefined);
});

test('isValidSpan rejects equal or reversed start/end', () => {
  assert.equal(isValidSpan('2026-09-05T10:00:00+09:00', '2026-09-05T10:30:00+09:00'), true);
  assert.equal(isValidSpan('2026-09-05T10:00:00+09:00', '2026-09-05T10:00:00+09:00'), false);
  assert.equal(isValidSpan('2026-09-05T10:30:00+09:00', '2026-09-05T10:00:00+09:00'), false);
});

test('検算6: the shared fixture itself has zero staff/room overlaps among booked reservations', () => {
  const seed = JSON.parse(
    readFileSync(resolve(import.meta.dirname, '../../../data/seed.json'), 'utf8'),
  ) as { reservations: ReservationSlot[] };

  const booked = seed.reservations.filter((r) => r.status === 'booked');
  assert.ok(booked.length > 0, 'fixture has no booked reservations to check');

  for (const r of booked) {
    const others = booked.filter((o) => o !== r);
    const conflict = findConflict(r, others, r.id);
    assert.equal(conflict, undefined, `reservation ${r.id} conflicts with ${conflict?.id}`);
  }
});
