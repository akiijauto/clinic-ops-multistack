<?php

use App\Http\Controllers\Api\BillingController;
use App\Http\Controllers\Api\HospitalizationController;
use App\Http\Controllers\Api\LabTestController;
use App\Http\Controllers\Api\ReservationController;
use App\Http\Controllers\Api\SalesSummaryController;
use Illuminate\Support\Facades\Route;

/*
| API ルート。`/api` プレフィックスは bootstrap/app.php の withRouting(api: ...) が自動で付ける。
| 契約は spec/openapi.yaml。統合点としてレーンC自身が書く（各領域のAPIもここへ追加していく）。
*/

Route::get('/billings/{billing}', [BillingController::class, 'show'])->name('api.billings.show');
Route::get('/sales/summary', SalesSummaryController::class)->name('api.sales.summary');
Route::get('/lab-tests/{labTest}', [LabTestController::class, 'show'])->name('api.lab-tests.show');
Route::get('/reservations', [ReservationController::class, 'index'])->name('api.reservations.index');
Route::get('/hospitalizations/{hospitalization}/care-records', [HospitalizationController::class, 'careRecords'])
    ->name('api.hospitalizations.care-records');
