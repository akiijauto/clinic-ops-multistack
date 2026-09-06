# データの形

**題材の実システムは28モデルある。この企画は14に絞る。**
落としたものは末尾に理由つきで全部書いてある。

保存の道具（RDB / ORM / ファイル）は各レーンが選んでよい。
**決まっているのは「何を持つか」であって「どう持つか」ではない。**

## 変わるもの（14）

### 1. Clinic — 病院

| 項目 | 型 | 備考 |
| --- | --- | --- |
| id | 整数 | |
| name | 文字列 | 病院名 |
| postal_code / address1 / address2 | 文字列 | |
| phone / fax | 文字列 | |
| director_name | 文字列 | 開設者 |
| reservation_slot_minutes | 整数 | 予約枠の刻み（既定15） |
| tax_rate | 小数 | 消費税率。**既定 0.10** |
| closed_weekdays | 整数の配列 | 休診日（0=月 … 6=日） |

**1件だけ存在する。** 複数病院は扱わない（題材には分院の概念があるが、この企画では落とす）。

題材では病院設定に6項目（消費税・ポイント・最終伝票番号・機関コード・ロゴ・休診日）が入るが、
**この企画で持つのは消費税と休診日の2つだけ**である。残り4つは末尾の「落としたもの」に理由つきで書いた。
黙って落とさない（`spec/README.md`）。

### 2. Staff — スタッフ

| 項目 | 型 | 備考 |
| --- | --- | --- |
| id / staff_code / name | | |
| role | 文字列 | `vet`（獣医師）/ `nurse`（看護師）/ `office`（事務） |
| is_active | 真偽 | |
| password_hash | 文字列 | ログインに使う。**平文で持たない** |

### 3. Owner — 飼主

| 項目 | 型 | 備考 |
| --- | --- | --- |
| id / owner_no | | `owner_no` は表示用の番号 |
| name_kana / name_kanji | 文字列 | |
| postal_code / address1 / address2 | 文字列 | |
| phone / mobile | 文字列 | |
| deleted_at | 日時 | **消さずに印を付ける**（下記） |

### 4. Patient — 動物

| 項目 | 型 | 備考 |
| --- | --- | --- |
| id / karte_no | | `karte_no` がカルテ番号。**画面のURLに出る** |
| owner_id | | |
| name_kana / name_kanji | 文字列 | |
| species / breed | 文字列 | 種別・品種 |
| sex | 文字列 | `male` / `female` / `unknown` |
| birth_date / neuter_date | 日付 | |
| deleted_at | 日時 | |

### 5. Reception — 本日の患者（受付）

| 項目 | 型 | 備考 |
| --- | --- | --- |
| id / patient_id | | |
| display_no | 整数 | 表示順。**上下送りで変わる** |
| received_at | 日時 | |
| owner_purpose / medical_purpose | 文字列 | 飼主の主訴・診療目的 |
| status | 文字列 | `waiting` / `in_exam` / `done` |
| staff_id | | 担当 |

### 6. Visit — 診察

| 項目 | 型 | 備考 |
| --- | --- | --- |
| id / patient_id / visit_no | | |
| visit_date / visit_time | | |
| body_weight_kg | 小数 | |
| chief_complaint / symptom / diagnosis / treatment | 文字列 | |
| staff_id | | |
| deleted_at | 日時 | |

### 7. ProgressNote — 経過記録

| 項目 | 型 | 備考 |
| --- | --- | --- |
| id / visit_id / row_no | | |
| entry_date | 日付 | |
| temperature_c / pulse / respiration / body_weight_kg | 数値 | |
| symptom_course / treatment_rx / note | 文字列 | |

**`temperature_c` は患者ごとに違う値が入るはず。**
題材の実システムでは、**全患者に同じ体温が印字される**不具合が実際に出た
（写し漏れた固定値がそのまま出ていた）。`acceptance.md` に検査項目がある。

### 8. Prevention — 予防

| 項目 | 型 | 備考 |
| --- | --- | --- |
| id / patient_id | | |
| kind | 文字列 | 種別（種別マスタは固定データ） |
| content | 文字列 | |
| performed_date / next_due_date | 日付 | |

### 9. Dosing — 投薬

| 項目 | 型 | 備考 |
| --- | --- | --- |
| id / patient_id | | |
| kind | 文字列 | |
| fiscal_year | 整数 | |
| m01 〜 m12 | 文字列 | 月ごとの記録 |

### 10. LabTest — 検査

| 項目 | 型 | 備考 |
| --- | --- | --- |
| id / patient_id / visit_id | | |
| category | 文字列 | 検査の種類 |
| tested_on / tested_at_time | | |
| staff_id | | |

### 11. LabTestItem — 検査の項目値

| 項目 | 型 | 備考 |
| --- | --- | --- |
| id / lab_test_id | | |
| item_code | 文字列 | 固定データの項目を指す |
| value_num / value_text | | |

**基準値は固定データ（`data/lab_items.json`）から引く。** 保存しない。
**基準の外にある値は、判定欄と色の両方に出すこと**（`acceptance.md`）。

### 12. Billing — 会計（伝票）

| 項目 | 型 | 備考 |
| --- | --- | --- |
| id / patient_id / owner_id | | |
| slip_no | 文字列 | 伝票番号 |
| status | 文字列 | `draft` / `confirmed` |
| billed_on | 日付 | |
| staff_id / cashier_staff_id | | |
| paid_amount / payment_method | | 支払い |

### 13. BillingDetail — 会計の明細

