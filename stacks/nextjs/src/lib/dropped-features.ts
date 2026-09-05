/**
 * The single source of truth for "what this project deliberately did not
 * build" (`spec/model.md`「落としたもの」).
 *
 * Two screens must show the same content from the same list
 * (`spec/screens.md` 7「折りたたみ表示」/ 23「機能設定」), and one API
 * mirrors it (`spec/openapi.yaml` `/api/features`, schema `FeatureNote`).
 * Rather than each place re-typing the ten rows and risking a mismatch,
 * every consumer imports this array.
 *
 * `kind` is always `'folded'` here: these are whole features this project's
 * scope excludes (`spec/screens.md`「状態B」), not the per-button `'todo'`
 * notes for individual disabled actions (`spec/screens.md`「状態C」/
 * screen 20), which live with the screens that own those buttons.
 */

export type FeatureNote = {
  key: string;
  kind: 'todo' | 'folded';
  title: string;
  message: string;
};

export const DROPPED_FEATURES: FeatureNote[] = [
  {
    key: 'hospital_division',
    kind: 'folded',
    title: '分院（hospital_division）',
    message:
      '病院は1件だけ扱う。複数拠点は比較の題材にならないため、この企画では作っていません。' +
      '「本日の患者」など一覧画面に分院を選ぶ欄はありません。',
  },
  {
    key: 'clinic_feature',
    kind: 'folded',
    title: 'ClinicFeature（機能の出し分け）',
    message:
      '題材の運用固有の事情であり、他所で意味を持たないため落としました。' +
      'この画面（機能設定）自体が、その代わりに用意した「何を扱わないか」の静的な説明です。',
  },
  {
    key: 'staff_position',
    kind: 'folded',
    title: 'StaffPosition（役職マスタ）',
    message: '`Staff.role`（vet/nurse/office）で足りるため、別の役職マスタは持ちません。',
  },
  {
    key: 'karte_draft',
    kind: 'folded',
    title: 'KarteDraft（書きかけの自動保存）',
    message:
      '題材が「手で押す保存は作らない」と決めているため、自動保存もこの企画では外しました。' +
      'カルテ画面に下書きの一時保存はありません。',
  },
  {
    key: 'audit_log',
    kind: 'folded',
    title: 'AuditLog（監査ログ）',
    message: '業務では重要ですが、5実装で比べる題材にはならないため落としました。誰の操作かの記録画面はありません。',
  },
  {
    key: 'karte_pdf',
    kind: 'folded',
    title: 'KartePdf（紙カルテの取込）',
    message:
      'ファイルの取り扱い自体が主題になってしまうため落としました。「取込」画面が扱うのは' +
      '固定データ（`data/`）の読み込み確認のみです。',
  },
  {
    key: 'lab_item_master',
    kind: 'folded',
    title: 'LabItemMaster / LabRefRange / LabAgeBand（検査マスタの編集）',
    message:
      '固定データ（`data/lab_items.json`）へ移しました。「マスタ」画面で参照はできますが、' +
      '編集画面は作っていません。',
  },
  {
    key: 'billing_category',
    kind: 'folded',
    title: 'BillingCategory / DepartmentMaster / PhraseMaster（分類・診療科・定型文マスタの編集）',
    message:
      '固定データ（`data/masters.json`）へ移しました。「マスタ」画面で参照はできますが、' +
      '編集画面は作っていません。',
  },
  {
    key: 'price_item_hierarchy',
    kind: 'folded',
    title: 'PriceItem の4階層分類',
    message:
      '2階層に減らしました。階層の深さは比較の題材にならないためです。' +
      '「マスタ」画面の料金一覧は上位・下位2段の分類だけを表示します。',
  },
  {
    key: 'receipt',
    kind: 'folded',
    title: 'レセプト（保険請求）',
    message: '制度の知識が要り、間違えると害があるため手を出していません。会計・売上の画面に請求先の切替はありません。',
  },
];

export function findDroppedFeature(key: string): FeatureNote | undefined {
  return DROPPED_FEATURES.find((f) => f.key === key);
}
