<?php

namespace Tests\Feature;

use Tests\TestCase;

/**
 * 死活監視。契約は /healthz（spec/openapi.yaml）。
 *
 * ここが緑でも「終わった」ではない。完了の判定は共通テスト
 * （python tests/run.py <URL>）が緑になったときだけ。
 */
class HealthTest extends TestCase
{
    public function test_healthz_returns_ok(): void
    {
        $response = $this->get('/healthz');

        $response->assertOk();
        $response->assertHeader('Content-Type', 'application/json');
        $response->assertExactJson(['status' => 'ok']);
    }

    public function test_health_alias_still_answers(): void
    {
        $this->get('/health')->assertOk()->assertExactJson(['status' => 'ok']);
    }
}
