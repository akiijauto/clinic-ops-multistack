<?php

namespace App\Http\Controllers\Top;

use App\Http\Controllers\Controller;
use Illuminate\Contracts\View\View;

/**
 * トップ・このシステムについて。契約は spec/openapi.yaml `/` `/about`。
 * どちらの画面にも属さない共通ページなので web.php 直下に置く（レーンCが統合点として書く）。
 *
 * トップの本文は spec/screens.md「トップ画面の本文」追記（2026-09-06）で
 * 「h1・3点の説明・本日の患者への導線1本」だけに絞られた。対象日の診察件数
 * （旧・画面独自の`visit_count.today`表示）はこの画面の要件ではなくなったため、
 * DBを参照する必要が無くなった。
 */
class TopController extends Controller
{
    public function index(): View
    {
        return view('top.index');
    }

    /** DBに繋がらなくても開ける画面（spec/openapi.yaml）。DBは一切参照しない。 */
    public function about(): View
    {
        return view('top.about');
    }
}