| 項目 | 型 | 備考 |
| --- | --- | --- |
| id / billing_id / row_no | | |
| price_code | 文字列 | 固定データの料金を指す |
| name | 文字列 | 明細名 |
| quantity | 小数 | |
| unit_price | 整数 or 未設定 | **未設定がありうる。ここが要点** |
| is_taxable | 真偽 | |

> **`unit_price` が未設定の行を「0円」として合計に入れてはならない。**
> 合計は出す。そのうえで**未算入の行数を併記する**（`spec/README.md`）。

### 14. Reservation — 予約（新）

| 項目 | 型 | 備考 |
| --- | --- | --- |
| id / patient_id | | |
| starts_at / ends_at | 日時 | |
| staff_id | | 担当。**同じ担当の時間帯は重ならないこと** |
| room | 文字列 | 処置室。**同じ室の時間帯は重ならないこと** |
| purpose / note | 文字列 | |
| status | 文字列 | `booked` / `cancelled` |

### 15. Hospitalization — 入院

| 項目 | 型 | 備考 |
| --- | --- | --- |
| id / patient_id | | |
| admitted_on / discharged_on | 日付 | |
| room | 文字列 | |
| care_records | 記録の並び | 投薬・給餌・計測。**実施者を必ず持つ**（フィールド名は `performed_by_staff_id`） |

> **実施者が空の記録行を作らないこと。** 誰がやったか分からない記録は、記録として成立しない。

## 消さずに印を付ける

`Owner` `Patient` `Visit` は **物理削除しない。** `deleted_at` に日時を入れる。

理由は、消すと**その日に何件診たかが数えられなくなる**から。
題材の実システムでも同じ判断をしている（「完了全削除」を作らないと決めた理由がこれ）。

一覧では既定で隠す。**「削除済みも表示」を選べば見える**ようにする。

## 変わらないもの（固定データ）

`data/` に置く。**画面から編集しない。** 読み込むだけ。

| ファイル | 中身 |
| --- | --- |
| `data/lab_items.json` | 検査項目と基準値（種別・性別で変わる） |
| `data/price_items.json` | 料金。`price_code` / 名称 / 単価 / 課税区分 / 分類 |
| `data/masters.json` | 予防の種別・受付の種別・診療科・定型文 |
| `data/seed.json` | 飼主・動物・診察・会計などの初期データ（**すべて架空**） |

**料金マスタには単価が未設定の項目を意図的に混ぜてある。**
上に書いた「0円として集計しない」を確かめるため。

## 落としたもの（意図して外した。作れなかったのではない）

| 落としたもの | 理由 |
| --- | --- |
| 分院（`hospital_division`） | 病院は1件だけ扱う。複数拠点は比較の題材にならない |
| `ClinicFeature`（機能の出し分け） | 題材の運用固有の事情。他所で意味を持たない |
| `StaffPosition`（役職マスタ） | `Staff.role` で足りる |
| `KarteDraft`（書きかけの自動保存） | 題材が「手で押す保存は作らない」と決めている。自動保存もこの企画では外す |
| `AuditLog`（監査ログ） | 業務では重要だが、5実装で比べる題材にはならない |
| `LabItemMaster` / `LabRefRange` / `LabAgeBand` | **固定データへ移した。** 参照はする。編集画面は作らない |
| `BillingCategory` / `DepartmentMaster` / `PhraseMaster` | 同上 |
| `PriceItem` の4階層分類 | **2階層に減らした。** 階層の深さは比較の題材にならない |
| レセプト（保険請求） | 制度の知識が要り、間違えると害がある。**手を出さない** |
| 病院設定の**ポイント** | 会員制度の設計が要る。5実装で比べる題材にならない |
| 病院設定の**最終伝票番号** | 伝票番号は `Billing.slip_no` が持つ。採番の続きを設定で持つのは運用移行のための仕組みで、新規に作るこの企画には要らない |
| 病院設定の**機関コード** | 保険請求で使う番号。レセプトを外したので使い道が無い |
| 病院設定の**ロゴ画像** | 画像の取り扱いが主題になってしまう（紙カルテの取込を外したのと同じ理由） |

### `KartePdf`（紙カルテの取込）は、この表から外した（2026-09-06、裁定R-21）

以前はここに「ファイルの取り扱いが主題になってしまう」という理由で載っていたが、
`spec/screens.md` 13番「書類（紙カルテPDF）」が詳細に規定し、`spec/openapi.yaml` に
6ルートが実在し、5実装すべてが既に作っている。**同じ契約の中で「落とした」と
「これを作る」が両立していた矛盾を、指揮役が「書類は範囲内」と裁定して解消した。**
落とした理由（ファイルの取り扱いが主題になる）は、実装がPDFの実体を持たず
**取込の記録（メタデータ）だけ**を扱う設計で回避できている。黙って削除しない
という上の原則に従い、ここに経緯を残す。

**この変更にともなう既知の課題**: 5実装はいずれも「折りたたみ表示」画面
（`spec/screens.md` 7番）の一覧に、旧版のこの表に合わせて「KartePdf（紙カルテの取込）」を
**落とした機能として**表示している。書類が範囲内になった以上、これは実装側の記述が
古いままの状態であり、各レーンでの修正が要る（この表の項目数と、折りたたみ表示に
並ぶ項目数が一致するという `screens.md` 7番の要求に対して、いま食い違っている）。

**画面に「できます」と書いて出来ていない状態を作らないこと。**
落としたものは、画面上でも「この企画では作っていない」と分かるようにする。
