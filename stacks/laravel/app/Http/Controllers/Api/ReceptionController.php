<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Patient;
use App\Models\Reception;
use App\Support\ApiError;
use App\Support\BusinessClock;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * 受付のAPI。契約は spec/openapi.yaml `/api/receptions` `/api/patients/{karte_no}/receptions`
 * `/api/receptions/{id}`。画面側（Reception\TodayController）と同じ「本日」の考え方
 * （App\Support\BusinessClock）を使う。
 */
class ReceptionController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $date = $request->query('date') ?: BusinessClock::todayString();
        $query = Reception::whereDate('received_at', $date);
        if ($request->filled('kind')) {
            $query->where('medical_purpose', $request->query('kind'));
        }

        $items = $query->orderBy('display_no')->get();

        return response()->json(['items' => $items->map(fn ($r) => self::plain($r))->values(), 'total' => $items->count()]);
    }

    public function store(Request $request): JsonResponse
    {
        $patient = Patient::where('id', $request->input('patient_id'))->first();

        return $this->createFor($request, $patient);
    }

    public function storeForPatient(Request $request, string $karteNo): JsonResponse
    {
        $patient = Patient::where('karte_no', $karteNo)->first();
        if ($patient === null) {
            return ApiError::response(ApiError::NOT_FOUND);
        }

        return $this->createFor($request, $patient);
    }

    private function createFor(Request $request, ?Patient $patient): JsonResponse
    {
        if ($patient === null) {
            return ApiError::response(ApiError::NOT_FOUND);
        }

        $receivedAt = $request->input('received_at') ?: BusinessClock::today()->toDateTimeString();
        $nextNo = (int) (Reception::whereDate('received_at', substr($receivedAt, 0, 10))->max('display_no') ?? 0) + 1;

        $reception = Reception::create([
            'patient_id' => $patient->id,
            'display_no' => $request->input('display_no', $nextNo),
            'received_at' => $receivedAt,
            'owner_purpose' => $request->input('owner_purpose'),
            'medical_purpose' => $request->input('medical_purpose'),
            'status' => $request->input('status', 'waiting'),
            'staff_id' => $request->input('staff_id'),
        ]);

        return response()->json(self::plain($reception), 201);
    }

    public function show(int $id): JsonResponse
    {
        $reception = Reception::find($id);
        if ($reception === null) {
            return ApiError::response(ApiError::NOT_FOUND);
        }

        return response()->json(self::plain($reception));
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $reception = Reception::find($id);
        if ($reception === null) {
            return ApiError::response(ApiError::NOT_FOUND);
        }

        if ($request->has('status') && ! in_array($request->input('status'), ['waiting', 'in_exam', 'done'], true)) {
            return ApiError::response(ApiError::INVALID_INPUT, [
                ['field' => 'status', 'message' => '状態の指定が正しくありません。'],
            ]);
        }

        $reception->fill($request->only([
            'display_no', 'owner_purpose', 'medical_purpose', 'status', 'staff_id',
        ]))->save();

        return response()->json(self::plain($reception->fresh()));
    }

    public static function plain(Reception $r): array
    {
        return [
            'id' => $r->id,
            'patient_id' => $r->patient_id,
            'display_no' => $r->display_no,
            'received_at' => $r->received_at->format('Y-m-d\TH:i:sP'),
            'owner_purpose' => $r->owner_purpose,
            'medical_purpose' => $r->medical_purpose,
            'status' => $r->status,
            'staff_id' => $r->staff_id,
        ];
    }
}
