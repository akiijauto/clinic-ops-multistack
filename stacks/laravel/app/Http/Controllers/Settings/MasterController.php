<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Support\ApiError;
use App\Support\FixedData;
use Illuminate\Contracts\View\View;
use Symfony\Component\HttpFoundation\Response;

/**
 * マスタ（画面25）。参照専用。編集用の入力欄・保存ボタンは一切持たない
 * （spec/README.md「一覧と参照は作る。編集は作らない」）。
 */
class MasterController extends Controller
{
    private const KEYS = ['price_item', 'lab_item', 'reception_kind', 'prevention_kind', 'department', 'phrase'];

    public function index(): View
    {
        return $this->render('price_item');
    }

    public function show(string $key): View|Response
    {
        if (! in_array($key, self::KEYS, true)) {
            return ApiError::response(ApiError::NOT_FOUND);
        }

        return $this->render($key);
    }

    private function render(string $key): View
    {
        $rows = match ($key) {
            'price_item' => FixedData::priceItems(),
            'lab_item' => FixedData::labItems(),
            'reception_kind' => FixedData::master('reception_kinds'),
            'prevention_kind' => FixedData::master('prevention_kinds'),
            'department' => FixedData::master('departments'),
            'phrase' => collect(FixedData::master('phrases'))->flatMap(fn ($list, $cat) => collect($list)->map(fn ($p) => ['category' => $cat, 'phrase' => $p]))->all(),
        };

        return view('settings.master', ['key' => $key, 'keys' => self::KEYS, 'rows' => $rows]);
    }
}
