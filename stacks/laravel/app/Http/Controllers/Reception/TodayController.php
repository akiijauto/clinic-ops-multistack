<?php

namespace App\Http\Controllers\Reception;

use App\Http\Controllers\Controller;
use App\Models\Reception;
use App\Models\Visit;
use App\Support\BusinessClock;
use App\Support\FixedData;
use Illuminate\Contracts\View\View;
use Illuminate\Http\Request;

/**
 * 本日の患者（一覧）。契約は spec/openapi.yaml `/today`。
 *
 * `kind`（受付区分タブ）は`data/masters.json`の`reception_kinds`（code）で絞り込む。
 * 契約の説明どおり、省略時・未知の区分が来たときは空一覧にせず**マスタの1つ目**へ戻す
 * （2026-09-06レビュー指摘。以前はタブ自体が存在しなかった）。
 * `Reception.medical_purpose`には区分の表示名（例:「初診」）がそのまま入っている
 * （`code`ではない。`data/seed.json`実測）。
 */
class TodayController extends Controller
{
    public function index(Request $request): View
    {
        // 「本日」は実際の壁時計（App\Support\BusinessClock、2026-09-06裁定で変更）。
        $today = BusinessClock::todayString();

        $kinds = FixedData::master('reception_kinds');
        $requestedKind = $request->query('kind');
        $kind = collect($kinds)->firstWhere('code', $requestedKind) ?? $kinds[0];

        $query = Reception::with('patient.owner')
            ->whereDate('received_at', $today)
            ->where('medical_purpose', $kind['name']);

        // 既定は完了行も出す（screens.md画面1：「完了表示」既定は出す。行は消えない）。
        if ($request->query('hide') === '1') {
            $query->where('status', '!=', 'done');
        }

        $receptions = $query->orderBy('display_no')->get();

        // 対象日の診察件数（Visitの件数。Receptionの完了件数とは別の数値。トップと一致させる）。
        // 区分タブでは絞らない（画面1「対象日の診察件数」はタブと無関係の全体件数）。
        $visitCountToday = Visit::query()->whereDate('visit_date', $today)->count();

        return view('reception.today', [
            'receptions' => $receptions,
            'visitCountToday' => $visitCountToday,
            'hideDone' => $request->query('hide') === '1',
            'kinds' => $kinds,
            'currentKind' => $kind['code'],
        ]);
    }
}
