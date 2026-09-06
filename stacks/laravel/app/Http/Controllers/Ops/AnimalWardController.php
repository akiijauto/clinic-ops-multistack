<?php

namespace App\Http\Controllers\Ops;

use App\Http\Controllers\Controller;
use App\Models\CareRecord;
use App\Models\Hospitalization;
use App\Models\Patient;
use App\Support\ApiError;
use App\Support\BusinessClock;
use Illuminate\Http\Request;
use Illuminate\View\View;
use Symfony\Component\HttpFoundation\Response;

/**
 * 入院（画面18・この動物の入院記録）。契約: spec/openapi.yaml `/animals/{karte_no}/ward`。
 * 実施者が空のケア記録は保存しない（spec/model.md・検算7）。退院済みの入院には
 * 記録を追加できない。
 */
class AnimalWardController extends Controller
{
    public function show(string $karteNo): View|Response
    {
        $patient = Patient::where('karte_no', $karteNo)->first();
        if ($patient === null) {
            return ApiError::response(ApiError::NOT_FOUND);
        }

        $hospitalizations = Hospitalization::where('patient_id', $patient->id)
            ->with('careRecords.performedBy')
            ->orderByDesc('admitted_on')
            ->get();

        return view('ops.animal_ward', ['patient' => $patient, 'hospitalizations' => $hospitalizations]);
    }

    /** 入院の開始（新規登録）。 */
    public function admit(Request $request, string $karteNo): View|Response
    {
        $patient = Patient::where('karte_no', $karteNo)->first();
        if ($patient === null) {
            return ApiError::response(ApiError::NOT_FOUND);
        }

        $room = trim((string) $request->input('room', ''));
        if ($room === '') {
            return $this->render($patient, '処置室を入力してください。');
        }

        Hospitalization::create([
            'patient_id' => $patient->id,
            'admitted_on' => $request->input('admitted_on') ?: BusinessClock::todayString(),
            'room' => $room,
        ]);

        return $this->render($patient, null, '入院を開始しました。');
    }

    /** ケア記録の追加。実施者は必須（空なら拒否）。退院済みの入院には追加できない。 */
    public function addCareRecord(Request $request, string $karteNo, int $hospitalizationId): View|Response
    {
        $patient = Patient::where('karte_no', $karteNo)->first();
        if ($patient === null) {
            return ApiError::response(ApiError::NOT_FOUND);
        }
        $hosp = Hospitalization::where('patient_id', $patient->id)->where('id', $hospitalizationId)->first();
        if ($hosp === null) {
            return ApiError::response(ApiError::NOT_FOUND);
        }

        if (! $hosp->isOngoing()) {
            return $this->render($patient, '退院済みの入院には記録を追加できません。');
        }

        $staffId = $request->input('performed_by_staff_id');
        if (! $staffId) {
            return $this->render($patient, '実施者を選択してください。');
        }

        CareRecord::create([
            'hospitalization_id' => $hosp->id,
            'recorded_at' => now(),
            'category' => (string) $request->input('category', 'measurement'),
            'content' => $request->input('content'),
            'performed_by_staff_id' => $staffId,
        ]);

        return $this->render($patient, null, '記録を追加しました。');
    }

    /** 退院日を入力して入院を終了する。 */
    public function discharge(Request $request, string $karteNo, int $hospitalizationId): View|Response
    {
        $patient = Patient::where('karte_no', $karteNo)->first();
        if ($patient === null) {
            return ApiError::response(ApiError::NOT_FOUND);
        }
        $hosp = Hospitalization::where('patient_id', $patient->id)->where('id', $hospitalizationId)->first();
        if ($hosp === null) {
            return ApiError::response(ApiError::NOT_FOUND);
        }

        $hosp->update(['discharged_on' => $request->input('discharged_on') ?: BusinessClock::todayString()]);

        return $this->render($patient, null, '退院にしました。');
    }

    private function render(Patient $patient, ?string $error = null, ?string $success = null): View
    {
        $hospitalizations = Hospitalization::where('patient_id', $patient->id)
            ->with('careRecords.performedBy')
            ->orderByDesc('admitted_on')
            ->get();

        return view('ops.animal_ward', [
            'patient' => $patient,
            'hospitalizations' => $hospitalizations,
            'error' => $error,
            'success' => $success,
        ]);
    }
}
