<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Hospitalization;
use App\Models\Patient;
use App\Support\ApiError;
use App\Support\BusinessClock;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * 入院のAPI。契約は spec/openapi.yaml `/api/patients/{karte_no}/hospitalizations`
 * `/api/hospitalizations/{id}` `/api/hospitalizations/{id}/care-records`。
 * 画面側（Ops\AnimalWardController）と同じモデルを使う。
 */
class HospitalizationController extends Controller
{
    public function index(string $karteNo): JsonResponse
    {
        $patient = Patient::where('karte_no', $karteNo)->first();
        if ($patient === null) {
            return ApiError::response(ApiError::NOT_FOUND);
        }

        $items = Hospitalization::where('patient_id', $patient->id)->with('careRecords')->orderByDesc('admitted_on')->get();

        return response()->json(['items' => $items->map(fn ($h) => self::plain($h))->values(), 'total' => $items->count()]);
    }

    public function store(Request $request, string $karteNo): JsonResponse
    {
        $patient = Patient::where('karte_no', $karteNo)->first();
        if ($patient === null) {
            return ApiError::response(ApiError::NOT_FOUND);
        }

        $room = trim((string) $request->input('room', ''));
        if ($room === '') {
            return ApiError::response(ApiError::INVALID_INPUT, [
                ['field' => 'room', 'message' => '処置室は必須です。'],
            ]);
        }

        $hosp = Hospitalization::create([
            'patient_id' => $patient->id,
            'admitted_on' => $request->input('admitted_on') ?: BusinessClock::todayString(),
            'discharged_on' => $request->input('discharged_on') ?: null,
            'room' => $room,
        ]);

        return response()->json(self::plain($hosp->fresh('careRecords')), 201);
    }

    public function show(Hospitalization $hospitalization): JsonResponse
    {
        $hospitalization->load('careRecords');

        return response()->json(self::plain($hospitalization));
    }

    public function update(Request $request, Hospitalization $hospitalization): JsonResponse
    {
        $room = $request->input('room', $hospitalization->room);
        if (trim((string) $room) === '') {
            return ApiError::response(ApiError::INVALID_INPUT, [
                ['field' => 'room', 'message' => '処置室は必須です。'],
            ]);
        }

        $hospitalization->fill($request->only(['admitted_on', 'discharged_on', 'room']))->save();

        return response()->json(self::plain($hospitalization->fresh('careRecords')));
    }

    public function careRecords(Hospitalization $hospitalization): JsonResponse
    {
        $items = $hospitalization->careRecords->map(fn ($r) => CareRecordController::plain($r))->values();

        return response()->json(['items' => $items, 'total' => $items->count()]);
    }

    public static function plain(Hospitalization $h): array
    {
        return [
            'id' => $h->id,
            'patient_id' => $h->patient_id,
            'admitted_on' => $h->admitted_on->toDateString(),
            'discharged_on' => optional($h->discharged_on)->toDateString(),
            'room' => $h->room,
            'care_records' => $h->relationLoaded('careRecords')
                ? $h->careRecords->map(fn ($r) => CareRecordController::plain($r))->values()
                : [],
        ];
    }
}
