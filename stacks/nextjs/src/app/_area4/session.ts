import { cookies } from 'next/headers';

/**
 * "Who's using this terminal" (spec/screens.md 21｜スタッフ). This is
 * explicitly NOT authentication (`coordination/DECISIONS.md`): there is no
 * server-side session, just a plain cookie remembering the last staff
 * picked, so it survives navigating to another screen (spec's requirement)
 * without blocking anything when it's empty.
 *
 * Cookie name is `clinic_staff_id` -- documented here so any other area that
 * wants to default a "担当" field to the current picker can read the same
 * cookie instead of inventing a second one.
 */
const COOKIE_NAME = 'clinic_staff_id';

export async function getSelectedStaffId(): Promise<number | null> {
  const jar = await cookies();
  const raw = jar.get(COOKIE_NAME)?.value;
  if (!raw) return null;
  const n = Number(raw);
  return Number.isInteger(n) ? n : null;
}

export async function setSelectedStaffId(staffId: number | null): Promise<void> {
  const jar = await cookies();
  if (staffId === null) {
    jar.delete(COOKIE_NAME);
  } else {
    jar.set(COOKIE_NAME, String(staffId), { path: '/', sameSite: 'lax' });
  }
}
