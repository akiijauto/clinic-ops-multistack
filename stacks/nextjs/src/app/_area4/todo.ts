/**
 * `/todo/{key}` (spec/screens.md 20) and `/api/todo/{key}` (spec/openapi.yaml)
 * both answer the same question: "why doesn't this 状態C button do
 * anything?" It is a single, generic lookup by `key` -- **not** a page that
 * hardcodes area4's own screens, because every area's 状態C buttons land
 * here (`spec/screens.md`「共通の約束」: 状態C = 押せる見た目のまま、押すと
 * 個別の理由が読める). Only area4 owns this route; other areas just need to
 * link to a `key` that exists in this table.
 *
 * `spec/openapi.yaml`'s description of `/todo/{key}` names three known
 * buttons verbatim: 一時保存／完了全削除／完了削除. Two are area1's (本日の
 * 患者), one looks like area2's (カルテ). Their exact `key` strings were
 * proposed to those lanes (see SendMessage history); if they chose
 * different ones, add/replace the matching entry below.
 *
 * Unknown keys are a 404 on purpose (spec: "画面から辿れる key は必ず存在
 * するものだけにする" -- a link with no matching entry here would be a dead
 * link, which is exactly what area4 was told not to create for its own
 * buttons, and the same rule applies to whoever calls in from elsewhere).
 */

export type TodoReason = {
  key: string;
  title: string;
  message: string;
};

const REASONS: Record<string, TodoReason> = {
  'reception-complete-delete-all': {
    key: 'reception-complete-delete-all',
    title: '完了全削除（本日の患者）',
    message:
      '完了した受付をまとめて消すと、その日の受付件数を後から数えられなくなるため、' +
      'この企画では意図して押せなくしてあります（状態C）。完了行は「完了表示」の' +
      '切替で隠すだけにしてください。',
  },
  'reception-complete-delete': {
    key: 'reception-complete-delete',
    title: '完了削除（本日の患者）',
    message:
      '完了した受付を1件消すと、その日の受付件数を後から数えられなくなるため、' +
      'この企画では意図して押せなくしてあります（状態C）。完了行は「完了表示」の' +
      '切替で隠すだけにしてください。',
  },
  'karte-temp-save': {
    key: 'karte-temp-save',
    title: '一時保存（カルテ）',
    message:
      '書きかけの内容を仮保存する操作は、この企画では意図して押せなくしてあります' +
      '（状態C）。カルテの保存は常に確定した内容を保存する「保存」操作のみです。' +
      '書きかけを自動で保存し続ける機能（KarteDraft）はスコープ自体から外して' +
      'あります（状態B・「折りたたみ表示」参照）。',
  },
};

export function getTodoReason(key: string): TodoReason | undefined {
  return REASONS[key];
}
