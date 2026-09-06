<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Owner;
use App\Support\ApiError;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * 飼主のAPI。契約は spec/openapi.yaml `/api/owners/{owner_no}` `/api/owners/{owner_no}/delete`。
 */
class OwnerController extends Controller
{
    public function show(string $ownerNo): JsonResponse
    {
        $owner = Owner::where('owner_no', $ownerNo)->first();
        if ($owner === null) {
            return ApiError::response(ApiError::NOT_FOUND);
        }

        return response()->json(self::plain($owner));
    }

    public function update(Request $request, string $ownerNo): JsonResponse
    {
        $owner = Owner::where('owner_no', $ownerNo)->first();
        if ($owner === null) {
            return ApiError::response(ApiError::NOT_FOUND);
        }

        $nameKanji = $request->input('name_kanji', $owner->name_kanji);
        if (trim((string) $nameKanji) === '') {
            return ApiError::response(ApiError::INVALID_INPUT, [
                ['field' => 'name_kanji', 'message' => '必須です。'],
            ]);
        }

        $owner->fill($request->only([
            'name_kana', 'name_kanji', 'postal_code', 'address1', 'address2', 'phone', 'mobile',
        ]))->save();

        return response()->json(self::plain($owner->fresh()));
    }

    public function delete(string $ownerNo): JsonResponse
    {
        $owner = Owner::where('owner_no', $ownerNo)->first();
        if ($owner === null) {
            return ApiError::response(ApiError::NOT_FOUND);
        }

        $owner->softDelete();

        return response()->json(self::plain($owner->fresh()));
    }

    public static function plain(Owner $o): array
    {
        return [
            'id' => $o->id,
            'owner_no' => $o->owner_no,
            'name_kana' => $o->name_kana,
            'name_kanji' => $o->name_kanji,
            'postal_code' => $o->postal_code,
            'address1' => $o->address1,
            'address2' => $o->address2,
            'phone' => $o->phone,
            'mobile' => $o->mobile,
            'deleted_at' => optional($o->deleted_at)->toJSON(),
        ];
    }
}
