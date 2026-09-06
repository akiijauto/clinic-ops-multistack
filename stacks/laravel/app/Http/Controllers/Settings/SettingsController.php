<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Models\Clinic;
use Illuminate\Contracts\View\View;
use Illuminate\Http\Request;

/** 設定（病院設定・画面22）。契約は spec/openapi.yaml `/settings`。 */
class SettingsController extends Controller
{
    public function index(): View
    {
        return view('settings.index', ['clinic' => Clinic::current()]);
    }

    public function update(Request $request): View
    {
        $clinic = Clinic::current();

        $closedWeekdays = array_map('intval', (array) $request->input('closed_weekdays', []));

        $clinic->fill([
            'name' => (string) $request->input('name', $clinic->name),
            'postal_code' => $request->input('postal_code', $clinic->postal_code),
            'address1' => $request->input('address1', $clinic->address1),
            'address2' => $request->input('address2', $clinic->address2),
            'phone' => $request->input('phone', $clinic->phone),
            'fax' => $request->input('fax', $clinic->fax),
            'director_name' => $request->input('director_name', $clinic->director_name),
            'reservation_slot_minutes' => (int) $request->input('reservation_slot_minutes', $clinic->reservation_slot_minutes),
            'tax_rate' => (float) $request->input('tax_rate', $clinic->tax_rate),
            'closed_weekdays' => $closedWeekdays,
        ])->save();

        return view('settings.index', ['clinic' => $clinic->fresh(), 'success' => '保存しました。']);
    }
}
