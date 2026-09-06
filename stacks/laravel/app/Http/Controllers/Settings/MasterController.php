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

    /** 列の見出し（人が読める名前）。無いキーはそのまま英語名で出す。 */
    private const LABELS = [
        'price_code' => '料金コード', 'name' => '名称', 'unit_price' => '単価',
        'is_taxable' => '課税', 'category_major' => '大分類', 'category' => '分類',
        'item_code' => '検査コード', 'unit' => '単位', 'reference_ranges' => '基準値',
        'code' => 'コード', 'phrase' => '文言',
    ];

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

        // 生のJSONダンプではなく、他4実装と同じく整形した表として出す
        // （2026-09-06レビュー指摘）。列は先頭行のキーからそのまま作る
        // （キーの並びはFixedData側の元データの並びと一致）。
        $columns = $rows === [] ? [] : array_keys($rows[0]);
        $labels = array_map(fn ($c) => self::LABELS[$c] ?? $c, $columns);
        $cells = collect($rows)->map(
            fn ($row) => collect($columns)->map(fn ($c) => $this->displayValue($row[$c] ?? null))->all()
        )->all();

        return view('settings.master', [
            'key' => $key, 'keys' => self::KEYS, 'labels' => $labels, 'cells' => $cells,
        ]);
    }

    /** ネストした配列（検査の基準値など）は1行で読める要約にする。 */
    private function displayValue(mixed $value): string
    {
        if (is_bool($value)) {
            return $value ? '○' : '';
        }
        if (is_array($value)) {
            return collect($value)->map(function ($row) {
                if (! is_array($row)) {
                    return (string) $row;
                }

                return implode('/', array_map(fn ($v) => is_array($v) ? '' : (string) $v, $row));
            })->implode('、');
        }

        return (string) ($value ?? '');
    }
}
