<?php

namespace App\Http\Controllers\Ops;

use App\Http\Controllers\Controller;
use App\Support\ApiError;
use Illuminate\Contracts\View\View;
use Symfony\Component\HttpFoundation\Response;

/**
 * ToDo（画面20）。状態Cのボタン1つについて、なぜ押せないかを説明する。
 * 元データは config/feature_notes.php（統合点。レーンC自身が管理）。
 */
class TodoController extends Controller
{
    public function show(string $key): View|Response
    {
        $all = config('feature_notes.todo');

        if (! array_key_exists($key, $all)) {
            return ApiError::response(ApiError::NOT_FOUND);
        }

        return view('ops.todo', ['key' => $key, 'item' => $all[$key]]);
    }
}
