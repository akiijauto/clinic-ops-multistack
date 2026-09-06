<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CareRecord;
use App\Models\Hospitalization;
use App\Support\ApiError;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * 入院の実施記録（追加）のAPI。契約は spec/openapi.yaml `/api/hospitalizations/{id}/care-records`。
 * 実施者（staff_id/performed_by_staff_id）は必須。空の記録行は作らない（検算7）。
 *
 * 退院済みの入院には記録を追加できない（spec/screens.md画面18「満たすべきこと」）。
 * 画面側（Ops\AnimalWardController::addCareRecord）は`isOngoing()`で拒否していたが、
 * このAPIには同じチェックが無く、退院済みでも201で作成できてしまっていた
 * （2026-09-06レビュー指摘。他4実装は422で拒否）。
 */
class CareRecordController extends Controller
{
    public function store(Request $request, Hospitalization $hospitalization): JsonResponse
    {
        if (! $hospitalization->isOngoing()) {
            return ApiError::response(ApiError::INVALID_INPUT, [
                ['field' => 'hospitalization_id', 'message' => '退院済みの入院には記録を追加できません。'],
            ]);
        }

        $staffId = $request->input('performed_by_staff_id', $request->input('staff_id'));
        if (! $staffId) {
            return ApiError::response(ApiError::INVALID_INPUT, [
                ['field' => 'performed_by_staff_id', 'message' => '実施者は必須です。'],
            ]);
        }
        if (! in_array($request->input('category'), ['medication', 'feeding', 'measurement'], true)) {
            return ApiError::response(ApiError::INVALID_INPUT, [
                ['field' => 'category', 'message' => '種別の指定が正しくありません。'],
            ]);
        }

        $record = CareRecord::create([
            'hospitalization_id' => $hospitalization->id,
            'recorded_at' => $request->input('recorded_at') ?: now(),
            'category' => $request->input('category'),
            'content' => $request->input('content'),
            'performed_by_staff_id' => $staffId,
        ]);

        return response()->json(self::plain($record), 201);
    }

    public static function plain(CareRecord $r): array
    {
        return [
            'id' => $r->id,
            'hospitalization_id' => $r->hospitalization_id,
            'recorded_at' => $r->recorded_at->format('Y-m-d\TH:i:sP'),
            'category' => $r->category,
            'content' => $r->content,
            'performed_by_staff_id' => $r->performed_by_staff_id,
        ];
    }
}
