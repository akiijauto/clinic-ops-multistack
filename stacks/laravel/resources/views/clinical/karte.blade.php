@extends('layouts.app')

@section('title', 'カルテ')

@section('content')
    <div class="card" data-testid="screen-karte">
        <h1>カルテ</h1>
        <p>{{ $patient->name_kanji }}（{{ $patient->karte_no }}）</p>

        @if (!empty($error))
            <div data-testid="error-banner" class="error-banner">{{ $error }}</div>
        @endif
        @if (!empty($success))
            <div data-testid="success-banner" class="success-banner">{{ $success }}</div>
        @endif

        <p>
            <a class="button" href="/animals/{{ $patient->karte_no }}/karte/new">新規診察</a>
            <a class="button secondary" href="/animals/{{ $patient->karte_no }}/karte/copy_prev">前回コピー</a>
            <a class="button secondary" href="/animals/{{ $patient->karte_no }}">顧客</a>
            <a class="button secondary" href="/animals/{{ $patient->karte_no }}/history">来院履歴</a>
            <a class="button secondary" href="/animals/{{ $patient->karte_no }}/karte/print">印刷</a>
            <a class="button secondary" href="/animals/{{ $patient->karte_no }}/exam">検査</a>
            <a class="button secondary" href="/animals/{{ $patient->karte_no }}/dosing/0">投薬</a>
            <a class="button secondary" href="/animals/{{ $patient->karte_no }}/prevention/0">予防</a>
            <a class="button secondary" href="/animals/{{ $patient->karte_no }}/papers">書類</a>
            <a class="button secondary" href="/animals/{{ $patient->karte_no }}/karte{{ $showDeleted ? '' : '?show_deleted=1' }}">
                {{ $showDeleted ? '削除済みを隠す' : '削除済みも表示' }}
            </a>
            {{-- 状態C（あえて動かさないと決めた）。押せる見た目のまま無効にする。消さない。 --}}
            <a class="button disabled" href="/todo/karte_temp_save">一時保存</a>
        </p>

        @include('clinical._visits', ['visits' => $visits, 'patient' => $patient, 'interactive' => true])
    </div>
@endsection
