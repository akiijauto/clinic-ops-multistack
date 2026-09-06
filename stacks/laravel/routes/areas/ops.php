<?php

use App\Http\Controllers\Ops\AnimalWardController;
use App\Http\Controllers\Ops\ReservationsController;
use App\Http\Controllers\Ops\StaffController;
use App\Http\Controllers\Ops\TodoController;
use App\Http\Controllers\Ops\WardController;
use Illuminate\Support\Facades\Route;

/*
| 領域: ops
| ここはこの領域の担当だけが書く。他の領域のファイルには触れない。
| コントローラは App\Http\Controllers\Ops 配下、
| ビューは resources/views/ops 配下に置く。
*/

// 「new」を{id}より先に置く（順序が逆だとnewがidとして食われる）。
Route::get('/reservations/new', [ReservationsController::class, 'newForm'])->name('reservations.new');
Route::get('/reservations', [ReservationsController::class, 'index'])->name('reservations');
Route::post('/reservations', [ReservationsController::class, 'create'])->name('reservations.create');
Route::get('/reservations/{id}', [ReservationsController::class, 'show'])->name('reservations.show');
Route::post('/reservations/{id}', [ReservationsController::class, 'update'])->name('reservations.update');
Route::post('/reservations/{id}/cancel', [ReservationsController::class, 'cancel'])->name('reservations.cancel');

Route::get('/ward', [WardController::class, 'index'])->name('ward');
Route::get('/ward/day', [WardController::class, 'day'])->name('ward.day');
Route::get('/animals/{karte_no}/ward', [AnimalWardController::class, 'show'])->name('animals.ward');
Route::post('/animals/{karte_no}/ward', [AnimalWardController::class, 'admit'])->name('animals.ward.admit');
Route::post('/animals/{karte_no}/ward/{hospitalization_id}/care-records', [AnimalWardController::class, 'addCareRecord'])->name('animals.ward.care-record');
Route::post('/animals/{karte_no}/ward/{hospitalization_id}/discharge', [AnimalWardController::class, 'discharge'])->name('animals.ward.discharge');

Route::get('/staff', [StaffController::class, 'index'])->name('staff');
Route::post('/staff/clear', [StaffController::class, 'clear'])->name('staff.clear');
Route::post('/staff/{id}/select', [StaffController::class, 'select'])->name('staff.select');
Route::get('/todo/{key}', [TodoController::class, 'show'])->name('todo');
