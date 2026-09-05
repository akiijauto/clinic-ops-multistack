<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Reservation;
use Illuminate\Http\JsonResponse;

/**
 * 予約API。契約は spec/openapi.yaml `/api/reservations`。
 * 重なり判定（spec/acceptance.md 検算6）は一覧を突き合わせて確認するので、
 * ここは全件をそのまま返すだけでよい。
 */
class ReservationController extends Controller
{
    public function index(): JsonResponse
    {
        $items = Reservation::orderBy('starts_at')->get()->map(fn ($r) => [
            'id' => $r->id,
            'patient_id' => $r->patient_id,
            'starts_at' => $r->starts_at->format('Y-m-d\TH:i:sP'),
            'ends_at' => $r->ends_at->format('Y-m-d\TH:i:sP'),
            'staff_id' => $r->staff_id,
            'room' => $r->room,
            'purpose' => $r->purpose,
            'note' => $r->note,
            'status' => $r->status,
        ])->values();

        return response()->json(['items' => $items, 'total' => $items->count()]);
    }
}
