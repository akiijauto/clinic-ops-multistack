@extends('layouts.app')

@section('title', '新規登録')

@section('content')
    <div class="card" data-testid="screen-new-animal">
        <h1>新規登録</h1>
        <p>次のカルテNo: <strong>{{ $nextKarteNo }}</strong></p>

        @if (count($errors) > 0)
            <div data-testid="error-banner" class="error-banner">
                <ul>
                    @foreach ($errors as $e)
                        <li>{{ $e }}</li>
                    @endforeach
                </ul>
            </div>
        @endif

        <form method="post" action="/animals/new{{ $owner ? '?owner='.$owner->owner_no : '' }}">
            @csrf
            @if (! $owner)
                <fieldset>
                    <legend>飼主</legend>
                    <p><label>氏名（漢字） <input name="owner_name_kanji" value="{{ $old['owner_name_kanji'] ?? '' }}"></label></p>
                    <p><label>氏名（カナ） <input name="owner_name_kana" value="{{ $old['owner_name_kana'] ?? '' }}"></label></p>
                    <p><label>郵便番号 <input name="owner_postal_code" value="{{ $old['owner_postal_code'] ?? '' }}"></label></p>
                    <p><label>住所1 <input name="owner_address1" value="{{ $old['owner_address1'] ?? '' }}"></label></p>
                    <p><label>住所2 <input name="owner_address2" value="{{ $old['owner_address2'] ?? '' }}"></label></p>
                    <p><label>電話 <input name="owner_phone" value="{{ $old['owner_phone'] ?? '' }}"></label></p>
                    <p><label>携帯 <input name="owner_mobile" value="{{ $old['owner_mobile'] ?? '' }}"></label></p>
                </fieldset>
            @else
                <p>既存の飼主: {{ $owner->name_kanji }}（{{ $owner->owner_no }}）に動物を追加します。</p>
            @endif

            <fieldset>
                <legend>動物</legend>
                <p><label>氏名（漢字） <input name="patient_name_kanji" value="{{ $old['patient_name_kanji'] ?? '' }}"></label></p>
                <p><label>氏名（カナ） <input name="patient_name_kana" value="{{ $old['patient_name_kana'] ?? '' }}"></label></p>
                <p><label>種別
                    <select name="patient_species">
                        <option value="dog">犬</option>
                        <option value="cat">猫</option>
                        <option value="other">その他</option>
                    </select>
                </label></p>
                <p><label>品種 <input name="patient_breed" value="{{ $old['patient_breed'] ?? '' }}"></label></p>
                <p><label>性別
                    <select name="patient_sex">
                        <option value="male">オス</option>
                        <option value="female">メス</option>
                        <option value="unknown">不明</option>
                    </select>
                </label></p>
                <p><label>生年月日 <input type="date" name="patient_birth_date" value="{{ $old['patient_birth_date'] ?? '' }}"></label></p>
            </fieldset>

            <button class="button" type="submit">登録する</button>
        </form>
    </div>
@endsection
