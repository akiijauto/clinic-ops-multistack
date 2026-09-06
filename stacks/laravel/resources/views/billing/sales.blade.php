@extends('layouts.app')

@section('title', '売上集計')

@section('content')
    <div class="card" data-testid="screen-sales">
        <h1>売上集計</h1>

        <form method="get" action="/sales">
            <label>開始日 <input type="date" name="from" value="{{ $from }}"></label>
            <label>終了日 <input type="date" name="to" value="{{ $to }}"></label>
            <button class="button" type="submit">集計する</button>
        </form>

        <p>
            税抜合計: <strong data-testid="sales-total" data-check="sales_summary.total_net_amount">{{ number_format($summary['total_net_amount']) }}</strong> 円 /
            未算入の行数: <strong data-testid="sales-excluded-count">{{ $summary['excluded_detail_count_total'] }}</strong>
        </p>

        <h2>分類別</h2>
        <table>
            <thead><tr><th>分類</th><th>金額</th><th>構成比</th></tr></thead>
            <tbody>
                @forelse ($summary['by_category'] as $row)
                    <tr data-testid="row-sales">
                        <td>{{ $row['category'] }}</td>
                        <td class="num" data-check="sales_summary.net_amount">{{ number_format($row['net_amount']) }}</td>
                        <td class="num" data-check="sales_summary.share_pct">{{ $row['share_pct'] }}%</td>
                    </tr>
                @empty
                    <tr data-testid="empty-sales-category"><td colspan="3" class="empty">対象がありません。</td></tr>
                @endforelse
            </tbody>
        </table>

        <h2>担当別</h2>
        <table>
            <thead><tr><th>担当</th><th>金額</th></tr></thead>
            <tbody>
                @forelse ($summary['by_staff'] as $row)
                    <tr data-testid="row-sales">
                        <td>{{ $staffNames[$row['staff_id']] ?? '（担当未設定）' }}</td>
                        <td class="num" data-check="sales_summary.net_amount">{{ number_format($row['net_amount']) }}</td>
                    </tr>
                @empty
                    <tr data-testid="empty-sales-staff"><td colspan="2" class="empty">対象がありません。</td></tr>
                @endforelse
            </tbody>
        </table>

        <h2>日別</h2>
        <table>
            <thead><tr><th>日付</th><th>金額</th></tr></thead>
            <tbody>
                @forelse ($summary['by_date'] as $row)
                    <tr data-testid="row-sales">
                        <td>{{ $row['date'] ?? $row['period'] }}</td>
                        <td class="num" data-check="sales_summary.net_amount">{{ number_format($row['net_amount']) }}</td>
                    </tr>
                @empty
                    <tr data-testid="empty-sales-date"><td colspan="2" class="empty">対象がありません。</td></tr>
                @endforelse
            </tbody>
        </table>
    </div>
@endsection
