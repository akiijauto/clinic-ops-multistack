<?php

namespace App\Http\Controllers\Top;

use App\Http\Controllers\Controller;
use App\Models\Reception;
use Illuminate\Contracts\View\View;

/**
 * トップ・このシステムについて。契約は spec/openapi.yaml `/` `/about`。
 * どちらの画面にも属さない共通ページなので web.php 直下に置く（レーンCが統合点として書く）。
 */
class TopController extends Controller
{
    public function index(): View
    {
        $todayCount = Reception::whereDate('received_at', now()->toDateString())->count();

        return view('top.index', ['todayCount' => $todayCount]);
    }

    /** DBに繋がらなくても開ける画面（spec/openapi.yaml）。DBは一切参照しない。 */
    public function about(): View
    {
        return view('top.about');
    }
}
