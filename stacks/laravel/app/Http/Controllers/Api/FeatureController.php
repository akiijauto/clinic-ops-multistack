<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Support\ApiError;
use Illuminate\Http\JsonResponse;

/**
 * 作らないと決めた機能・畳んだ機能のAPI。契約は spec/openapi.yaml `/api/features` `/api/todo/{key}`。
 * 元データは config/feature_notes.php（画面側の Settings\FeaturesController / Reception\FoldedController
 * / Ops\TodoController と同じ。掲載内容が食い違わないようにする）。
 */
class FeatureController extends Controller
{
    public function index(): JsonResponse
    {
        $items = [];
        foreach (config('feature_notes.folded') as $key => $note) {
            $items[] = ['key' => $key, 'kind' => 'folded', 'title' => $note['title'], 'message' => $note['message']];
        }
        foreach (config('feature_notes.todo') as $key => $note) {
            $items[] = ['key' => $key, 'kind' => 'todo', 'title' => $note['title'], 'message' => $note['message']];
        }

        return response()->json(['items' => $items]);
    }

    public function todo(string $key): JsonResponse
    {
        $all = config('feature_notes.todo');
        if (! array_key_exists($key, $all)) {
            return ApiError::response(ApiError::NOT_FOUND);
        }

        return response()->json(['key' => $key, 'kind' => 'todo', 'title' => $all[$key]['title'], 'message' => $all[$key]['message']]);
    }
}
