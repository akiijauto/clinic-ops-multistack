@extends('layouts.app')

@section('title', '新規診察 — '.$patient->name_kanji)

@section('content')
    <div class="card" data-testid="screen-karte">
        <h1>新規診察 — {{ $patient->name_kanji }}（{{ $patient->karte_no }}）</h1>

        @if (!empty($notice))
            <p><small>{{ $notice }}</small></p>
        @endif
        @if (!empty($error))
            <div data-testid="error-banner" class="error-banner">{{ $error }}</div>
        @endif

        <form method="post" action="/animals/{{ $patient->karte_no }}/karte">
            @csrf
            <p><label>来院日 <input type="date" name="visit_date" value="{{ $defaults['visit_date'] ?? '' }}"></label></p>
            <p><label>来院時刻 <input type="time" name="visit_time" value="{{ $defaults['visit_time'] ?? '' }}"></label></p>
            <p><label>体重(kg) <input name="body_weight_kg" value="{{ $defaults['body_weight_kg'] ?? '' }}"></label></p>
            <p><label>主訴 <input name="chief_complaint" value="{{ $defaults['chief_complaint'] ?? '' }}"></label></p>
            <p><label>症状 <input name="symptom" value="{{ $defaults['symptom'] ?? '' }}"></label></p>
            <p><label>病名 <input name="diagnosis" value="{{ $defaults['diagnosis'] ?? '' }}"></label></p>
            <p><label>処置 <input name="treatment" value="{{ $defaults['treatment'] ?? '' }}"></label></p>

            <h2>経過記録（行ごとに入力）</h2>
            @php($rows = $defaults['progress_notes'] ?? [[]])
            @foreach ($rows as $i => $row)
                <fieldset>
                    <legend>行{{ $i + 1 }}</legend>
                    <label>体温(℃) <input name="progress_notes[{{ $i }}][temperature_c]" value="{{ $row['temperature_c'] ?? '' }}"></label>
                    <label>脈拍 <input name="progress_notes[{{ $i }}][pulse]" value="{{ $row['pulse'] ?? '' }}"></label>
                    <label>呼吸数 <input name="progress_notes[{{ $i }}][respiration]" value="{{ $row['respiration'] ?? '' }}"></label>
                    <label>体重(kg) <input name="progress_notes[{{ $i }}][body_weight_kg]" value="{{ $row['body_weight_kg'] ?? '' }}"></label>
                    <label>経過 <input name="progress_notes[{{ $i }}][symptom_course]" value="{{ $row['symptom_course'] ?? '' }}"></label>
                    <label>処方 <input name="progress_notes[{{ $i }}][treatment_rx]" value="{{ $row['treatment_rx'] ?? '' }}"></label>
                </fieldset>
            @endforeach

            <button class="button" type="submit">保存</button>
        </form>

        <form method="post" action="/animals/{{ $patient->karte_no }}/karte/cancel" style="display:inline">
            @csrf
            <button class="button secondary" type="submit">取消</button>
        </form>

        <p><a class="button secondary" href="/animals/{{ $patient->karte_no }}/karte">カルテへ戻る</a></p>
    </div>
@endsection
