@extends('layouts.app')

@section('title', 'ToDo')

@section('content')
    <div class="card" data-testid="screen-todo">
        <h1>{{ $item['title'] }}</h1>
        <p>{{ $item['message'] }}</p>
        <p><a class="btn" href="/today">本日の患者へ戻る</a></p>
    </div>
@endsection
