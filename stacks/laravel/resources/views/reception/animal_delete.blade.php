@extends('layouts.app')

@section('title', '削除確認 — '.$patient->name_kanji)

@section('content')
    <div class="card" data-testid="screen-delete-confirm">
        <h1>削除確認 — {{ $patient->name_kanji }}（{{ $patient->karte_no }}）</h1>

        @if (!empty($deleted))
            <div data-testid="success-banner" class="success-banner">
                削除しました（一覧からは隠れますが、記録は残ります。物理削除はしていません）。
            </div>
        @else
            <p>この動物（カルテNo: {{ $patient->karte_no }}）を削除します。物理的には消えず、
                一覧表示から隠れるだけです。飼主に他の動物が残っていなければ、飼主も同様に扱います。</p>
            <form method="post" action="/animals/{{ $patient->karte_no }}/delete">
                @csrf
                <button class="button" type="submit">削除する</button>
                <a class="button secondary" href="/animals/{{ $patient->karte_no }}">キャンセル</a>
            </form>
        @endif
    </div>
@endsection
