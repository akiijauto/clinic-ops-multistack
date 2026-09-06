<?php

namespace App\Http\Controllers\Clinical;

use App\Http\Controllers\Controller;
use App\Models\Dosing;
use App\Models\Patient;
use App\Support\ApiError;
use App\Support\BusinessClock;
use App\Support\FixedData;
use Illuminate\Http\Request;
use Illuminate\View\View;
use Symfony\Component\HttpFoundation\Response;

/**
 * 投薬（画面11）。契約: spec/openapi.yaml `/animals/{karte_no}/dosing/{kind_id}`。
 * kind_id は data/masters.json の prevention_kinds 配列の添字（0始まり）。
 */
class DosingController extends Controller
{
    private const MONTHS = ['m01','m02','m03','m04','m05','m06','m07','m08','m09','m10','m11','m12'];

    private function kindCode(int $kindId): ?string
    {
        $kinds = FixedData::master('prevention_kinds');

        return $kinds[$kindId]['code'] ?? null;
    }

    public function show(Request $request, string $karteNo, int $kindId): View|Response
    {
        $patient = Patient::where('karte_no', $karteNo)->first();
        $code = $this->kindCode($kindId);
        if ($patient === null || $code === null) {
            return ApiError::response(ApiError::NOT_FOUND);
        }

        $fiscalYear = (int) $request->query('fiscal_year', BusinessClock::today()->year);
        $rows = Dosing::where('patient_id', $patient->id)->where('kind', $code)->orderByDesc('fiscal_year')->get();

        return view('clinical.dosing', [
            'patient' => $patient,
            'kindId' => $kindId,
            'kindName' => FixedData::master('prevention_kinds')[$kindId]['name'],
            'fiscalYear' => $fiscalYear,
            'rows' => $rows,
            'current' => $rows->firstWhere('fiscal_year', $fiscalYear),
        ]);
    }

    public function store(Request $request, string $karteNo, int $kindId): View|Response
    {
        $patient = Patient::where('karte_no', $karteNo)->first();
        $code = $this->kindCode($kindId);
        if ($patient === null || $code === null) {
            return ApiError::response(ApiError::NOT_FOUND);
        }

        $fiscalYear = (int) $request->input('fiscal_year', 0);
        // 年度を入れずに送信しても、新しい行は増えない（screens.md画面11「満たすべきこと」）。
        if ($fiscalYear <= 0) {
            return $this->render($patient, $kindId, BusinessClock::today()->year, 'year_missing');
        }

        $values = [];
        foreach (self::MONTHS as $m) {
            // チェックボックス（送られなかった月=未チェック）と「外した月」を区別しないため、
            // 送られてきた集合をそのまま保存する（未チェック=送信されない=空文字で確定）。
            $values[$m] = $request->has("months.$m") ? '○' : '';
        }

        $row = Dosing::firstOrNew(['patient_id' => $patient->id, 'kind' => $code, 'fiscal_year' => $fiscalYear]);
        $row->fill($values);
        $row->save();

        return $this->render($patient, $kindId, $fiscalYear, null, '保存しました。');
    }

    private function render(Patient $patient, int $kindId, int $fiscalYear, ?string $error = null, ?string $success = null): View
    {
        $code = $this->kindCode($kindId);
        $rows = Dosing::where('patient_id', $patient->id)->where('kind', $code)->orderByDesc('fiscal_year')->get();

        return view('clinical.dosing', [
            'patient' => $patient,
            'kindId' => $kindId,
            'kindName' => FixedData::master('prevention_kinds')[$kindId]['name'],
            'fiscalYear' => $fiscalYear,
            'rows' => $rows,
            'current' => $rows->firstWhere('fiscal_year', $fiscalYear),
            'error' => $error === 'year_missing' ? '年度を入力してください。' : $error,
            'success' => $success,
        ]);
    }
}
