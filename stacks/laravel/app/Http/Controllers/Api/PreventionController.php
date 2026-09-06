<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Patient;
use App\Models\Prevention;
use App\Support\ApiError;
use App\Support\FixedData;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * 予防APIの一覧・追加。契約は spec/openapi.yaml `/api/patients/{karte_no}/prevention/{kind_id}`。
 *
 * `kind_id` は `prevention_kinds` 配列の添字（0始まり）または code文字列
 * （例: "heartworm"）のどちらでも受け付ける。実データの `preventions.kind` は
 * 数値添字ではなくcode文字列を直接持っているため（裁定R-20、2026-09-06実測）。
 * 記録が1件も無いのは正常（404ではなく、空配列を200で返す）。
 */
class PreventionController extends Controller
{
    public function index(string $karteNo, string $kindId): JsonResponse
    {
        $patient = Patient::where('karte_no', $karteNo)->first();
        $kind = FixedData::preventionKind($kindId);
        if ($patient === null || $kind === null) {
            return ApiError::response(ApiError::NOT_FOUND);
        }

        $items = Prevention::where('patient_id', $patient->id)->where('kind', $kind['code'])->orderByDesc('performed_date')->get();

        return response()->json(['items' => $items->map(fn ($p) => self::plain($p))->values(), 'total' => $items->count()]);
    }

    public function store(Request $request, string $karteNo, string $kindId): JsonResponse
    {
        $patient = Patient::where('karte_no', $karteNo)->first();
        $kind = FixedData::preventionKind($kindId);
        if ($patient === null || $kind === null) {
            return ApiError::response(ApiError::NOT_FOUND);
        }
        $code = $kind['code'];

        $performedDate = $request->input('performed_date');
        if (! $performedDate) {
            return ApiError::response(ApiError::INVALID_INPUT, [
                ['field' => 'performed_date', 'message' => '実施日は必須です。'],
            ]);
        }

        $row = Prevention::create([
            'patient_id' => $patient->id,
            'kind' => $code,
            'content' => $request->input('content'),
            'performed_date' => $performedDate,
            'next_due_date' => $request->input('next_due_date') ?: null,
        ]);

        return response()->json(self::plain($row), 201);
    }

    public static function plain(Prevention $p): array
    {
        return [
            'id' => $p->id,
            'patient_id' => $p->patient_id,
            'kind' => $p->kind,
            'content' => $p->content,
            'performed_date' => $p->performed_date->toDateString(),
            'next_due_date' => optional($p->next_due_date)->toDateString(),
        ];
    }
}
