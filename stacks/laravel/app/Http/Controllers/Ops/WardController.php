<?php

namespace App\Http\Controllers\Ops;

use App\Http\Controllers\Controller;
use App\Models\Hospitalization;
use Illuminate\Contracts\View\View;
use Illuminate\Http\Request;

/** 入院（本日の入院患者一覧）。契約は spec/openapi.yaml `/ward`。 */
class WardController extends Controller
{
    public function index(Request $request): View
    {
        $date = $request->query('date') ?: now()->toDateString();

        $hospitalizations = Hospitalization::with('patient')
            ->where('admitted_on', '<=', $date)
            ->where(function ($q) use ($date) {
                $q->whereNull('discharged_on')->orWhere('discharged_on', '>=', $date);
            })
            ->get();

        return view('ops.ward', ['hospitalizations' => $hospitalizations, 'date' => $date]);
    }
}
