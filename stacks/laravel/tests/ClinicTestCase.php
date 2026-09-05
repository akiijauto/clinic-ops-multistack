<?php

namespace Tests;

use Illuminate\Foundation\Testing\RefreshDatabase;

/**
 * data/seed.json を読み込んだ状態でテストしたい Feature テストの基底クラス。
 *
 * `RefreshDatabase` は phpunit.xml の DB_DATABASE=:memory: と組み合わさると、
 * マイグレーションをテスト実行プロセス内で1回だけ行い、以後は各テストを
 * トランザクションで囲んでロールバックする（Laravelの標準の最適化）。
 * `$seed = true` で、そのマイグレーション直後に一度だけ database/seeders/DatabaseSeeder
 * （= data/seed.json）を流す。
 *
 * 各領域の Feature テストは、素の Tests\TestCase ではなく、これを継承すること。
 * 契約に無い自分だけの追加データを使いたい場合は、各テストメソッドの中で
 * 個別に作成する（seed.json 自体は書き換えない）。
 */
abstract class ClinicTestCase extends TestCase
{
    use RefreshDatabase;

    protected bool $seed = true;

    protected string $seeder = \Database\Seeders\DatabaseSeeder::class;
}
