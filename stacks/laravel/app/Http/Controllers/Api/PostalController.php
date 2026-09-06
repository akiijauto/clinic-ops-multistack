<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * 郵便番号→住所候補。契約は spec/openapi.yaml `/postal`。
 *
 * 外部の郵便番号データベースは呼ばない。この企画では架空の郵便番号を数件だけ持つ
 * 簡易対応とする（他レーンと同じ設計）。候補が無くても常に200を返し、`reason`に
 * 理由を入れる（404にしない——`code`のクエリが必須なだけで、資源自体は常に在る）。
 */
class PostalController extends Controller
{
    /** ごく少数の架空の郵便番号。data/seed.jsonのClinicの住所（999-0001）を含める。 */
    private const FIXTURES = [
        '999-0001' => ['address1' => 'みなも県すみれ市かえで町', 'address2' => '1丁目'],
        '100-0001' => ['address1' => 'みなも県すみれ市中央', 'address2' => '2丁目'],
    ];

    public function lookup(Request $request): JsonResponse
    {
        $raw = trim((string) $request->query('code', ''));
        if ($raw === '') {
            return response()->json([
                'candidates' => [],
                'reason' => '郵便番号（code）が指定されていません。',
            ]);
        }

        $normalized = preg_replace('/[^0-9]/', '', $raw);
        $candidates = [];
        foreach (self::FIXTURES as $code => $addr) {
            if (preg_replace('/[^0-9]/', '', $code) === $normalized) {
                $candidates[] = ['postal_code' => $code] + $addr;
            }
        }

        if ($candidates === []) {
            return response()->json([
                'candidates' => [],
                'reason' => '該当する住所が見つかりません（この企画では架空の郵便番号を数件だけ持つ簡易対応です）。',
            ]);
        }

        return response()->json(['candidates' => $candidates, 'reason' => null]);
    }
}
