<?php

use App\Http\Controllers\Clinical\KarteController;
use Illuminate\Support\Facades\Route;

/*
| 領域: clinical
| ここはこの領域の担当だけが書く。他の領域のファイルには触れない。
| コントローラは App\Http\Controllers\Clinical 配下、
| ビューは resources/views/clinical 配下に置く。
*/

Route::get('/animals/{karte_no}/karte', [KarteController::class, 'show'])->name('animals.karte');
Route::get('/animals/{karte_no}/karte/print', [KarteController::class, 'print'])->name('animals.karte.print');
