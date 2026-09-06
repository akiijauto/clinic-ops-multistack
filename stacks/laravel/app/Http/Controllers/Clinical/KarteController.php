<?php

namespace App\Http\Controllers\Clinical;

use App\Http\Controllers\Controller;
use App\Models\Patient;
use App\Models\Visit;
use App\Support\ApiError;
use Illuminate\Contracts\View\View;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * カルテ画面。契約は spec/openapi.yaml `/animals/{karte_no}/karte` `.../karte/print`
 * `.../karte/{visit_id}/delete` `.../karte/{visit_id}/restore`。
 *
 * 通常画面と印刷画面は**同じデータ取得・同じ部分テンプレート**（resources/views/clinical/_visits.blade.php）
 * を使う。別々に組み立てると「印刷側だけ古い計算式が残る」食い違い（検算4）が起きるため。
 */
class KarteController extends Controller
{
    public function show(string $karteNo): View
    {
        $patient = $this->findPatient($karteNo);

        return view('clinical.karte', [
            'patient' => $patient,
            'visits' => $this->visits($patient),
        ]);
    }

    public function print(string $karteNo): View
    {
        $patient = $this->findPatient($karteNo);

        return view('clinical.karte_print', [
            'patient' => $patient,
            'visits' => $this->visits($patient),
        ]);
    }

    /**
     * 診察の削除（画面6）。理由は必須（spec/screens.md画面6「満たすべきこと」）。
     *
     * 【仮決め】AuditLog は spec/model.md でスコープ外のため、理由文字列は
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
     * この動物の全診察分（検算3・4は seed.json の全 ProgressNote 行が対象のため、絞り込まない）。
     * Visit に既定の除外スコープは無い（App\Support\SoftDeletable は明示スコープのみ提供）。
     */
    private function visits(Patient $patient): Collection
    {
        return $patient->visits()
            ->with(['progressNotes'])
            ->orderBy('visit_date')
            ->orderBy('visit_no')
            ->get();
    }
}
