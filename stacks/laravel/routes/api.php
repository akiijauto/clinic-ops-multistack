<?php

use App\Http\Controllers\Api\BillingController;
use App\Http\Controllers\Api\CareRecordController;
use App\Http\Controllers\Api\DmController;
use App\Http\Controllers\Api\DosingController;
use App\Http\Controllers\Api\FeatureController;
use App\Http\Controllers\Api\HospitalizationController;
use App\Http\Controllers\Api\LabTestController;
use App\Http\Controllers\Api\MasterController;
use App\Http\Controllers\Api\OwnerController;
use App\Http\Controllers\Api\PaperController;
use App\Http\Controllers\Api\PatientController;
use App\Http\Controllers\Api\PreventionController;
use App\Http\Controllers\Api\ReceptionController;
use App\Http\Controllers\Api\ReservationController;
use App\Http\Controllers\Api\SalesSummaryController;
use App\Http\Controllers\Api\StaffController;
use App\Http\Controllers\Api\VisitController;
use App\Http\Controllers\Api\WardController;
use Illuminate\Support\Facades\Route;

/*
| API ルート。`/api` プレフィックスは bootstrap/app.php の withRouting(api: ...) が自動で付ける。
| 契約は spec/openapi.yaml。統合点としてレーンC自身が書く（各領域のAPIもここへ追加していく）。
*/

// ---- 受付・患者 ----
Route::get('/patients', [PatientController::class, 'index'])->name('api.patients.index');
Route::get('/patients/{karte_no}', [PatientController::class, 'show'])->name('api.patients.show');
Route::patch('/patients/{karte_no}', [PatientController::class, 'update'])->name('api.patients.update');
Route::post('/patients/{karte_no}/delete', [PatientController::class, 'delete'])->name('api.patients.delete');
Route::post('/patients/{karte_no}/restore', [PatientController::class, 'restore'])->name('api.patients.restore');

Route::get('/owners/{owner_no}', [OwnerController::class, 'show'])->name('api.owners.show');
Route::patch('/owners/{owner_no}', [OwnerController::class, 'update'])->name('api.owners.update');
Route::post('/owners/{owner_no}/delete', [OwnerController::class, 'delete'])->name('api.owners.delete');

Route::get('/receptions', [ReceptionController::class, 'index'])->name('api.receptions.index');
Route::post('/receptions', [ReceptionController::class, 'store'])->name('api.receptions.store');
Route::post('/patients/{karte_no}/receptions', [ReceptionController::class, 'storeForPatient'])->name('api.patients.receptions.store');
Route::get('/receptions/{id}', [ReceptionController::class, 'show'])->name('api.receptions.show');
Route::patch('/receptions/{id}', [ReceptionController::class, 'update'])->name('api.receptions.update');

// ---- 診療 ----
Route::get('/patients/{karte_no}/visits', [VisitController::class, 'index'])->name('api.patients.visits.index');
Route::post('/patients/{karte_no}/visits', [VisitController::class, 'store'])->name('api.patients.visits.store');
Route::get('/visits/{visit_id}', [VisitController::class, 'show'])->name('api.visits.show');
Route::patch('/visits/{visit_id}', [VisitController::class, 'update'])->name('api.visits.update');
Route::post('/visits/{visit_id}/delete', [VisitController::class, 'delete'])->name('api.visits.delete');
Route::post('/visits/{visit_id}/restore', [VisitController::class, 'restore'])->name('api.visits.restore');

Route::get('/patients/{karte_no}/lab-tests', [LabTestController::class, 'index'])->name('api.patients.lab-tests.index');
Route::post('/patients/{karte_no}/lab-tests', [LabTestController::class, 'store'])->name('api.patients.lab-tests.store');
Route::get('/lab-tests/{labTest}', [LabTestController::class, 'show'])->name('api.lab-tests.show');

Route::get('/patients/{karte_no}/dosing/{kind_id}', [DosingController::class, 'show'])->name('api.patients.dosing.show');
Route::patch('/patients/{karte_no}/dosing/{kind_id}', [DosingController::class, 'update'])->name('api.patients.dosing.update');

Route::get('/patients/{karte_no}/prevention/{kind_id}', [PreventionController::class, 'index'])->name('api.patients.prevention.index');
Route::post('/patients/{karte_no}/prevention/{kind_id}', [PreventionController::class, 'store'])->name('api.patients.prevention.store');

Route::get('/patients/{karte_no}/papers', [PaperController::class, 'index'])->name('api.patients.papers.index');
Route::post('/patients/{karte_no}/papers', [PaperController::class, 'store'])->name('api.patients.papers.store');
Route::get('/papers/{paper_id}', [PaperController::class, 'show'])->name('api.papers.show');
Route::delete('/papers/{paper_id}', [PaperController::class, 'destroy'])->name('api.papers.destroy');

// ---- 会計・売上 ----
Route::get('/patients/{karte_no}/billings', [BillingController::class, 'indexForPatient'])->name('api.patients.billings.index');
Route::post('/patients/{karte_no}/billings', [BillingController::class, 'storeForPatient'])->name('api.patients.billings.store');
Route::get('/owners/{owner_no}/billings', [BillingController::class, 'indexForOwner'])->name('api.owners.billings.index');
Route::get('/billings', [BillingController::class, 'index'])->name('api.billings.index');
Route::get('/billings/{billing}', [BillingController::class, 'show'])->name('api.billings.show');
Route::patch('/billings/{billing}', [BillingController::class, 'update'])->name('api.billings.update');

Route::get('/dm', [DmController::class, 'index'])->name('api.dm.index');
Route::get('/sales/summary', SalesSummaryController::class)->name('api.sales.summary');

// ---- 入院・予約 ----
Route::get('/ward', [WardController::class, 'day'])->name('api.ward.day');

Route::get('/patients/{karte_no}/hospitalizations', [HospitalizationController::class, 'index'])->name('api.patients.hospitalizations.index');
Route::post('/patients/{karte_no}/hospitalizations', [HospitalizationController::class, 'store'])->name('api.patients.hospitalizations.store');
Route::get('/hospitalizations/{hospitalization}', [HospitalizationController::class, 'show'])->name('api.hospitalizations.show');
Route::patch('/hospitalizations/{hospitalization}', [HospitalizationController::class, 'update'])->name('api.hospitalizations.update');
Route::get('/hospitalizations/{hospitalization}/care-records', [HospitalizationController::class, 'careRecords'])
    ->name('api.hospitalizations.care-records');
Route::post('/hospitalizations/{hospitalization}/care-records', [CareRecordController::class, 'store'])
    ->name('api.hospitalizations.care-records.store');

Route::get('/reservations', [ReservationController::class, 'index'])->name('api.reservations.index');
Route::post('/reservations', [ReservationController::class, 'store'])->name('api.reservations.store');
Route::get('/reservations/{id}', [ReservationController::class, 'show'])->name('api.reservations.show');
Route::patch('/reservations/{id}', [ReservationController::class, 'update'])->name('api.reservations.update');
Route::post('/reservations/{id}/cancel', [ReservationController::class, 'cancel'])->name('api.reservations.cancel');

// ---- スタッフ・マスタ・その他 ----
Route::get('/staff', [StaffController::class, 'index'])->name('api.staff.index');
Route::get('/features', [FeatureController::class, 'index'])->name('api.features.index');
Route::get('/todo/{key}', [FeatureController::class, 'todo'])->name('api.todo.show');
Route::get('/masters/{key}', [MasterController::class, 'show'])->name('api.masters.show');
