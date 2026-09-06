<?php

namespace App\Http\Controllers\Top;

use App\Http\Controllers\Controller;
use App\Models\Visit;
use App\Support\BusinessClock;
use Illuminate\Contracts\View\View;

/**
 * トップ・このシステムについて。契約は spec/openapi.yaml `/` `/about`。
 * どちらの画面にも属さない共通ページなので web.php 直下に置く（レーンCが統合点として書く）。
 */
class TopController extends Controller
{
    public function index(): View
    {
        // 「対象日の診察件数」は Visit の件数（Reception の完了件数とは別の数値。
        // spec/screens.md 画面1・画面8）。「本日」は種データのアンカー日
        // （App\Support\BusinessClock）で判定する。
        $todayCount = Visit::query()
            ->whereDate('visit_date', BusinessClock::todayString())
            ->count();

        return view('top.index', ['todayCount' => $todayCount]);
    }

    /** DBに繋がらなくても開ける画面（spec/openapi.yaml）。DBは一切参照しない。 */
    public function about(): View
    {
        return view('top.about');
    }
}
