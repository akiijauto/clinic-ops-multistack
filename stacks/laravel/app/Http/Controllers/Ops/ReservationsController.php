<?php

namespace App\Http\Controllers\Ops;

use App\Http\Controllers\Controller;
use App\Models\Reservation;
use Illuminate\Contracts\View\View;

/** 予約（新）一覧。契約は spec/openapi.yaml `/reservations`。 */
class ReservationsController extends Controller
{
    public function index(): View
    {
        $reservations = Reservation::with('patient')->orderBy('starts_at')->get();

        return view('ops.reservations', ['reservations' => $reservations]);
    }
}
