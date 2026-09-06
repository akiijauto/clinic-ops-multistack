<?php

use App\Http\Controllers\Settings\FeaturesController;
use App\Http\Controllers\Settings\ImportController;
use App\Http\Controllers\Settings\MasterController;
use App\Http\Controllers\Settings\SettingsController;
use Illuminate\Support\Facades\Route;

/*
| 領域: settings
| ここはこの領域の担当だけが書く。他の領域のファイルには触れない。
| コントローラは App\Http\Controllers\Settings 配下、
| ビューは resources/views/settings 配下に置く。
*/

Route::get('/settings', [SettingsController::class, 'index'])->name('settings');
Route::post('/settings', [SettingsController::class, 'update'])->name('settings.update');

Route::get('/settings/features', [FeaturesController::class, 'index'])->name('settings.features');

Route::get('/settings/import', [ImportController::class, 'index'])->name('settings.import');
Route::post('/settings/import', [ImportController::class, 'survey'])->name('settings.import.survey');

Route::get('/settings/master', [MasterController::class, 'index'])->name('settings.master');
Route::get('/settings/master/{key}', [MasterController::class, 'show'])->name('settings.master.show');
