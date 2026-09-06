<?php

namespace App\Http\Controllers\Ops;

use App\Http\Controllers\Controller;
use App\Models\Patient;
use App\Models\Reservation;
use App\Models\Staff;
use App\Services\ReservationOverlap;
use App\Support\ApiError;
use App\Support\BusinessClock;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\View\View;
use Symfony\Component\HttpFoundation\Response;

/**
 * 予約（新）。契約: spec/openapi.yaml `/reservations` `/reservations/new` `/reservations/{id}`
 * `/reservations/{id}/cancel`。重なり判定は App\Services\ReservationOverlap（検算6）。
 */
class ReservationsController extends Controller
{
    public function index(Request $request): View
    {
        $from = $request->query('from') ?: BusinessClock::todayString();
        $to = $request->query('to') ?: $from;

        $query = Reservation::with(['patient', 'staff'])
            ->whereDate('starts_at', '>=', $from)
            ->whereDate('starts_at', '<=', $to);

        if ($request->filled('staff_id')) {
            $query->where('staff_id', $request->query('staff_id'));
        }
        if ($request->filled('room')) {
            $query->where('room', $request->query('room'));
        }

        $reservations = $query->orderBy('starts_at')->get();

        return view('ops.reservations', [
            'reservations' => $reservations,
            'from' => $from,
            'to' => $to,
            'staffList' => Staff::where('is_active', true)->get(),
        ]);
    }

    public function newForm(Request $request): View
    {
        $patient = $request->query('karte_no')
            ? Patient::where('karte_no', $request->query('karte_no'))->first()
            : null;

        return view('ops.reservation_new', [
            'patient' => $patient,
            'staffList' => Staff::where('is_active', true)->get(),
        ]);
    }

    public function create(Request $request): View|Response
    {
        $patient = Patient::where('karte_no', $request->input('karte_no'))->first();
        $staffId = (int) $request->input('staff_id');
        $room = trim((string) $request->input('room', ''));
        $startsAt = $request->input('starts_at');
        $endsAt = $request->input('ends_at');

        $error = $this->validateReservation($patient, $staffId, $room, $startsAt, $endsAt);
        if ($error !== null) {
            return view('ops.reservation_new', [
                'patient' => $patient,
                'staffList' => Staff::where('is_active', true)->get(),
                'error' => $error,
            ]);
        }

        Reservation::create([
            'patient_id' => $patient->id,
            'starts_at' => $startsAt,
            'ends_at' => $endsAt,
            'staff_id' => $staffId,
            'room' => $room,
            'purpose' => $request->input('purpose'),
            'note' => $request->input('note'),
            'status' => 'booked',
        ]);

        return redirect('/reservations?from='.substr($startsAt, 0, 10).'&to='.substr($startsAt, 0, 10));
    }

    public function show(int $id): View|Response
    {
        $reservation = Reservation::with(['patient', 'staff'])->find($id);
        if ($reservation === null) {
            return ApiError::response(ApiError::NOT_FOUND);
        }

        return view('ops.reservation_detail', ['reservation' => $reservation, 'staffList' => Staff::where('is_active', true)->get()]);
    }

    public function update(Request $request, int $id): View|Response
    {
        $reservation = Reservation::find($id);
        if ($reservation === null) {
            return ApiError::response(ApiError::NOT_FOUND);
        }

        $staffId = (int) $request->input('staff_id', $reservation->staff_id);
        $room = trim((string) $request->input('room', $reservation->room));
        $startsAt = $request->input('starts_at', $reservation->starts_at);
        $endsAt = $request->input('ends_at', $reservation->ends_at);

        $error = $this->validateReservation($reservation->patient, $staffId, $room, $startsAt, $endsAt, $reservation->id);
        if ($error !== null) {
            return view('ops.reservation_detail', [
                'reservation' => $reservation,
                'staffList' => Staff::where('is_active', true)->get(),
                'error' => $error,
            ]);
        }

        $reservation->update([
            'starts_at' => $startsAt,
            'ends_at' => $endsAt,
            'staff_id' => $staffId,
            'room' => $room,
            'purpose' => $request->input('purpose', $reservation->purpose),
            'note' => $request->input('note', $reservation->note),
        ]);

        return view('ops.reservation_detail', [
            'reservation' => $reservation->fresh(['patient', 'staff']),
            'staffList' => Staff::where('is_active', true)->get(),
            'success' => '更新しました。',
        ]);
    }

    public function cancel(int $id): View|Response
    {
        $reservation = Reservation::find($id);
        if ($reservation === null) {
            return ApiError::response(ApiError::NOT_FOUND);
        }

        // キャンセルは行を消さない。status を cancelled にするだけ（screens.md画面19）。
        $reservation->update(['status' => 'cancelled']);

        return view('ops.reservation_detail', [
            'reservation' => $reservation->fresh(['patient', 'staff']),
            'staffList' => Staff::where('is_active', true)->get(),
            'success' => 'キャンセルしました。',
        ]);
    }

    private function validateReservation(?Patient $patient, int $staffId, string $room, ?string $startsAt, ?string $endsAt, ?int $excludeId = null): ?string
    {
        if ($patient === null) {
            return '患者を指定してください。';
        }
        if ($staffId <= 0 || $room === '' || ! $startsAt || ! $endsAt) {
            return ApiError::message(ApiError::INVALID_INPUT);
        }

        $starts = Carbon::parse($startsAt);
        $ends = Carbon::parse($endsAt);
        if (! $ends->gt($starts)) {
            return '終了時刻は開始時刻より後にしてください。';
        }

        if (ReservationOverlap::conflicts($staffId, $room, $starts, $ends, $excludeId)) {
            return ApiError::message(ApiError::RESERVATION_CONFLICT);
        }

        return null;
    }
}
