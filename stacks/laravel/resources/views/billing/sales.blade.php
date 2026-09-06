@extends('layouts.app')

@section('title', '売上集計')

@section('content')
    <div class="card" data-testid="screen-sales">
        <h1>売上集計</h1>
        <p>税抜合計: {{ number_format($summary['total_net_amount']) }} 円</p>
        <h2>分類別</h2>
        <table>
            <thead><tr><th>分類</th><th>金額</th><th>構成比</th></tr></thead>
            <tbody>
                @foreach ($summary['by_category'] as $row)
                    <tr data-testid="row-sales-category">
                        <td>{{ $row['category'] }}</td>
                        <td class="num">{{ number_format($row['net_amount']) }}</td>
                        <td class="num">{{ $row['share_pct'] }}%</td>
                    </tr>
                @endforeach
            </tbody>
        </table>
    </div>
@endsection
