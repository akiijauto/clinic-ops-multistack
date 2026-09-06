<?php

namespace App\Http\Controllers\Reception;

use App\Http\Controllers\Controller;
use App\Models\Patient;
use App\Support\ApiError;
use Illuminate\Contracts\View\View;
use Symfony\Component\HttpFoundation\Response;

/**
 * 来院履歴（画面5）。契約: spec/openapi.yaml `/animals/{karte_no}/history`。
 *
 * 【仮決め】spec/model.md は AuditLog（監査ログ）を明示的にスコープ外としている
 * （「落としたもの」表）が、spec/screens.md 画面5は「変わった内容（前後の値）」の
 * 表示を求めている。フィールド単位の変更前後を追う仕組みは持たないため、この実装は
 * Visit（削除済みも含む）の一覧と、削除済み行の復元だけを提供する簡略版とする。
 * coordination/qa/lane-c.md に記録する。
 */
class HistoryController extends Controller
{
    public function index(string $karteNo): View|Response
    {
        $patient = Patient::query()->where('karte_no', $karteNo)->first();
        if ($patient === null) {
            return ApiError::response(ApiError::NOT_FOUND);
        }

        $visits = $patient->visits()->orderByDesc('visit_date')->orderByDesc('visit_no')->get();

        return view('reception.history', ['patient' => $patient, 'visits' => $visits]);
    }

    public function restore(string $karteNo, int $visitId): View|Response
    {
        $patient = Patient::query()->where('karte_no', $karteNo)->first();
        if ($patient === null) {
            return ApiError::response(ApiError::NOT_FOUND);
        }

        $visit = $patient->visits()->where('id', $visitId)->first();
        if ($visit === null) {
            return ApiError::response(ApiError::NOT_FOUND);
        }

        $visit->restore();

        return view('reception.history', [
            'patient' => $patient,
            'visits' => $patient->visits()->orderByDesc('visit_date')->orderByDesc('visit_no')->get(),
            'restored' => true,
        ]);
    }
}
