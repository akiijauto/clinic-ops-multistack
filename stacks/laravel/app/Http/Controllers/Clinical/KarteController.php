<?php

namespace App\Http\Controllers\Clinical;

use App\Http\Controllers\Controller;
use App\Models\Patient;
use App\Models\ProgressNote;
use App\Models\Visit;
use App\Support\ApiError;
use App\Support\CurrentStaff;
use Illuminate\Contracts\View\View;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

/**
 * カルテ画面。契約は spec/openapi.yaml `/animals/{karte_no}/karte`（本体・一覧・保存）
 * `.../karte/new`（新規入力フォーム）`.../karte/copy_prev`（前回コピー）
 * `.../karte/cancel`（取消）`.../karte/print`（全診察印刷）
 * `.../karte/{visit_id}/print`（1診察印刷）`.../karte/{visit_id}/delete` `.../restore`。
 *
 * 通常画面と印刷画面は同じデータ取得・同じ部分テンプレート（resources/views/clinical/_visits.blade.php）
 * を使う。別々に組み立てると印刷側だけ古い表示が残る食い違い（検算4）が起きるため。
 */
class KarteController extends Controller
{
    /**
     * 削除された診察はカルテ・印刷の通常表示から外れる（spec/screens.md画面6
     * 「削除されたVisitは、カルテ・印刷・検索・来院履歴の通常表示から外れる」）。
     * `?show_deleted=1` で見える（他の削除済み一覧と同じ「削除済みも表示」の規則）。
     */
    public function show(Request $request, string $karteNo): View
    {
        $patient = $this->findPatient($karteNo);

        return view('clinical.karte', [
            'patient' => $patient,
            'visits' => $this->visits($patient, $request->boolean('show_deleted')),
            'showDeleted' => $request->boolean('show_deleted'),
        ]);
    }

    public function print(Request $request, string $karteNo): View
    {
        $patient = $this->findPatient($karteNo);

        return view('clinical.karte_print', [
            'patient' => $patient,
            'visits' => $this->visits($patient, $request->boolean('show_deleted')),
        ]);
    }

    /** 1診察だけの印刷（検算4は同一visit_idの画面値・印刷値の一致を求める）。 */
    public function printOne(string $karteNo, int $visitId): View|Response
    {
        $patient = $this->findPatient($karteNo);
        $visit = $patient->visits()->with('progressNotes')->where('id', $visitId)->first();
        if ($visit === null) {
            return ApiError::response(ApiError::NOT_FOUND);
        }

        return view('clinical.karte_print', [
            'patient' => $patient,
            'visits' => Collection::make([$visit]),
        ]);
    }

    /** 新規診察の入力フォーム。 */
    public function newForm(string $karteNo): View|Response
    {
        $patient = $this->findPatient($karteNo);

        return view('clinical.karte_form', [
            'patient' => $patient,
            'defaults' => [],
            'mode' => 'new',
        ]);
    }

    /**
     * 前回コピー。直前の診察が無いときは空フォームへフォールバックする
     * （押しても何も起きないボタンにしない）。
     */
    public function copyPrev(string $karteNo): View|Response
    {
        $patient = $this->findPatient($karteNo);
        $prev = $patient->visits()->orderByDesc('visit_date')->orderByDesc('visit_no')->with('progressNotes')->first();

        if ($prev === null) {
            return view('clinical.karte_form', [
                'patient' => $patient,
                'defaults' => [],
                'mode' => 'new',
                'notice' => '直前の診察が無いため、空のフォームを開きました。',
            ]);
        }

        $defaults = [
            'chief_complaint' => $prev->chief_complaint,
            'symptom' => $prev->symptom,
            'diagnosis' => $prev->diagnosis,
            'treatment' => $prev->treatment,
            'body_weight_kg' => $prev->body_weight_kg,
            'progress_notes' => $prev->progressNotes->map(fn ($n) => [
                'temperature_c' => $n->temperature_c,
                'pulse' => $n->pulse,
                'respiration' => $n->respiration,
                'body_weight_kg' => $n->body_weight_kg,
                'symptom_course' => $n->symptom_course,
                'treatment_rx' => $n->treatment_rx,
                'note' => $n->note,
            ])->all(),
        ];

        return view('clinical.karte_form', ['patient' => $patient, 'defaults' => $defaults, 'mode' => 'copy_prev']);
    }

