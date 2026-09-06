<?php

use App\Http\Controllers\Clinical\DosingController;
use App\Http\Controllers\Clinical\ExamController;
use App\Http\Controllers\Clinical\KarteController;
use App\Http\Controllers\Clinical\PaperController;
use App\Http\Controllers\Clinical\PreventionController;
use Illuminate\Support\Facades\Route;

/*
| 領域: clinical
| ここはこの領域の担当だけが書く。他の領域のファイルには触れない。
| コントローラは App\Http\Controllers\Clinical 配下、
| ビューは resources/views/clinical 配下に置く。
*/

Route::get('/animals/{karte_no}/karte', [KarteController::class, 'show'])->name('animals.karte');
Route::get('/animals/{karte_no}/karte/print', [KarteController::class, 'print'])->name('animals.karte.print');
Route::post('/animals/{karte_no}/karte/{visit_id}/delete', [KarteController::class, 'deleteVisit'])->name('animals.karte.visit.delete');
Route::post('/animals/{karte_no}/karte/{visit_id}/restore', [KarteController::class, 'restoreVisit'])->name('animals.karte.visit.restore');

Route::get('/animals/{karte_no}/exam', [ExamController::class, 'show'])->name('animals.exam');
Route::post('/animals/{karte_no}/exam', [ExamController::class, 'store'])->name('animals.exam.store');

Route::get('/animals/{karte_no}/dosing/{kind_id}', [DosingController::class, 'show'])->name('animals.dosing');
Route::post('/animals/{karte_no}/dosing/{kind_id}', [DosingController::class, 'store'])->name('animals.dosing.store');

Route::get('/animals/{karte_no}/prevention/{kind_id}', [PreventionController::class, 'show'])->name('animals.prevention');
Route::post('/animals/{karte_no}/prevention/{kind_id}', [PreventionController::class, 'store'])->name('animals.prevention.store');

Route::get('/animals/{karte_no}/papers', [PaperController::class, 'index'])->name('animals.papers');
Route::post('/animals/{karte_no}/papers', [PaperController::class, 'store'])->name('animals.papers.store');
Route::get('/papers/no-paper', [PaperController::class, 'noPaper'])->name('papers.no-paper');
Route::get('/papers/{paper_id}', [PaperController::class, 'show'])->name('papers.show');
Route::post('/papers/{paper_id}/remove', [PaperController::class, 'remove'])->name('papers.remove');
