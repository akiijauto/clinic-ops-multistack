<?php

namespace App\Http\Controllers\Reception;

use App\Http\Controllers\Controller;
use App\Support\ApiError;
use Illuminate\Contracts\View\View;
use Symfony\Component\HttpFoundation\Response;

/**
 * 折りたたみ表示（画面7）。この企画で意図して作らなかった機能（状態B）の一覧・単独表示。
 * 元データは config/feature_notes.php（統合点。レーンC自身が管理）。
 */
class FoldedController extends Controller
{
    /** 一覧（key=all）または個別（key=個別キー）。未知のキーは404。 */
    public function show(?string $key = null): View|Response
    {
        $all = config('feature_notes.folded');

        if ($key === null || $key === 'all') {
            return view('reception.folded', ['items' => $all, 'only' => null]);
        }

        if (! array_key_exists($key, $all)) {
            return ApiError::response(ApiError::NOT_FOUND);
        }

        return view('reception.folded', ['items' => $all, 'only' => $key]);
    }
}
