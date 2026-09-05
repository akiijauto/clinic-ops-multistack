@extends('layouts.app')

@section('title', '設定')

@section('content')
    <div class="card" data-testid="screen-settings">
        <h1>病院設定</h1>
        <table>
            <tbody>
                <tr><th>名称</th><td>{{ $clinic->name }}</td></tr>
                <tr><th>電話</th><td>{{ $clinic->phone }}</td></tr>
                <tr><th>住所</th><td>{{ $clinic->address1 }}{{ $clinic->address2 }}</td></tr>
                <tr><th>消費税率</th><td>{{ $clinic->tax_rate }}</td></tr>
                <tr><th>予約枠(分)</th><td>{{ $clinic->reservation_slot_minutes }}</td></tr>
            </tbody>
        </table>
    </div>
@endsection
