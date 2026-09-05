<?php

namespace App\Support;

use App\Models\Staff;

/**
 * 「いまこの端末を使っている担当者」（spec/screens.md 画面21）。
 *
 * 認証ではない（coordination/DECISIONS.md：この企画では認証を扱わない）。
 * セッションに staff_id を持つだけ。担当を選ばなくても閲覧・保存は妨げられない
 * （screens.md 画面21「満たすべきこと」）——呼び出し側は id() が null でも
 * 正常に動く前提で書くこと。
 */
final class CurrentStaff
{
    private const SESSION_KEY = 'current_staff_id';

    public static function id(): ?int
    {
        return session(self::SESSION_KEY);
    }

    public static function get(): ?Staff
    {
        $id = self::id();

        return $id !== null ? Staff::find($id) : null;
    }

    public static function set(?int $staffId): void
    {
        if ($staffId === null) {
            session()->forget(self::SESSION_KEY);

            return;
        }
        session([self::SESSION_KEY => $staffId]);
    }
}
