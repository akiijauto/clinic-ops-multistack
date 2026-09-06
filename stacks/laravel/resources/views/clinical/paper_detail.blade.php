@extends('layouts.app')

@section('title', $paper->title)

@section('content')
    <div class="card" data-testid="screen-paper-detail">
        <h1>{{ $paper->title }}</h1>
        <p>{{ $paper->note }}</p>
        <p>取込日: {{ $paper->created_at->toDateString() }}</p>
        <p><a class="btn secondary" href="/animals/{{ $paper->patient->karte_no }}/papers">一覧へ戻る</a></p>
    </div>
@endsection
