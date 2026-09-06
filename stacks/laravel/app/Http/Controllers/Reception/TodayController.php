<?php

namespace App\Http\Controllers\Reception;

use App\Http\Controllers\Controller;
use App\Models\Reception;
use App\Models\Visit;
use App\Support\BusinessClock;
use Illuminate\Contracts\View\View;
use Illuminate\Http\Request;

/** 本日の患者（一覧）。契約は spec/openapi.yaml `/today`。 */
class TodayController extends Controller
{
    public function index(Request $request): View
    {
        // 「本日」は種データのアンカー日で判定する（App\Support\BusinessClock）。
        // 実際の壁時計を使うと、アンカー日以外に開いた瞬間ぜんぶ0件に見える
        // （2026-09-06 実測）。
        $today = BusinessClock::todayString();

        $query = Reception::with('patient.owner')->whereDate('received_at', $today);

        // 既定は完了行も出す（screens.md画面1：「完了表示」既定は出す。行は消えない）。
        if ($request->query('hide') === '1') {
            $query->where('status', '!=', 'done');
        }

        $receptions = $query->orderBy('display_no')->get();

        // 対象日の診察件数（Visitの件数。Receptionの完了件数とは別の数値。トップと一致させる）。
        $visitCountToday = Visit::query()->whereDate('visit_date', $today)->count();

        return view('reception.today', [
            'receptions' => $receptions,
            'visitCountToday' => $visitCountToday,
            'hideDone' => $request->query('hide') === '1',
        ]);
    }
}
