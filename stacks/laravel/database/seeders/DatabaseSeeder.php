<?php

namespace Database\Seeders;

use App\Support\FixedData;
use Carbon\Carbon;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * data/seed.json（リポジトリ直下。全レーン共通）を読み込んで初期データを作る。
 *
 * この企画は「保存まで動く」（spec/README.md）ので、ここで作ったデータは
 * 画面からの操作で増減してよい。data/ 自体は書き換えない（読み込むだけ）。
 *
 * 日時（received_at 等、+09:00 オフセット付き）は、保存前に Asia/Tokyo の
 * 'Y-m-d H:i:s' へ正規化する。SQLite は真の日時型を持たずTEXT比較になるため、
 * 保存形式をそろえないと WHERE の大小比較（例: 予約の重なり判定）が
 * 文字列としては正しく並ばなくなる（オフセット付き文字列とオフセット無し文字列が混在すると危険）。
 */
class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    public function run(): void
    {
        $seed = FixedData::seed();

        DB::transaction(function () use ($seed) {
            $this->seedClinic($seed['clinic']);
            $this->seedStaff($seed['staff']);
            $this->seedOwners($seed['owners']);
            $this->seedPatients($seed['patients'], $seed['no_paper_patient_ids'] ?? []);
            $this->seedReceptions($seed['receptions']);
            $this->seedVisits($seed['visits']);
            $this->seedProgressNotes($seed['progress_notes']);
            $this->seedPreventions($seed['preventions']);
            $this->seedDosings($seed['dosings']);
            $this->seedLabTests($seed['lab_tests']);
            $this->seedLabTestItems($seed['lab_test_items']);
            $this->seedBillings($seed['billings']);
            $this->seedBillingDetails($seed['billing_details']);
            $this->seedReservations($seed['reservations']);
            $this->seedHospitalizations($seed['hospitalizations']);
            $this->seedPapers($seed['papers']);
        });

        $this->command?->info('seed.json 読み込み完了。anchor_date='.$seed['anchor_date']);
    }

    /** ISO8601（+09:00オフセット付き）を Asia/Tokyo の 'Y-m-d H:i:s' へそろえる。 */
    private function dt(?string $iso): ?string
    {
        if ($iso === null) {
            return null;
        }

        return Carbon::parse($iso)->setTimezone('Asia/Tokyo')->format('Y-m-d H:i:s');
    }

    private function now(): string
    {
        return now()->format('Y-m-d H:i:s');
    }

    private function seedClinic(array $c): void
    {
        DB::table('clinics')->insert([
            'id' => $c['id'],
            'name' => $c['name'],
            'postal_code' => $c['postal_code'] ?? null,
            'address1' => $c['address1'] ?? null,
            'address2' => $c['address2'] ?? null,
            'phone' => $c['phone'] ?? null,
            'fax' => $c['fax'] ?? null,
            'director_name' => $c['director_name'] ?? null,
            'reservation_slot_minutes' => $c['reservation_slot_minutes'],
            'tax_rate' => $c['tax_rate'],
            'closed_weekdays' => json_encode($c['closed_weekdays'] ?? []),
            'created_at' => $this->now(),
            'updated_at' => $this->now(),
        ]);
    }

    private function seedStaff(array $rows): void
    {
        foreach ($rows as $s) {
            DB::table('staff')->insert([
                'id' => $s['id'],
                'staff_code' => $s['staff_code'],
                'name' => $s['name'],
                'role' => $s['role'],
                'is_active' => $s['is_active'],
                'password_hash' => $s['password_hash'] ?? null,
                'created_at' => $this->now(),
                'updated_at' => $this->now(),
            ]);
        }
    }

    private function seedOwners(array $rows): void
    {
        foreach ($rows as $o) {
            DB::table('owners')->insert([
                'id' => $o['id'],
                'owner_no' => $o['owner_no'],
                'name_kana' => $o['name_kana'],
                'name_kanji' => $o['name_kanji'],
                'postal_code' => $o['postal_code'] ?? null,
                'address1' => $o['address1'] ?? null,
                'address2' => $o['address2'] ?? null,
                'phone' => $o['phone'] ?? null,
                'mobile' => $o['mobile'] ?? null,
                'deleted_at' => $this->dt($o['deleted_at'] ?? null),
                'created_at' => $this->now(),
                'updated_at' => $this->now(),
            ]);
        }
    }

    /**
     * @param  array<int>  $noPaperIds  「この子の紙カルテは元から無い」の初期値
     *   （`data/seed.json`の`no_paper_patient_ids`。契約に定義は無く指揮役が追加したもの。
     *   `patients.no_paper`列で持つ——2026-09-06レビュー指摘対応）
     */
    private function seedPatients(array $rows, array $noPaperIds = []): void
    {
        foreach ($rows as $p) {
            DB::table('patients')->insert([
                'id' => $p['id'],
                'karte_no' => $p['karte_no'],
                'owner_id' => $p['owner_id'],
                'name_kana' => $p['name_kana'],
                'name_kanji' => $p['name_kanji'],
                'species' => $p['species'],
                'breed' => $p['breed'] ?? null,
                'sex' => $p['sex'],
                'birth_date' => $p['birth_date'] ?? null,
                'neuter_date' => $p['neuter_date'] ?? null,
                'no_paper' => in_array($p['id'], $noPaperIds, true),
                'deleted_at' => $this->dt($p['deleted_at'] ?? null),
                'created_at' => $this->now(),
                'updated_at' => $this->now(),
            ]);
        }
    }

    private function seedReceptions(array $rows): void
    {
        foreach ($rows as $r) {
            DB::table('receptions')->insert([
                'id' => $r['id'],
                'patient_id' => $r['patient_id'],
                'display_no' => $r['display_no'],
                'received_at' => $this->dt($r['received_at']),
                'owner_purpose' => $r['owner_purpose'] ?? null,
                'medical_purpose' => $r['medical_purpose'] ?? null,
                'status' => $r['status'],
                'staff_id' => $r['staff_id'] ?? null,
                'created_at' => $this->now(),
                'updated_at' => $this->now(),
            ]);
        }
    }

    private function seedVisits(array $rows): void
    {
        foreach ($rows as $v) {
            DB::table('visits')->insert([
                'id' => $v['id'],
                'patient_id' => $v['patient_id'],
                'visit_no' => $v['visit_no'],
                'visit_date' => $v['visit_date'],
                'visit_time' => $v['visit_time'] ?? null,
                'body_weight_kg' => $v['body_weight_kg'] ?? null,
                'chief_complaint' => $v['chief_complaint'] ?? null,
                'symptom' => $v['symptom'] ?? null,
                'diagnosis' => $v['diagnosis'] ?? null,
                'treatment' => $v['treatment'] ?? null,
                'staff_id' => $v['staff_id'] ?? null,
                'deleted_at' => $this->dt($v['deleted_at'] ?? null),
                'created_at' => $this->now(),
                'updated_at' => $this->now(),
            ]);
        }
    }

    private function seedProgressNotes(array $rows): void
    {
        foreach ($rows as $n) {
            DB::table('progress_notes')->insert([
                'id' => $n['id'],
                'visit_id' => $n['visit_id'],
                'row_no' => $n['row_no'],
                'entry_date' => $n['entry_date'],
                'temperature_c' => $n['temperature_c'] ?? null,
                'pulse' => $n['pulse'] ?? null,
                'respiration' => $n['respiration'] ?? null,
                'body_weight_kg' => $n['body_weight_kg'] ?? null,
                'symptom_course' => $n['symptom_course'] ?? null,
                'treatment_rx' => $n['treatment_rx'] ?? null,
                'note' => $n['note'] ?? null,
                'created_at' => $this->now(),
                'updated_at' => $this->now(),
            ]);
        }
    }

    private function seedPreventions(array $rows): void
    {
        foreach ($rows as $p) {
            DB::table('preventions')->insert([
                'id' => $p['id'],
                'patient_id' => $p['patient_id'],
                'kind' => $p['kind'],
                'content' => $p['content'] ?? null,
                'performed_date' => $p['performed_date'],
                'next_due_date' => $p['next_due_date'] ?? null,
                'created_at' => $this->now(),
                'updated_at' => $this->now(),
            ]);
        }
    }

    private function seedDosings(array $rows): void
    {
        foreach ($rows as $d) {
            $row = [
                'id' => $d['id'],
                'patient_id' => $d['patient_id'],
                'kind' => $d['kind'],
                'fiscal_year' => $d['fiscal_year'],
                'created_at' => $this->now(),
                'updated_at' => $this->now(),
            ];
            for ($m = 1; $m <= 12; $m++) {
                $key = sprintf('m%02d', $m);
                $row[$key] = $d[$key] ?? null;
            }
            DB::table('dosings')->insert($row);
        }
    }

    private function seedLabTests(array $rows): void
    {
        foreach ($rows as $t) {
            DB::table('lab_tests')->insert([
                'id' => $t['id'],
                'patient_id' => $t['patient_id'],
                'visit_id' => $t['visit_id'],
                'category' => $t['category'],
                'tested_on' => $t['tested_on'],
                'tested_at_time' => $t['tested_at_time'] ?? null,
                'staff_id' => $t['staff_id'] ?? null,
                'created_at' => $this->now(),
                'updated_at' => $this->now(),
            ]);
        }
    }

    private function seedLabTestItems(array $rows): void
    {
        foreach ($rows as $i) {
            DB::table('lab_test_items')->insert([
                'id' => $i['id'],
                'lab_test_id' => $i['lab_test_id'],
                'item_code' => $i['item_code'],
                'value_num' => $i['value_num'] ?? null,
                'value_text' => $i['value_text'] ?? null,
                'created_at' => $this->now(),
                'updated_at' => $this->now(),
            ]);
        }
    }

    private function seedBillings(array $rows): void
    {
        foreach ($rows as $b) {
            DB::table('billings')->insert([
                'id' => $b['id'],
                'patient_id' => $b['patient_id'],
                'owner_id' => $b['owner_id'],
                'slip_no' => $b['slip_no'],
                'status' => $b['status'],
                'billed_on' => $b['billed_on'],
                'staff_id' => $b['staff_id'] ?? null,
                'cashier_staff_id' => $b['cashier_staff_id'] ?? null,
                'paid_amount' => $b['paid_amount'] ?? null,
                'payment_method' => $b['payment_method'] ?? null,
                'created_at' => $this->now(),
                'updated_at' => $this->now(),
            ]);
        }
    }

    private function seedBillingDetails(array $rows): void
    {
        foreach ($rows as $d) {
            DB::table('billing_details')->insert([
                'id' => $d['id'],
                'billing_id' => $d['billing_id'],
                'row_no' => $d['row_no'],
                'price_code' => $d['price_code'],
                'name' => $d['name'],
                'quantity' => $d['quantity'],
                'unit_price' => $d['unit_price'] ?? null,
                'is_taxable' => $d['is_taxable'],
                'created_at' => $this->now(),
                'updated_at' => $this->now(),
            ]);
        }
    }

    private function seedReservations(array $rows): void
    {
        foreach ($rows as $r) {
            DB::table('reservations')->insert([
                'id' => $r['id'],
                'patient_id' => $r['patient_id'],
                'starts_at' => $this->dt($r['starts_at']),
                'ends_at' => $this->dt($r['ends_at']),
                'staff_id' => $r['staff_id'],
                'room' => $r['room'],
                'purpose' => $r['purpose'] ?? null,
                'note' => $r['note'] ?? null,
                'status' => $r['status'],
                'created_at' => $this->now(),
                'updated_at' => $this->now(),
            ]);
        }
    }

    private function seedHospitalizations(array $rows): void
    {
        foreach ($rows as $h) {
            DB::table('hospitalizations')->insert([
                'id' => $h['id'],
                'patient_id' => $h['patient_id'],
                'admitted_on' => $h['admitted_on'],
                'discharged_on' => $h['discharged_on'] ?? null,
                'room' => $h['room'],
                'created_at' => $this->now(),
                'updated_at' => $this->now(),
            ]);

            foreach ($h['care_records'] as $c) {
                // care_records[].id は入院ごとの連番で、hospitalizations をまたいで
                // ユニークではない（2026-09-05 実測）。ここは自動採番に任せる。
                DB::table('care_records')->insert([
                    'hospitalization_id' => $h['id'],
                    'recorded_at' => $this->dt($c['recorded_at']),
                    'category' => $c['category'],
                    'content' => $c['content'] ?? null,
                    // 実施者は必須（spec/model.md・検算7）。seed.json 側は必ず値を持つ前提。
                    'performed_by_staff_id' => $c['performed_by_staff_id'],
                    'created_at' => $this->now(),
                    'updated_at' => $this->now(),
                ]);
            }
        }
    }

    /**
     * papers.created_at/updated_at はこのテーブルでは Eloquent の標準タイムスタンプ
     * （取込日を別列で持たない）。seed.json の taken_on を created_at として使う。
     * visit_id は現行スキーマに列が無く保持できない（openapi.yaml の Paper スキーマにも無い）。
     */
    private function seedPapers(array $rows): void
    {
        foreach ($rows as $p) {
            DB::table('papers')->insert([
                'id' => $p['id'],
                'patient_id' => $p['patient_id'],
                'title' => $p['title'],
                'note' => $p['note'] ?? null,
                'removed_at' => $p['removed_at'] !== null ? $this->dt($p['removed_at']) : null,
                'created_at' => $p['taken_on'].' 00:00:00',
                'updated_at' => $p['taken_on'].' 00:00:00',
            ]);
        }
    }
}
