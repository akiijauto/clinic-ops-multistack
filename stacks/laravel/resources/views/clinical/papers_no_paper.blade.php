@extends('layouts.app')

@section('title', '書類（無し）')

@section('content')
    <div class="card" data-testid="screen-papers-no-paper">
        <h1>書類</h1>
        <p>この動物には紙カルテがもともと存在しません。</p>
        <p><a class="btn secondary" href="/today">本日の患者へ戻る</a></p>
    </div>
@endsection
