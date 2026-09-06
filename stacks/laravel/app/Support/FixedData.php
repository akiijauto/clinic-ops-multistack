<?php

namespace App\Support;

use Illuminate\Support\Facades\Cache;

/**
 * data/ 配下の固定データ（画面から編集しない。spec/model.md「変わらないもの」）を読む。
 *
 * リポジトリ直下の data/ を読む（stacks/laravel/data/ ではない。全レーン共通の場所）。
 * data/ は指揮役だけが触る凍結ディレクトリなので、ここは読み込み専用。
 */
class FixedData
{
    /** リポジトリ直下の data/ ディレクトリの絶対パス。 */
    public static function dir(): string
    {
        // stacks/laravel から見て ../../data
        return realpath(base_path('../../data')) ?: base_path('../../data');
    }

    /**
     * `data/` は基本的に凍結ディレクトリだが、指揮役が内容を訂正することがある
     * （2026-09-06実測: `data/seed.json`のOwner氏名が古い値のままキャッシュされ、
     * DBを`migrate:fresh --seed`しても直らなかった——`rememberForever`で永久キャッシュに
     * していたのが原因）。ファイルの更新日時をキャッシュキーに含めることで、
     * ファイルが変わったら自動的に新しいキーに切り替わり、`cache:clear`を手で
     * 叩かなくても追従する。
     */
    private static function readJson(string $filename): array
    {
        $path = self::dir().DIRECTORY_SEPARATOR.$filename;
        if (! is_file($path)) {
            throw new \RuntimeException("固定データが見つかりません: $path");
        }
        $mtime = filemtime($path) ?: 0;

        return Cache::rememberForever("fixed_data.$filename.$mtime", function () use ($path) {
            $json = file_get_contents($path);

            return json_decode($json, true, flags: JSON_THROW_ON_ERROR);
        });
    }

    /** @return array<int, array{item_code:string,name:string,unit:string,category:string,reference_ranges:array}> */
    public static function labItems(): array
    {
        return self::readJson('lab_items.json');
    }

    public static function labItem(string $itemCode): ?array
    {
        foreach (self::labItems() as $item) {
            if ($item['item_code'] === $itemCode) {
                return $item;
            }
        }

        return null;
    }

    /** @return array<int, array{price_code:string,name:string,unit_price:?int,is_taxable:bool,category_major:string,category:string}> */
    public static function priceItems(): array
    {
        return self::readJson('price_items.json');
    }

    public static function priceItem(string $priceCode): ?array
    {
        foreach (self::priceItems() as $item) {
            if ($item['price_code'] === $priceCode) {
                return $item;
            }
        }

        return null;
    }

    /** @return array{prevention_kinds:array,reception_kinds:array,departments:array,phrases:array,price_categories:array} */
    public static function masters(): array
    {
        return self::readJson('masters.json');
    }

    public static function master(string $key): array
    {
        $all = self::masters();
        if (! array_key_exists($key, $all)) {
            throw new \RuntimeException("未知のマスタキー: $key");
        }

        return $all[$key];
    }

    /**
     * `{kind_id}` パス変数（投薬・予防の種別）の解決。spec/openapi.yaml の
     * DosingKindId / PreventionKindId は「マスタの行id」と説明しているが、実データ
     * （`data/seed.json` の dosings / preventions の `kind` 列）は数値添字ではなく
     * code文字列（例: "heartworm"）をそのまま持っている（裁定R-20、2026-09-06実測）。
     * 数値添字（`prevention_kinds`配列の0始まりの位置）とcode文字列の両方を受け付ける。
     * 見つからなければ null（呼び出し側で404にする）。
     */
    public static function preventionKind(string $kindId): ?array
    {
        $kinds = self::master('prevention_kinds');
        if (ctype_digit($kindId) && isset($kinds[(int) $kindId])) {
            return $kinds[(int) $kindId];
        }
        foreach ($kinds as $kind) {
            if ($kind['code'] === $kindId) {
                return $kind;
            }
        }

        return null;
    }

    /** @return array<string,mixed> data/seed.json 全体（初期データ投入時にのみ使う）。 */
    public static function seed(): array
    {
        return self::readJson('seed.json');
    }
}
