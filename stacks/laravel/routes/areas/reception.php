<?php

use App\Http\Controllers\Reception\FoldedController;
use App\Http\Controllers\Reception\HistoryController;
use App\Http\Controllers\Reception\PatientController;
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

Route::get('/animals/new', [PatientController::class, 'newForm'])->name('animals.new');
Route::post('/animals/new', [PatientController::class, 'create'])->name('animals.create');
Route::get('/animals/{karte_no}', [PatientController::class, 'show'])->name('animals.show');
Route::post('/animals/{karte_no}', [PatientController::class, 'update'])->name('animals.update');
Route::get('/animals/{karte_no}/delete', [PatientController::class, 'deleteConfirm'])->name('animals.delete.confirm');
Route::post('/animals/{karte_no}/delete', [PatientController::class, 'delete'])->name('animals.delete');

Route::get('/animals/{karte_no}/history', [HistoryController::class, 'index'])->name('animals.history');

Route::get('/folded/{key?}', [FoldedController::class, 'show'])->name('folded');
