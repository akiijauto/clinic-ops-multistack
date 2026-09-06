<?php

namespace App\Http\Controllers\Ops;

use App\Http\Controllers\Controller;
use App\Models\Hospitalization;
use App\Support\BusinessClock;
use Illuminate\Contracts\View\View;
use Illuminate\Http\Request;

/** 入院（本日／指定日の入院患者一覧）。契約は spec/openapi.yaml `/ward` `/ward/day`。 */
class WardController extends Controller
{
    public function index(Request $request): View
    {
        return $this->render($request->query('date') ?: BusinessClock::todayString());
    }

    public function day(Request $request): View
    {
        return $this->render($request->query('date', BusinessClock::todayString()));
    }

    private function render(string $date): View
    {
        $hospitalizations = Hospitalization::with('patient')
            ->where('admitted_on', '<=', $date)
            ->where(function ($q) use ($date) {
                $q->whereNull('discharged_on')->orWhere('discharged_on', '>=', $date);
            })
            ->get();

        return view('ops.ward', ['hospitalizations' => $hospitalizations, 'date' => $date]);
    }
}
