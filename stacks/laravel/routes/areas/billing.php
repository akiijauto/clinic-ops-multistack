<?php

use App\Http\Controllers\Billing\DmController;
use App\Http\Controllers\Billing\SalesScreenController;
use Illuminate\Support\Facades\Route;

/*
| 領域: billing
| ここはこの領域の担当だけが書く。他の領域のファイルには触れない。
| コントローラは App\Http\Controllers\Billing 配下、
| ビューは resources/views/billing 配下に置く。
*/

Route::get('/sales', [SalesScreenController::class, 'index'])->name('sales');
Route::get('/dm', [DmController::class, 'index'])->name('dm');
