@extends('layouts.app')

@section('title', 'カルテ - ' . $patient->name_kanji)

@section('content')
    <div class="card" data-testid="screen-karte">
        <h1>カルテ — {{ $patient->name_kanji }}（{{ $patient->karte_no }}）</h1>
        @include('clinical._visits', ['visits' => $visits])
    </div>
@endsection
