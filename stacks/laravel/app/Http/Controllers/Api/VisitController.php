<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Patient;
use App\Models\ProgressNote;
use App\Models\Visit;
use App\Support\ApiError;
use App\Support\CurrentStaff;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * 診察（カルテ）のAPI。契約は spec/openapi.yaml `/api/patients/{karte_no}/visits`
 * `/api/visits/{visit_id}` `/api/visits/{visit_id}/delete` `/api/visits/{visit_id}/restore`。
 * 画面側（Clinical\KarteController）と同じモデルを使う。
 */
class VisitController extends Controller
{
    public function index(Request $request, string $karteNo): JsonResponse
    {
        $patient = Patient::where('karte_no', $karteNo)->first();
        if ($patient === null) {
            return ApiError::response(ApiError::NOT_FOUND);
        }

        $includeDeleted = $request->boolean('include_deleted', false);
        $limit = min(max((int) $request->query('limit', 50), 1), 200);
        $offset = max((int) $request->query('offset', 0), 0);

        $query = $patient->visits()->with('progressNotes');
        if (! $includeDeleted) {
            $query->visible();
        }

        $total = (clone $query)->count();
        $items = $query->orderBy('visit_date')->orderBy('visit_no')->skip($offset)->take($limit)->get();

        return response()->json(['items' => $items->map(fn ($v) => self::plain($v))->values(), 'total' => $total]);
    }

    public function store(Request $request, string $karteNo): JsonResponse
    {
        $patient = Patient::where('karte_no', $karteNo)->first();
        if ($patient === null) {
            return ApiError::response(ApiError::NOT_FOUND);
        }

        $visitDate = $request->input('visit_date');
        if (! $visitDate) {
            return ApiError::response(ApiError::INVALID_INPUT, [
                ['field' => 'visit_date', 'message' => '来院日は必須です。'],
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
                'staff_id' => $request->input('staff_id', CurrentStaff::id()),
            ]);

            $this->saveProgressNotes($visit, (array) $request->input('progress_notes', []), $visitDate);

            return $visit;
        });

        return response()->json(self::plain($visit->fresh('progressNotes')), 201);
    }

    public function show(int $visitId): JsonResponse
    {
        $visit = Visit::with('progressNotes')->find($visitId);
        if ($visit === null) {
            return ApiError::response(ApiError::NOT_FOUND);
        }

        return response()->json(self::plain($visit));
    }

    public function update(Request $request, int $visitId): JsonResponse
    {
        $visit = Visit::find($visitId);
        if ($visit === null) {
            return ApiError::response(ApiError::NOT_FOUND);
        }

        DB::transaction(function () use ($request, $visit) {
            $visit->fill($request->only([
                'visit_date', 'visit_time', 'body_weight_kg', 'chief_complaint',
                'symptom', 'diagnosis', 'treatment', 'staff_id',
            ]))->save();

            if ($request->has('progress_notes')) {
                // 送られてきた行で置き換える（VisitCreateは作成・更新で同じ形。行ごとに独立して保存する。検算3）。
                $visit->progressNotes()->delete();
                $this->saveProgressNotes($visit, (array) $request->input('progress_notes', []), $visit->visit_date->toDateString());
            }
        });

        return response()->json(self::plain($visit->fresh('progressNotes')));
    }

    public function delete(int $visitId): JsonResponse
    {
        $visit = Visit::find($visitId);
        if ($visit === null) {
            return ApiError::response(ApiError::NOT_FOUND);
        }

        $visit->softDelete();

        return response()->json(self::plain($visit->fresh('progressNotes')));
    }

    public function restore(int $visitId): JsonResponse
    {
        $visit = Visit::find($visitId);
        if ($visit === null) {
            return ApiError::response(ApiError::NOT_FOUND);
        }

        $visit->restore();

        return response()->json(self::plain($visit->fresh('progressNotes')));
    }

    private function saveProgressNotes(Visit $visit, array $rows, string $visitDate): void
    {
        $rowNo = 1;
        foreach ($rows as $row) {
            $hasAny = collect($row)->filter(fn ($v) => trim((string) $v) !== '')->isNotEmpty();
            if (! $hasAny) {
                continue;
            }
            ProgressNote::create([
                'visit_id' => $visit->id,
                'row_no' => $row['row_no'] ?? $rowNo,
                'entry_date' => $row['entry_date'] ?? $visitDate,
                'temperature_c' => ($row['temperature_c'] ?? '') !== '' ? $row['temperature_c'] : null,
                'pulse' => ($row['pulse'] ?? '') !== '' ? $row['pulse'] : null,
                'respiration' => ($row['respiration'] ?? '') !== '' ? $row['respiration'] : null,
                'body_weight_kg' => ($row['body_weight_kg'] ?? '') !== '' ? $row['body_weight_kg'] : null,
                'symptom_course' => $row['symptom_course'] ?? null,
                'treatment_rx' => $row['treatment_rx'] ?? null,
                'note' => $row['note'] ?? null,
            ]);
            $rowNo++;
        }
    }

    public static function plain(Visit $v): array
    {
        return [
            'id' => $v->id,
            'patient_id' => $v->patient_id,
            'visit_no' => $v->visit_no,
            'visit_date' => $v->visit_date->toDateString(),
            'visit_time' => $v->visit_time,
            'body_weight_kg' => $v->body_weight_kg !== null ? (float) $v->body_weight_kg : null,
            'chief_complaint' => $v->chief_complaint,
            'symptom' => $v->symptom,
            'diagnosis' => $v->diagnosis,
            'treatment' => $v->treatment,
            'staff_id' => $v->staff_id,
            'deleted_at' => optional($v->deleted_at)->toJSON(),
            'progress_notes' => $v->progressNotes->map(fn ($n) => [
                'id' => $n->id,
                'visit_id' => $n->visit_id,
                'row_no' => $n->row_no,
                'entry_date' => $n->entry_date->toDateString(),
                'temperature_c' => $n->temperature_c !== null ? (float) $n->temperature_c : null,
                'pulse' => $n->pulse,
                'respiration' => $n->respiration,
                'body_weight_kg' => $n->body_weight_kg !== null ? (float) $n->body_weight_kg : null,
                'symptom_course' => $n->symptom_course,
                'treatment_rx' => $n->treatment_rx,
                'note' => $n->note,
            ])->values(),
        ];
    }
}
