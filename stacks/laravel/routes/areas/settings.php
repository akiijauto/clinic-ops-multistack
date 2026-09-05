<?php

use App\Http\Controllers\Settings\SettingsController;
use Illuminate\Support\Facades\Route;

/*
| 領域: settings
| ここはこの領域の担当だけが書く。他の領域のファイルには触れない。
| コントローラは App\Http\Controllers\Settings 配下、
| ビューは resources/views/settings 配下に置く。
*/

Route::get('/settings', [SettingsController::class, 'index'])->name('settings');
