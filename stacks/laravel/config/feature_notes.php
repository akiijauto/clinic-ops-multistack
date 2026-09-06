<?php

/**
 * 「押しても保存されない灰色のボタン」「この企画では扱わない機能」の説明文。
 *
 * これは統合点（複数の領域が同じ元データを参照する）なので、レーンC自身がここを持つ。
 * 各領域は追記してよいが、既存の行は書き換えない（qa/lane-c.md に記録すること）。
 *
 * 種類:
 *   - folded : 状態B（この企画のスコープ外。model.md「落としたもの」に対応）
 *              → /folded/{key} と /settings/features（画面7・23）
 *   - todo   : 状態C（あえて塞んである。業務上の理由がある）
 *              → /todo/{key}（画面20）
 *
 * spec/screens.md「押した先の2画面」：
 *   ②ToDo（todo） は個別のボタン1つの理由。③折りたたみ表示（folded） は一覧。
 *   個別のBボタンを押しても③（folded）へ飛んでよい。
 */

return [

    // 状態B — spec/model.md「落としたもの」表（10件。画面7の満たすべきこと「項目数が一致する」の基準）
    'folded' => [
        'hospital_division' => [
            'title' => '分院',
            'message' => 'この企画では病院を1件だけ扱います。複数拠点は5実装の比較という'
                . 'この企画の目的にとって題材になりません（分院そのものを作っていません）。',
            'seen_at' => '本日の患者・トップの「分院」欄',
        ],
        'clinic_feature' => [
            'title' => '機能の出し分け（ClinicFeature）',
            'message' => '病院ごとに機能を有効・無効にする仕組みは、題材の運用固有の事情によるもので、'
                . '他の場所では意味を持たないため、この企画では持ちません。',
            'seen_at' => '設定（機能設定）',
        ],
        'staff_position' => [
            'title' => '役職マスタ（StaffPosition）',
            'message' => 'スタッフの役割は Staff.role（vet／nurse／office）で足りるため、'
                . '別マスタとしては持ちません。',
            'seen_at' => 'スタッフ・設定（マスタ）',
        ],
        'karte_draft' => [
            'title' => '書きかけカルテの自動保存（KarteDraft）',
            'message' => '題材は「手で押す保存ボタンは作らない」と決めています。'
                . '自動保存の仕組み自体も、この企画では対象に含めていません。',
            'seen_at' => 'カルテ',
        ],
        'audit_log' => [
            'title' => '監査ログ（AuditLog）',
            'message' => '実際の業務では重要な機能ですが、5つの実装を見比べるという'
                . 'この企画の目的にとっては題材になりません。',
            'seen_at' => '設定',
        ],
        'karte_pdf' => [
            'title' => '紙カルテの取込（KartePdf）',
            'message' => 'ファイルの取り扱い（アップロード・保存・表示）自体が主題になってしまうため、'
                . 'この企画では対象に含めていません。',
            'seen_at' => '書類・取込',
        ],
        'lab_item_master' => [
            'title' => '検査項目・基準値マスタの編集（LabItemMaster／LabRefRange／LabAgeBand）',
            'message' => '検査項目と基準値は固定データ（data/lab_items.json）へ移しました。'
                . '参照はしますが、編集する画面は作っていません。',
            'seen_at' => '検査・設定（マスタ）',
        ],
        'billing_category_master' => [
            'title' => '会計・診療科・定型文マスタの編集（BillingCategory／DepartmentMaster／PhraseMaster）',
            'message' => '料金・診療科・定型文は固定データ（data/masters.json・data/price_items.json）へ'
                . '移しました。参照はしますが、編集する画面は作っていません。',
            'seen_at' => '会計・設定（マスタ）',
        ],
        'price_item_hierarchy' => [
            'title' => '料金分類の4階層',
            'message' => '階層の深さは5実装を比較するという、この企画の目的の題材になりません。'
                . '2階層に減らしています。',
            'seen_at' => '会計・売上集計',
        ],
        'insurance_claim' => [
            'title' => 'レセプト（保険請求）',
            'message' => '制度の知識が要り、間違えると実害につながるため、この企画では手を出しません。',
            'seen_at' => '設定タブ',
        ],
    ],

    // 状態C — spec/screens.md「本日の患者」画面1の表（完了全削除／完了削除）・
    // カルテの一時保存（screens.md「押した先の2画面」②ToDo）。
    //
    // 【仮決め】キーに「.」を含めない（例: `today.complete_delete_all` ではなく
    // `today_complete_delete_all`）。在庫検査（tests/inventory.py 契約5「灰色3つ」）が
    // `/todo/([A-Za-z0-9_\-]+)` でリンク先のキーを拾うため、「.」を含むキーは
    // ドットの手前で切り取られ、2つの別ボタンが同じキーに潰れて数え漏れる
    // （2026-09-06実測。coordination/qa/lane-c.md参照）。
    'todo' => [
        'today_complete_delete_all' => [
            'title' => '完了全削除',
            'message' => '完了した受付行をまとめて消す機能です。あえて作っていません。'
                . '完了行を物理的に消してしまうと、その日に何件診たかが数えられなくなるためです。'
                . '削除したい場合は、対象の診察・患者・飼主それぞれの「削除」を使ってください'
                . '（消えるのは一覧表示からだけで、件数には残ります）。',
        ],
        'today_complete_delete_one' => [
            'title' => '完了削除',
            'message' => '完了した受付行を1件だけ消す機能です。理由は「完了全削除」と同じで、'
                . 'その日の診察件数が数えられなくなることを避けるためです。',
        ],
        'karte_temp_save' => [
            'title' => '一時保存',
            'message' => 'カルテを書きかけのまま保存しておく機能です。あえて作っていません。'
                . 'この企画は「手で押す保存ボタンは作らない（自動保存の仕組み自体も対象に含めない）」'
                . 'と決めています（KarteDraftはmodel.md「落としたもの」）。'
                . '保存したい内容は、そのまま「新規診察」の保存ボタンで確定してください。',
        ],
    ],

];
