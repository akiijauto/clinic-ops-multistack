<?php

namespace App\Http\Controllers\Clinical;

use App\Http\Controllers\Controller;
use App\Models\Patient;
use Illuminate\Contracts\View\View;
use Illuminate\Database\Eloquent\Collection;

/**
 * カルテ画面。契約は spec/openapi.yaml `/animals/{karte_no}/karte` `.../karte/print`。
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
