<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Dosing;
use App\Models\Patient;
use App\Support\ApiError;
use App\Support\BusinessClock;
use App\Support\FixedData;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * 投薬APIの表示・更新。契約は spec/openapi.yaml `/api/patients/{karte_no}/dosing/{kind_id}`。
 *
 * `kind_id` は `prevention_kinds` 配列の添字（0始まり）または code文字列
 * （例: "heartworm"）のどちらでも受け付ける。実データの `dosings.kind` は
 * 数値添字ではなくcode文字列を直接持っているため（裁定R-20、2026-09-06実測）。
 * 記録が1件も無いのは正常（404ではなく、空欄のDosingを200で返す）。
 */
class DosingController extends Controller
{
    private const MONTHS = ['m01', 'm02', 'm03', 'm04', 'm05', 'm06', 'm07', 'm08', 'm09', 'm10', 'm11', 'm12'];

    public function show(Request $request, string $karteNo, string $kindId): JsonResponse
    {
        $patient = Patient::where('karte_no', $karteNo)->first();
        $kind = FixedData::preventionKind($kindId);
        if ($patient === null || $kind === null) {
            return ApiError::response(ApiError::NOT_FOUND);
        }
        $code = $kind['code'];

        $fiscalYear = (int) $request->query('fiscal_year', BusinessClock::today()->year);
        $row = Dosing::where('patient_id', $patient->id)->where('kind', $code)->where('fiscal_year', $fiscalYear)->first();

        return response()->json(self::plain($row, $patient->id, $code, $fiscalYear));
    }

    public function update(Request $request, string $karteNo, string $kindId): JsonResponse
    {
        $patient = Patient::where('karte_no', $karteNo)->first();
        $kind = FixedData::preventionKind($kindId);
        if ($patient === null || $kind === null) {
            return ApiError::response(ApiError::NOT_FOUND);
        }
        $code = $kind['code'];

        $fiscalYear = (int) $request->input('fiscal_year', 0);
        if ($fiscalYear <= 0) {
            return ApiError::response(ApiError::INVALID_INPUT, [
                ['field' => 'fiscal_year', 'message' => '年度は必須です。'],
            ]);
        }

        $row = Dosing::firstOrNew(['patient_id' => $patient->id, 'kind' => $code, 'fiscal_year' => $fiscalYear]);
        foreach (self::MONTHS as $m) {
            if ($request->has($m)) {
                $row->{$m} = $request->input($m);
            }
        }
        $row->save();

        return response()->json(self::plain($row, $patient->id, $code, $fiscalYear));
    }

    private static function plain(?Dosing $row, int $patientId, string $kind, int $fiscalYear): array
    {
        $out = [
            'id' => $row?->id,
            'patient_id' => $patientId,
            'kind' => $kind,
            'fiscal_year' => $fiscalYear,
        ];
        foreach (self::MONTHS as $m) {
            $out[$m] = $row?->{$m};
        }

        return $out;
    }
}
