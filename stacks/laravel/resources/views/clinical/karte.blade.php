@extends('layouts.app')

@section('title', 'カルテ - ' . $patient->name_kanji)

@section('content')
    <div class="card" data-testid="screen-karte">
        <h1>カルテ — {{ $patient->name_kanji }}（{{ $patient->karte_no }}）</h1>

        @if (!empty($error))
            <div data-testid="error-banner">{{ $error }}</div>
        @endif
        @if (!empty($success))
            <div data-testid="success-banner">{{ $success }}</div>
        @endif

        <p>
            <a class="btn secondary" href="/animals/{{ $patient->karte_no }}">顧客</a>
            <a class="btn secondary" href="/animals/{{ $patient->karte_no }}/history">来院履歴</a>
            <a class="btn secondary" href="/animals/{{ $patient->karte_no }}/karte/print">印刷</a>
            <a class="btn secondary" href="/animals/{{ $patient->karte_no }}/exam">検査</a>
            <a class="btn secondary" href="/animals/{{ $patient->karte_no }}/dosing/0">投薬</a>
            <a class="btn secondary" href="/animals/{{ $patient->karte_no }}/prevention/0">予防</a>
            <a class="btn secondary" href="/animals/{{ $patient->karte_no }}/papers">書類</a>
        </p>

        @include('clinical._visits', ['visits' => $visits])
    </div>
@endsection
