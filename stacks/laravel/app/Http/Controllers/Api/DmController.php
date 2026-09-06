<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Prevention;
use App\Support\FixedData;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * DM対象一覧のAPI。契約は spec/openapi.yaml `/api/dm`。`/dm` `/dm.csv` と
 * 同じ絞り込み（Billing\DmController::query）を使う（食い違いを避ける）。
 */
class DmController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $field = in_array($request->query('field'), ['next_due_date', 'performed_date'], true)
            ? $request->query('field') : 'next_due_date';

        $query = Prevention::with(['patient.owner'])
            ->whereNotNull('next_due_date')
            ->whereHas('patient', fn ($q) => $q->whereNull('deleted_at'))
            ->whereHas('patient.owner', fn ($q) => $q->whereNull('deleted_at'));

        if ($request->filled('type')) {
            $kinds = FixedData::master('prevention_kinds');
            $kindIndex = (int) $request->query('type');
            if (isset($kinds[$kindIndex])) {
                $query->where('kind', $kinds[$kindIndex]['code']);
            }
        }
        if ($request->filled('from')) {
            $query->whereDate($field, '>=', $request->query('from'));
        }
        if ($request->filled('to')) {
            $query->whereDate($field, '<=', $request->query('to'));
        }

        $rows = $query->orderBy($field)->get();

        return response()->json(['items' => $rows->map(fn ($r) => [
            'karte_no' => $r->patient->karte_no,
            'owner_name_kanji' => $r->patient->owner->name_kanji,
            'patient_name_kanji' => $r->patient->name_kanji,
            'kind' => $r->kind,
            'next_due_date' => optional($r->next_due_date)->toDateString(),
            'performed_date' => optional($r->performed_date)->toDateString(),
        ])->values(), 'total' => $rows->count()]);
    }
}
