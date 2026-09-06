<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Patient;
use App\Models\Reservation;
use App\Services\ReservationOverlap;
use App\Support\ApiError;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * 予約API。契約は spec/openapi.yaml `/api/reservations` `/api/reservations/{id}`
 * `/api/reservations/{id}/cancel`。重なり判定は App\Services\ReservationOverlap（検算6）。
 * 画面側（Ops\ReservationsController）と同じ規則を使う。
 */
class ReservationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Reservation::query();
        if ($from = $request->query('from')) {
            $query->whereDate('starts_at', '>=', $from);
        }
        if ($to = $request->query('to')) {
            $query->whereDate('starts_at', '<=', $to);
        }
        if ($request->filled('staff_id')) {
            $query->where('staff_id', $request->query('staff_id'));
        }
        if ($request->filled('room')) {
            $query->where('room', $request->query('room'));
        }
        if ($request->filled('status')) {
            $query->where('status', $request->query('status'));
        }

        $limit = min(max((int) $request->query('limit', 50), 1), 200);
        $offset = max((int) $request->query('offset', 0), 0);
        $total = (clone $query)->count();
        $items = $query->orderBy('starts_at')->skip($offset)->take($limit)->get();

        return response()->json(['items' => $items->map(fn ($r) => self::plain($r))->values(), 'total' => $total]);
    }

    public function store(Request $request): JsonResponse
    {
        $patient = Patient::find($request->input('patient_id'));
        if ($patient === null) {
            return ApiError::response(ApiError::NOT_FOUND);
        }

        $staffId = (int) $request->input('staff_id');
        $room = trim((string) $request->input('room', ''));
        $startsAt = $request->input('starts_at');
        $endsAt = $request->input('ends_at');

        $error = $this->validate($staffId, $room, $startsAt, $endsAt);
        if ($error !== null) {
            return $error;
        }

        $starts = Carbon::parse($startsAt);
        $ends = Carbon::parse($endsAt);
        if (ReservationOverlap::conflicts($staffId, $room, $starts, $ends)) {
            return ApiError::response(ApiError::RESERVATION_CONFLICT);
        }

        $reservation = Reservation::create([
            'patient_id' => $patient->id,
            'starts_at' => $startsAt,
            'ends_at' => $endsAt,
            'staff_id' => $staffId,
            'room' => $room,
            'purpose' => $request->input('purpose'),
            'note' => $request->input('note'),
            'status' => 'booked',
        ]);

        return response()->json(self::plain($reservation), 201);
    }

    public function show(int $id): JsonResponse
    {
        $reservation = Reservation::find($id);
        if ($reservation === null) {
            return ApiError::response(ApiError::NOT_FOUND);
        }

        return response()->json(self::plain($reservation));
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $reservation = Reservation::find($id);
        if ($reservation === null) {
            return ApiError::response(ApiError::NOT_FOUND);
        }

        $staffId = (int) $request->input('staff_id', $reservation->staff_id);
        $room = trim((string) $request->input('room', $reservation->room));
        $startsAt = $request->input('starts_at', $reservation->starts_at->format('Y-m-d\TH:i:sP'));
        $endsAt = $request->input('ends_at', $reservation->ends_at->format('Y-m-d\TH:i:sP'));

        $error = $this->validate($staffId, $room, $startsAt, $endsAt);
        if ($error !== null) {
            return $error;
        }

        $starts = Carbon::parse($startsAt);
        $ends = Carbon::parse($endsAt);
        if (ReservationOverlap::conflicts($staffId, $room, $starts, $ends, $reservation->id)) {
            return ApiError::response(ApiError::RESERVATION_CONFLICT);
        }

        $reservation->update([
            'starts_at' => $startsAt,
            'ends_at' => $endsAt,
            'staff_id' => $staffId,
            'room' => $room,
            'purpose' => $request->input('purpose', $reservation->purpose),
            'note' => $request->input('note', $reservation->note),
        ]);

        return response()->json(self::plain($reservation->fresh()));
    }

    public function cancel(int $id): JsonResponse
    {
        $reservation = Reservation::find($id);
        if ($reservation === null) {
            return ApiError::response(ApiError::NOT_FOUND);
        }

        // キャンセルは行を消さない。status を cancelled にするだけ（screens.md画面19）。
        $reservation->update(['status' => 'cancelled']);

        return response()->json(self::plain($reservation->fresh()));
    }

    private function validate(int $staffId, string $room, ?string $startsAt, ?string $endsAt): ?JsonResponse
    {
        if ($staffId <= 0 || $room === '' || ! $startsAt || ! $endsAt) {
            return ApiError::response(ApiError::INVALID_INPUT, [
                ['field' => 'staff_id/room/starts_at/ends_at', 'message' => '必須項目が不足しています。'],
            ]);
        }
        if (! Carbon::parse($endsAt)->gt(Carbon::parse($startsAt))) {
            return ApiError::response(ApiError::INVALID_INPUT, [
                ['field' => 'ends_at', 'message' => '終了時刻は開始時刻より後にしてください。'],
            ]);
        }

        return null;
    }

    public static function plain(Reservation $r): array
    {
        return [
            'id' => $r->id,
            'patient_id' => $r->patient_id,
            'starts_at' => $r->starts_at->format('Y-m-d\TH:i:sP'),
            'ends_at' => $r->ends_at->format('Y-m-d\TH:i:sP'),
            'staff_id' => $r->staff_id,
            'room' => $r->room,
            'purpose' => $r->purpose,
            'note' => $r->note,
            'status' => $r->status,
        ];
    }
}
