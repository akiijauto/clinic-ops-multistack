<?php

use App\Http\Controllers\Reception\SearchController;
use App\Http\Controllers\Reception\TodayController;
use Illuminate\Support\Facades\Route;

/*
| 領域: reception
| ここはこの領域の担当だけが書く。他の領域のファイルには触れない。
| コントローラは App\Http\Controllers\Reception 配下、
| ビューは resources/views/reception 配下に置く。
*/

Route::get('/today', [TodayController::class, 'index'])->name('today');
Route::get('/search', [SearchController::class, 'index'])->name('search');
