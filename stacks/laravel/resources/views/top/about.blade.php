@extends('layouts.app')

@section('title', 'このシステムについて')

@section('content')
    <div class="card" data-testid="screen-about">
        <h1>このシステムについて</h1>
        <p>clinic-ops-multistack（Laravel実装）。動物病院の窓口業務を模したデモです。</p>
        <p>この画面はDBに繋がらなくても開けます（データを参照しません）。</p>
    </div>
@endsection
