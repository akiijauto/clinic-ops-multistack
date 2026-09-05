<?php

use App\Http\Controllers\Top\TopController;
use Illuminate\Support\Facades\Route;

/*
| レーンC（PHP / Laravel）のルート。
|
| 契約は spec/openapi.yaml が正。ここは統合点（レーンC自身が書く）。
| 各領域のルートは routes/areas/*.php に分けてあり、担当ごとに別ファイルを触る
| （同じファイルに全員が書き込むと衝突するため）。
|
| 領域とファイルの対応:
|   1 受付・患者         -> routes/areas/reception.php
|   2 診療               -> routes/areas/clinical.php
|   3 会計・売上         -> routes/areas/billing.php
|   4 入院・予約・業務   -> routes/areas/ops.php
|   5 設定               -> routes/areas/settings.php
*/

// 死活監視。契約は /healthz（spec/openapi.yaml:1041）。
Route::get('/healthz', fn () => response()->json(['status' => 'ok']))->name('healthz');

// 【仮決め】土台の段階の名残（coordination/qa/lane-c.md B5）。契約に無いので不要なら消す。
Route::get('/health', fn () => response()->json(['status' => 'ok']))->name('health.alias');

// トップ・このシステムについて。どの領域にも属さない共通ページなので統合点として直接書く。
Route::get('/', [TopController::class, 'index'])->name('top');
Route::get('/about', [TopController::class, 'about'])->name('about');

foreach ([
    'reception',
    'clinical',
    'billing',
    'ops',
    'settings',
] as $area) {
    $file = __DIR__."/areas/{$area}.php";
    if (is_file($file)) {
        require $file;
    }
}
