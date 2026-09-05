@extends('layouts.app')

@section('title', 'トップ')

@section('content')
    <div class="card" data-testid="screen-top">
        <h1>トップ</h1>
        <p>本日の受付件数: {{ $todayCount }}</p>
        <p>上のナビから各画面へ移動してください。</p>
    </div>
@endsection
