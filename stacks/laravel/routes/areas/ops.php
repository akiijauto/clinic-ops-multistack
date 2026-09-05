<?php

use App\Http\Controllers\Ops\ReservationsController;
use App\Http\Controllers\Ops\StaffController;
use App\Http\Controllers\Ops\WardController;
use Illuminate\Support\Facades\Route;

/*
| 領域: ops
| ここはこの領域の担当だけが書く。他の領域のファイルには触れない。
| コントローラは App\Http\Controllers\Ops 配下、
| ビューは resources/views/ops 配下に置く。
*/

Route::get('/reservations', [ReservationsController::class, 'index'])->name('reservations');
Route::get('/ward', [WardController::class, 'index'])->name('ward');
Route::get('/staff', [StaffController::class, 'index'])->name('staff');
