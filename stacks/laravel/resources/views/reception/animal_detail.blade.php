@extends('layouts.app')

@section('title', '顧客 — '.$patient->name_kanji)

@section('content')
    <div class="card" data-testid="screen-animal-detail">
        <h1>顧客 — {{ $patient->name_kanji }}（{{ $patient->karte_no }}）</h1>

        @if (!empty($saved))
            <div data-testid="success-banner" class="success-banner">保存しました。</div>
        @endif

        @if ($patient->isDeleted())
            <div data-testid="error-banner" class="error-banner">この動物は削除済みです（{{ $patient->deleted_at }}）。</div>
        @endif

        <div class="card">
            <h2>飼主</h2>
            <p>飼主番号: {{ $owner->owner_no }}</p>
            <p>氏名: {{ $owner->name_kanji }}（{{ $owner->name_kana }}）</p>
            <p>住所: {{ $owner->postal_code }} {{ $owner->address1 }} {{ $owner->address2 }}</p>
            <p>電話: {{ $owner->phone }} / 携帯: {{ $owner->mobile }}</p>
            @if ($owner->isDeleted())
                <p><em>この飼主は削除済みです。</em></p>
            @endif
        </div>

        <div class="card">
            <h2>動物</h2>
            <form method="post" action="/animals/{{ $patient->karte_no }}">
                @csrf
                <p><label>氏名（漢字） <input name="name_kanji" value="{{ $patient->name_kanji }}"></label></p>
                <p><label>氏名（カナ） <input name="name_kana" value="{{ $patient->name_kana }}"></label></p>
                <p><label>種別 <input name="species" value="{{ $patient->species }}"></label></p>
                <p><label>品種 <input name="breed" value="{{ $patient->breed }}"></label></p>
                <p>性別: {{ ['male' => 'オス', 'female' => 'メス', 'unknown' => '不明'][$patient->sex] ?? $patient->sex }}</p>
                <p>生年月日: {{ optional($patient->birth_date)->toDateString() }}</p>
                <button class="button" type="submit">保存</button>
            </form>
        </div>

        <p>未収金: {{ $hasUnpaid ? 'あり' : 'なし' }}</p>

        <p>
            <a class="button secondary" href="/animals/{{ $patient->karte_no }}/karte">カルテ</a>
            <a class="button secondary" href="/animals/{{ $patient->karte_no }}/history">来院履歴</a>
            <a class="button secondary" href="/animals/{{ $patient->karte_no }}/accounting">会計</a>
            <a class="button secondary" href="/animals/new?owner={{ $owner->owner_no }}">この飼主に動物を追加</a>
            <a class="button secondary" href="/animals/{{ $patient->karte_no }}/delete">削除</a>
        </p>

        <div class="card">
            <h3>診察券（印刷用）</h3>
            <p>カルテNo: {{ $patient->karte_no }} / 動物名: {{ $patient->name_kanji }} / 飼主名: {{ $owner->name_kanji }}</p>
        </div>
    </div>
@endsection