    /**
     * 保存の成否によらず200。失敗時は打った値をそのままフォームへ返す
     * （確定済みの値で上書きしない。spec/openapi.yaml「カルテ保存」description）。
     */
    public function store(Request $request, string $karteNo): View
    {
        $patient = $this->findPatient($karteNo);

        $visitDate = $request->input('visit_date');
        if (! $visitDate) {
            return view('clinical.karte_form', [
                'patient' => $patient,
                'defaults' => $request->all(),
                'mode' => 'new',
                'error' => '来院日は必須です。',
            ]);
        }

        $visit = DB::transaction(function () use ($request, $patient, $visitDate) {
            $visit = Visit::create([
                'patient_id' => $patient->id,
                'visit_no' => Visit::nextVisitNo($patient->id),
                'visit_date' => $visitDate,
                'visit_time' => $request->input('visit_time') ?: null,
                'body_weight_kg' => $request->input('body_weight_kg') ?: null,
                'chief_complaint' => $request->input('chief_complaint'),
                'symptom' => $request->input('symptom'),
                'diagnosis' => $request->input('diagnosis'),
                'treatment' => $request->input('treatment'),
                'staff_id' => CurrentStaff::id(),
            ]);

            // 経過記録は行ごとに独立して保存する（体温などを使い回さない。検算3）。
            $rows = (array) $request->input('progress_notes', []);
            $rowNo = 1;
            foreach ($rows as $row) {
                $hasAny = collect($row)->filter(fn ($v) => trim((string) $v) !== '')->isNotEmpty();
                if (! $hasAny) {
                    continue;
                }
                ProgressNote::create([
                    'visit_id' => $visit->id,
                    'row_no' => $rowNo++,
                    'entry_date' => $visitDate,
                    'temperature_c' => ($row['temperature_c'] ?? '') !== '' ? $row['temperature_c'] : null,
                    'pulse' => ($row['pulse'] ?? '') !== '' ? $row['pulse'] : null,
                    'respiration' => ($row['respiration'] ?? '') !== '' ? $row['respiration'] : null,
                    'body_weight_kg' => ($row['body_weight_kg'] ?? '') !== '' ? $row['body_weight_kg'] : null,
                    'symptom_course' => $row['symptom_course'] ?? null,
                    'treatment_rx' => $row['treatment_rx'] ?? null,
                    'note' => $row['note'] ?? null,
                ]);
            }

            return $visit;
        });

        return view('clinical.karte', [
            'patient' => $patient,
            'visits' => $this->visits($patient),
            'success' => '診察を保存しました（診察No.'.$visit->visit_no.'）。',
        ]);
    }

    /** 取消（書きかけの入力を捨てる）。KarteDraftはこの企画では持たないため、常に成功扱いで戻す。 */
    public function cancel(string $karteNo): View
    {
        $patient = $this->findPatient($karteNo);

        return view('clinical.karte', [
            'patient' => $patient,
            'visits' => $this->visits($patient),
            'success' => '入力を取り消しました。',
        ]);
    }

    /**
     * 診察の削除（画面6）。理由は必須（spec/screens.md画面6「満たすべきこと」）。
     *
     * 仮決め: AuditLog は spec/model.md でスコープ外のため、理由文字列は
     * どこにも永続化しない（記録先が無い）。理由が空なら拒否する、という
     * 振る舞いだけを実装する。coordination/qa/lane-c.md に記録する。
     */
    public function deleteVisit(Request $request, string $karteNo, int $visitId): View|Response
    {
        $patient = $this->findPatient($karteNo);
        $visit = $patient->visits()->where('id', $visitId)->first();
        if ($visit === null) {
            return ApiError::response(ApiError::NOT_FOUND);
        }

        $reason = trim((string) $request->input('reason', ''));
        if ($reason === '') {
            return view('clinical.karte', [
                'patient' => $patient,
                'visits' => $this->visits($patient),
                'error' => '削除の理由を入力してください。',
            ]);
        }

        $visit->softDelete();

        return view('clinical.karte', [
            'patient' => $patient,
            'visits' => $this->visits($patient),
            'success' => '診察を削除しました。',
        ]);
    }

    public function restoreVisit(string $karteNo, int $visitId): View|Response
    {
        $patient = $this->findPatient($karteNo);
        $visit = $patient->visits()->where('id', $visitId)->first();
        if ($visit === null) {
            return ApiError::response(ApiError::NOT_FOUND);
        }

        $visit->restore();

        return view('clinical.karte', [
            'patient' => $patient,
            'visits' => $this->visits($patient),
            'success' => '診察を元に戻しました。',
        ]);
    }

    private function findPatient(string $karteNo): Patient
    {
        return Patient::where('karte_no', $karteNo)->firstOrFail();
    }

    /**
     * この動物の診察一覧。削除済みは既定で外す（spec/screens.md画面6「カルテ・印刷…の
     * 通常表示から外れる」）。`$showDeleted=true` で含める（他の削除済み一覧と同じ規則）。
     *
     * 【仮決め】この既定挙動により、削除済みVisitに紐づくProgressNoteは既定表示では
     * 読めなくなる。spec/acceptance.md 検算3は「data/seed.jsonの全ProgressNote行を
     * カルテ画面から読む」としており、厳密には `?show_deleted=1` を付けて読む必要がある
     * （該当は visit_id=33 の1行のみ。qa/lane-c.md に記録する）。
     */
    private function visits(Patient $patient, bool $showDeleted = false): Collection
    {
        $query = $patient->visits()->with(['progressNotes'])->orderBy('visit_date')->orderBy('visit_no');
        if (! $showDeleted) {
            $query->visible();
        }

        return $query->get();
    }
}
