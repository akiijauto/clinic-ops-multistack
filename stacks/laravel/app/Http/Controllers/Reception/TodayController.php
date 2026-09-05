<?php

namespace App\Http\Controllers\Reception;

use App\Http\Controllers\Controller;
use App\Models\Reception;
use Illuminate\Contracts\View\View;
use Illuminate\Http\Request;

/** 本日の患者（一覧）。契約は spec/openapi.yaml `/today`。 */
class TodayController extends Controller
{
    public function index(Request $request): View
    {
        $query = Reception::with('patient')
            ->whereDate('received_at', now()->toDateString());

        if ($request->query('hide') === '1') {
            $query->where('status', '!=', 'done');
        }

        $receptions = $query->orderBy('received_at')->get();

        return view('reception.today', ['receptions' => $receptions]);
    }
}
