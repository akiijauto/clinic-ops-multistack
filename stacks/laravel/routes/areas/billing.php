<?php

use App\Http\Controllers\Billing\AccountingController;
use App\Http\Controllers\Billing\AccountingHistoryController;
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
Route::get('/dm.csv', [DmController::class, 'csv'])->name('dm.csv');

Route::get('/animals/{karte_no}/accounting', [AccountingController::class, 'show'])->name('animals.accounting');
Route::post('/animals/{karte_no}/accounting', [AccountingController::class, 'addDetail'])->name('animals.accounting.add');
Route::post('/animals/{karte_no}/accounting/details/{detail_id}/remove', [AccountingController::class, 'removeDetail'])->name('animals.accounting.remove');
Route::post('/animals/{karte_no}/accounting/{billing_id}/clear', [AccountingController::class, 'clearDetails'])->name('animals.accounting.clear');
Route::post('/animals/{karte_no}/accounting/{billing_id}/confirm', [AccountingController::class, 'confirm'])->name('animals.accounting.confirm');

Route::get('/animals/{karte_no}/accounting/history', [AccountingHistoryController::class, 'index'])->name('animals.accounting.history');
