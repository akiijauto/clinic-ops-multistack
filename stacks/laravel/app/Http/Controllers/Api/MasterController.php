<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Support\ApiError;
use App\Support\FixedData;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * 固定データ（マスタ）のAPI。契約は spec/openapi.yaml `/api/masters/{key}`。
 * 参照専用（画面側 Settings\MasterController と同じ規則。書き込みは無い）。
 */
class MasterController extends Controller
{
    private const KEYS = ['price_item', 'lab_item', 'reception_kind', 'prevention_kind', 'department', 'phrase'];

    public function show(Request $request, string $key): JsonResponse
    {
        if (! in_array($key, self::KEYS, true)) {
            return ApiError::response(ApiError::NOT_FOUND);
        }

        $rows = match ($key) {
            'price_item' => FixedData::priceItems(),
            'lab_item' => FixedData::labItems(),
            'reception_kind' => FixedData::master('reception_kinds'),
            'prevention_kind' => FixedData::master('prevention_kinds'),
            'department' => FixedData::master('departments'),
            'phrase' => collect(FixedData::master('phrases'))
                ->flatMap(fn ($list, $cat) => collect($list)->map(fn ($p) => ['category' => $cat, 'phrase' => $p]))
                ->all(),
        };

        $limit = min(max((int) $request->query('limit', 50), 1), 200);
        $offset = max((int) $request->query('offset', 0), 0);

        return response()->json([
            'items' => array_values(array_slice($rows, $offset, $limit)),
            'total' => count($rows),
        ]);
    }
}
