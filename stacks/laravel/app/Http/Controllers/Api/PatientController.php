<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Patient;
use App\Support\ApiError;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * 動物のAPI。契約は spec/openapi.yaml `/api/patients` `/api/patients/{karte_no}`
 * `/api/patients/{karte_no}/delete` `/api/patients/{karte_no}/restore`。
 *
 * 画面側（Reception\PatientController）と同じモデルを使う（計算・業務ルールの二重実装はしない）。
 */
class PatientController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $q = trim((string) $request->query('q', ''));
        $includeDeleted = $request->boolean('include_deleted', false);
        $limit = min(max((int) $request->query('limit', 50), 1), 200);
        $offset = max((int) $request->query('offset', 0), 0);

        $query = Patient::with('owner');
        if (! $includeDeleted) {
            $query->visible();
        }
        if ($q !== '') {
            $query->where(function ($w) use ($q) {
                $w->where('karte_no', 'like', "%{$q}%")
                    ->orWhere('name_kanji', 'like', "%{$q}%")
                    ->orWhere('name_kana', 'like', "%{$q}%");
            });
        }

        $total = (clone $query)->count();
        $items = $query->orderBy('id')->skip($offset)->take($limit)->get();

        return response()->json([
            'items' => $items->map(fn ($p) => self::withOwner($p))->values(),
            'total' => $total,
        ]);
    }

    public function show(string $karteNo): JsonResponse
    {
        $patient = Patient::query()->where('karte_no', $karteNo)->first();
        if ($patient === null) {
            return ApiError::response(ApiError::NOT_FOUND);
        }
        $patient->load('owner');

        return response()->json(self::withOwner($patient));
    }

    public function update(Request $request, string $karteNo): JsonResponse
    {
        $patient = Patient::query()->where('karte_no', $karteNo)->first();
        if ($patient === null) {
            return ApiError::response(ApiError::NOT_FOUND);
        }

        $nameKanji = $request->input('name_kanji', $patient->name_kanji);
        $sex = $request->input('sex', $patient->sex);
        if (trim((string) $nameKanji) === '') {
            return ApiError::response(ApiError::INVALID_INPUT, [
                ['field' => 'name_kanji', 'message' => '必須です。'],
            ]);
        }
        if (! in_array($sex, ['male', 'female', 'unknown'], true)) {
            return ApiError::response(ApiError::INVALID_INPUT, [
                ['field' => 'sex', 'message' => '性別の指定が正しくありません。'],
            ]);
        }

        $patient->fill($request->only([
            'name_kana', 'name_kanji', 'species', 'breed', 'sex', 'birth_date', 'neuter_date',
        ]))->save();

        return response()->json(self::plain($patient->fresh()));
    }

    public function delete(string $karteNo): JsonResponse
    {
        $patient = Patient::query()->where('karte_no', $karteNo)->first();
        if ($patient === null) {
            return ApiError::response(ApiError::NOT_FOUND);
        }

        $patient->softDelete();

        // この動物がその飼主の最後の1頭なら Owner.deleted_at にも日時を入れる
        // （画面側 Reception\PatientController::delete と同じ規則）。
        $owner = $patient->owner;
        $remaining = Patient::query()->where('owner_id', $owner->id)->visible()->count();
        if ($remaining === 0 && ! $owner->isDeleted()) {
            $owner->softDelete();
        }

        return response()->json(self::plain($patient->fresh()));
    }

    public function restore(string $karteNo): JsonResponse
    {
        $patient = Patient::query()->where('karte_no', $karteNo)->first();
        if ($patient === null) {
            return ApiError::response(ApiError::NOT_FOUND);
        }

        $patient->restore();

        return response()->json(self::plain($patient->fresh()));
    }

    public static function plain(Patient $p): array
    {
        return [
            'id' => $p->id,
            'karte_no' => $p->karte_no,
            'owner_id' => $p->owner_id,
            'name_kana' => $p->name_kana,
            'name_kanji' => $p->name_kanji,
            'species' => $p->species,
            'breed' => $p->breed,
            'sex' => $p->sex,
            'birth_date' => optional($p->birth_date)->toDateString(),
            'neuter_date' => optional($p->neuter_date)->toDateString(),
            'deleted_at' => optional($p->deleted_at)->toJSON(),
        ];
    }

    public static function withOwner(Patient $p): array
    {
        $owner = $p->relationLoaded('owner') ? $p->owner : $p->owner()->first();

        return self::plain($p) + ['owner' => $owner ? OwnerController::plain($owner) : null];
    }
}
