<?php

namespace App\Support;

use Illuminate\Http\JsonResponse;

/**
 * spec/openapi.yaml「エラーの文言（一字一句、これを使う）」をそのまま定数化したもの。
 *
 * 文言・コード・ステータスは3つとも openapi.yaml が定める組み合わせでしか使わない
 * （独自の文言を作らない — coordination/DECISIONS.md 第4節）。
 */
final class ApiError
{
    public const INVALID_JSON = 'invalid_json';
    public const INVALID_INPUT = 'invalid_input';
    public const NOT_FOUND = 'not_found';
    public const FORBIDDEN = 'forbidden';
    public const SAVE_FAILED = 'save_failed';
    public const RESERVATION_CONFLICT = 'reservation_conflict';

    private const CATALOG = [
        self::INVALID_JSON => [
            'status' => 400,
            'message' => 'リクエストの本文がJSONとして壊れています。書き方を確認してください。',
        ],
        self::INVALID_INPUT => [
            'status' => 422,
            'message' => '入力の形式が正しくありません。必須の項目や値の型を確認してください。',
        ],
        self::NOT_FOUND => [
            'status' => 404,
            'message' => '指定されたデータが見つかりません。',
        ],
        self::FORBIDDEN => [
            'status' => 403,
            'message' => 'この操作を行う権限がありません。',
        ],
        self::SAVE_FAILED => [
            'status' => 500,
            'message' => '保存に失敗しました。時間をおいてもう一度お試しください。',
        ],
        self::RESERVATION_CONFLICT => [
            'status' => 409,
            'message' => '指定した時間帯は、担当または処置室の予定と重なっています。',
        ],
    ];

    /**
     * @param  array<int,array{field:string,message:string}>|null  $details  invalid_input のときは1件以上必須
     */
    public static function response(string $code, ?array $details = null): JsonResponse
    {
        if (! isset(self::CATALOG[$code])) {
            throw new \InvalidArgumentException("未知のエラーコード: $code");
        }

        $entry = self::CATALOG[$code];
        $error = ['code' => $code, 'message' => $entry['message']];
        if ($details !== null) {
            $error['details'] = $details;
        }

        return response()->json(['error' => $error], $entry['status']);
    }

    public static function status(string $code): int
    {
        return self::CATALOG[$code]['status'];
    }

    public static function message(string $code): string
    {
        return self::CATALOG[$code]['message'];
    }
}
