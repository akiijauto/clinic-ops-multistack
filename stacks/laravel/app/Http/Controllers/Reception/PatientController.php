<?php

namespace App\Http\Controllers\Reception;

use App\Http\Controllers\Controller;
use App\Models\Billing;
use App\Models\Owner;
use App\Models\Patient;
use App\Support\ApiError;
use Illuminate\Contracts\View\View;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

/**
 * 新規登録（画面2）・顧客（画面3）・削除確認（画面3の削除操作）。
 * 契約: spec/openapi.yaml `/animals/new` `/animals/{karte_no}` `/animals/{karte_no}/delete`。
 */
class PatientController extends Controller
{
    /** 次に割り当てられる karte_no。既存の最大値+1（data/seed.json は連番の数字文字列）。 */
    public static function nextKarteNo(): string
    {
        $max = (int) Patient::query()->max(DB::raw('CAST(karte_no AS INTEGER)'));

        return (string) ($max + 1);
    }

    public function newForm(Request $request): View
    {
        $ownerNo = $request->query('owner');
        $owner = $ownerNo ? Owner::where('owner_no', $ownerNo)->first() : null;

        return view('reception.animal_new', [
            'owner' => $owner,
            'nextKarteNo' => self::nextKarteNo(),
            'errors' => [],
            'old' => [],
        ]);
    }

    public function create(Request $request): View|RedirectResponse
    {
        $ownerNo = $request->query('owner');
        $existingOwner = $ownerNo ? Owner::where('owner_no', $ownerNo)->first() : null;

        $errors = [];

        // 動物欄が空のまま送信したら保存は成立しない（spec/screens.md画面2「満たすべきこと」）。
        $petNameKanji = trim((string) $request->input('patient_name_kanji', ''));
        if ($petNameKanji === '') {
            $errors[] = '動物の名前（漢字）は必須です。';
        }
        if (! in_array($request->input('patient_sex'), ['male', 'female', 'unknown'], true)) {
            $errors[] = '性別の指定が正しくありません。';
        }

        if ($existingOwner === null) {
            $ownerNameKanji = trim((string) $request->input('owner_name_kanji', ''));
            if ($ownerNameKanji === '') {
                $errors[] = '飼主の名前（漢字）は必須です。';
            }
        }

        if ($errors !== []) {
            return view('reception.animal_new', [
                'owner' => $existingOwner,
                'nextKarteNo' => self::nextKarteNo(),
                'errors' => $errors,
                'old' => $request->all(),
            ]);
        }

        $patient = DB::transaction(function () use ($request, $existingOwner) {
            $owner = $existingOwner;
            if ($owner === null) {
                $maxOwnerNo = (int) Owner::query()->max(DB::raw("CAST(SUBSTR(owner_no, 3) AS INTEGER)"));
                $owner = Owner::create([
                    'owner_no' => sprintf('O-%05d', $maxOwnerNo + 1),
                    'name_kana' => (string) $request->input('owner_name_kana', ''),
                    'name_kanji' => (string) $request->input('owner_name_kanji'),
                    'postal_code' => $request->input('owner_postal_code'),
                    'address1' => $request->input('owner_address1'),
                    'address2' => $request->input('owner_address2'),
                    'phone' => $request->input('owner_phone'),
                    'mobile' => $request->input('owner_mobile'),
                ]);
            }

            return Patient::create([
                'karte_no' => self::nextKarteNo(),
                'owner_id' => $owner->id,
                'name_kana' => (string) $request->input('patient_name_kana', ''),
                'name_kanji' => (string) $request->input('patient_name_kanji'),
                'species' => (string) $request->input('patient_species', 'dog'),
                'breed' => $request->input('patient_breed'),
                'sex' => (string) $request->input('patient_sex'),
                'birth_date' => $request->input('patient_birth_date') ?: null,
                'neuter_date' => $request->input('patient_neuter_date') ?: null,
            ]);
        });

        return redirect("/animals/{$patient->karte_no}");
    }

    public function show(string $karteNo): View|Response
    {
        $patient = Patient::query()->where('karte_no', $karteNo)->first();
        if ($patient === null) {
            return ApiError::response(ApiError::NOT_FOUND);
        }
        $patient->load('owner');

        // 未収金の有無（Billing.paid_amountが無い/税込合計に満たないconfirmed伝票があるか）の要約。
        $hasUnpaid = Billing::where('patient_id', $patient->id)
            ->where('status', 'confirmed')
            ->whereNull('paid_amount')
            ->exists();

        return view('reception.animal_detail', [
            'patient' => $patient,
            'owner' => $patient->owner,
            'hasUnpaid' => $hasUnpaid,
        ]);
    }

    public function update(Request $request, string $karteNo): View|Response
    {
        $patient = Patient::query()->where('karte_no', $karteNo)->first();
        if ($patient === null) {
            return ApiError::response(ApiError::NOT_FOUND);
        }

        $patient->fill($request->only([
            'name_kana', 'name_kanji', 'species', 'breed', 'sex', 'birth_date', 'neuter_date',
        ]))->save();

        if ($request->filled('owner_name_kanji')) {
            $patient->owner->fill($request->only([
                'name_kana', 'owner_name_kanji', 'postal_code', 'address1', 'address2', 'phone', 'mobile',
            ]));
            $patient->owner->name_kanji = $request->input('owner_name_kanji', $patient->owner->name_kanji);
            $patient->owner->save();
        }

        return view('reception.animal_detail', [
            'patient' => $patient->fresh('owner'),
            'owner' => $patient->owner,
            'hasUnpaid' => false,
            'saved' => true,
        ]);
    }

    public function deleteConfirm(string $karteNo): View|Response
    {
        $patient = Patient::query()->where('karte_no', $karteNo)->first();
        if ($patient === null) {
            return ApiError::response(ApiError::NOT_FOUND);
        }

        return view('reception.animal_delete', ['patient' => $patient->load('owner')]);
    }

    public function delete(string $karteNo): View|Response
    {
        $patient = Patient::query()->where('karte_no', $karteNo)->first();
        if ($patient === null) {
            return ApiError::response(ApiError::NOT_FOUND);
        }

        $patient->softDelete();

        // この動物がその飼主の最後の1頭なら Owner.deleted_at にも日時を入れる。
        $owner = $patient->owner;
        $remaining = Patient::query()->where('owner_id', $owner->id)->visible()->count();
        if ($remaining === 0 && ! $owner->isDeleted()) {
            $owner->softDelete();
        }

        return view('reception.animal_delete', [
            'patient' => $patient->fresh('owner'),
            'deleted' => true,
        ]);
    }
}
