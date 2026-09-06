<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Paper;
use App\Models\Patient;
use App\Support\ApiError;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * 文書のAPI。契約は spec/openapi.yaml `/api/patients/{karte_no}/papers` `/api/papers/{paper_id}`。
 * 画面側（Clinical\PaperController）と同じ規則：物理削除しない（removed_atで隠すだけ）。
 */
class PaperController extends Controller
{
    public function index(string $karteNo): JsonResponse
    {
        $patient = Patient::where('karte_no', $karteNo)->first();
        if ($patient === null) {
            return ApiError::response(ApiError::NOT_FOUND);
        }

        $items = Paper::where('patient_id', $patient->id)->whereNull('removed_at')->orderByDesc('created_at')->get();

        return response()->json(['items' => $items->map(fn ($p) => self::plain($p))->values(), 'total' => $items->count()]);
    }

    public function store(Request $request, string $karteNo): JsonResponse
    {
        $patient = Patient::where('karte_no', $karteNo)->first();
        if ($patient === null) {
            return ApiError::response(ApiError::NOT_FOUND);
        }

        $title = trim((string) $request->input('title', ''));
        if ($title === '') {
            return ApiError::response(ApiError::INVALID_INPUT, [
                ['field' => 'title', 'message' => '題名は必須です。'],
            ]);
        }

        $paper = Paper::create(['patient_id' => $patient->id, 'title' => $title, 'note' => $request->input('note')]);

        return response()->json(self::plain($paper), 201);
    }

    public function show(int $paperId): JsonResponse
    {
        $paper = Paper::find($paperId);
        if ($paper === null) {
            return ApiError::response(ApiError::NOT_FOUND);
        }

        return response()->json(self::plain($paper));
    }

    public function destroy(int $paperId): JsonResponse
    {
        $paper = Paper::find($paperId);
        if ($paper === null) {
            return ApiError::response(ApiError::NOT_FOUND);
        }

        // 物理削除しない（screens.md画面13「満たすべきこと」）。一覧表示からだけ隠す。
        $paper->removed_at = now();
        $paper->save();

        return response()->json(self::plain($paper->fresh()));
    }

    public static function plain(Paper $p): array
    {
        return [
            'id' => $p->id,
            'patient_id' => $p->patient_id,
            'title' => $p->title,
            'note' => $p->note,
            'created_at' => optional($p->created_at)->format('Y-m-d\TH:i:sP'),
        ];
    }
}
