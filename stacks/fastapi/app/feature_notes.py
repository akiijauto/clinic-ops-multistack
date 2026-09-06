"""B状態（この企画では作っていない）・C状態（あえて動かさない）の説明データ。

`spec/model.md`「落としたもの」表（14件）が正。**画面（折りたたみ表示・機能設定）は
この表と項目数・理由が完全一致すること**（`spec/screens.md` 7番・23番）。

状態の意味（`spec/screens.md`「共通の約束」）:
- B（この企画では作っていない）＝ `model.md`「落としたもの」に対応する機能
- C（あえて動かさないと決めたもの）＝ スコープには入っているが、業務上の理由で
  意図して押せなくしたもの（完了行を消す操作など）

qa/lane-d.md に記録: `key` の語彙は `spec/openapi.yaml` の `TodoKey`/`MasterKey` 同様
enumで固定されていない（screens.md/acceptance.mdに具体名が無い）ため、ここで仮決めした。
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class FeatureNote:
    key: str
    kind: str  # "todo" | "folded"
    title: str
    message: str
    where: str = ""  # 「この企画のどこで見えるか」（screens.md 7番）


# B状態：model.md「落としたもの」表と1対1（順序・件数とも一致させること）。
FOLDED_NOTES: list[FeatureNote] = [
    FeatureNote(
        key="hospital_division", kind="folded", title="分院",
        message="病院は1件だけ扱う。複数拠点は比較の題材にならない。",
        where="本日の患者の分院欄",
    ),
    FeatureNote(
        key="clinic_feature", kind="folded", title="機能の出し分け（ClinicFeature）",
        message="題材の運用固有の事情。他所で意味を持たない。",
        where="設定 > 機能設定",
    ),
    FeatureNote(
        key="staff_position", kind="folded", title="役職マスタ（StaffPosition）",
        message="Staff.role で足りる。",
        where="スタッフ画面",
    ),
    FeatureNote(
        key="karte_draft", kind="folded", title="書きかけの自動保存（KarteDraft）",
        message="題材が「手で押す保存は作らない」と決めている。自動保存もこの企画では外す。",
        where="カルテ画面",
    ),
    FeatureNote(
        key="audit_log", kind="folded", title="監査ログ（AuditLog）",
        message="業務では重要だが、5実装で比べる題材にはならない。",
        where="設定 > 機能設定",
    ),
    FeatureNote(
        key="karte_pdf", kind="folded", title="紙カルテの取込（KartePdf）",
        message="ファイルの取り扱いが主題になってしまう。",
        where="書類画面",
    ),
    FeatureNote(
        key="lab_item_master", kind="folded",
        title="検査基準値マスタの編集（LabItemMaster / LabRefRange / LabAgeBand）",
        message="固定データへ移した。参照はする。編集画面は作らない。",
        where="設定 > マスタ",
    ),
    FeatureNote(
        key="billing_category_master", kind="folded",
        title="会計分類・診療科・定型文マスタの編集（BillingCategory / DepartmentMaster / PhraseMaster）",
        message="固定データへ移した。参照はする。編集画面は作らない。",
        where="設定 > マスタ",
    ),
    FeatureNote(
        key="price_item_4layer", kind="folded", title="料金分類の4階層",
        message="2階層に減らした。階層の深さは比較の題材にならない。",
        where="会計の料金ピッカー",
    ),
    FeatureNote(
        key="insurance_claim", kind="folded", title="レセプト（保険請求）",
        message="制度の知識が要り、間違えると害がある。手を出さない。",
        where="設定 > 機能設定",
    ),
    FeatureNote(
        key="clinic_points", kind="folded", title="病院設定のポイント",
        message="会員制度の設計が要る。5実装で比べる題材にならない。",
        where="設定（病院設定）",
    ),
    FeatureNote(
        key="clinic_last_slip_no", kind="folded", title="病院設定の最終伝票番号",
        message="伝票番号は Billing.slip_no が持つ。採番の続きを設定で持つのは"
        "運用移行のための仕組みで、新規に作るこの企画には要らない。",
        where="設定（病院設定）",
    ),
    FeatureNote(
        key="clinic_agency_code", kind="folded", title="病院設定の機関コード",
        message="保険請求で使う番号。レセプトを外したので使い道が無い。",
        where="設定（病院設定）",
    ),
    FeatureNote(
        key="clinic_logo", kind="folded", title="病院設定のロゴ画像",
        message="画像の取り扱いが主題になってしまう（紙カルテの取込を外したのと同じ理由）。",
        where="設定（病院設定）",
    ),
]

# C状態：スコープ内だが業務上あえて押せなくしたもの（`docs/実装分担` 由来、
# `spec/screens.md`「共通の約束」）。3つ。
TODO_NOTES: list[FeatureNote] = [
    FeatureNote(
        key="temp_save", kind="todo", title="一時保存",
        message="書きかけは自動で控えている。手で押す保存も置くと、"
        "どちらを押せば残るのかを覚えることになり、残るものは変わらない。",
        where="カルテ画面",
    ),
    FeatureNote(
        key="complete_delete_all", kind="todo", title="完了全削除",
        message="完了行を消すと、その日に何件診たかが数えられなくなる。"
        "稼働の前後を比べる作りにしてある。",
        where="本日の患者",
    ),
    FeatureNote(
        key="complete_delete_one", kind="todo", title="完了削除",
        message="完了行を消すと、その日に何件診たかが数えられなくなる。"
        "稼働の前後を比べる作りにしてある。",
        where="本日の患者",
    ),
]

ALL_NOTES: list[FeatureNote] = [*TODO_NOTES, *FOLDED_NOTES]
_BY_KEY: dict[str, FeatureNote] = {n.key: n for n in ALL_NOTES}


def get(key: str) -> FeatureNote | None:
    return _BY_KEY.get(key)
