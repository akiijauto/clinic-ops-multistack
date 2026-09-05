<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Models\Clinic;
use Illuminate\Contracts\View\View;

/** 設定（病院設定）。契約は spec/openapi.yaml `/settings`。 */
class SettingsController extends Controller
{
    public function index(): View
    {
        return view('settings.index', ['clinic' => Clinic::current()]);
    }
}
