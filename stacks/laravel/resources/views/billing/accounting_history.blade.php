@extends('layouts.app')

@section('title', '会計履歴 — '.$patient->name_kanji)

@section('content')
    <div class="card" data-testid="screen-accounting-history">
        <h1>会計履歴 — {{ $patient->name_kanji }}（{{ $patient->karte_no }}）</h1>

        <p>
            範囲:
            <a class="btn {{ $scope === 'patient' ? '' : 'secondary' }}" href="?scope=patient">動物</a>
            <a class="btn {{ $scope === 'owner' ? '' : 'secondary' }}" href="?scope=owner">飼主</a>
            <a class="btn {{ $scope === 'all' ? '' : 'secondary' }}" href="?scope=all">全体</a>
        </p>

        <table>
            <thead>
                <tr>
                    <th>伝票No</th><th>会計日</th><th>状態</th><th>患者</th>
                    <th>税抜</th><th>消費税</th><th>税込</th><th>未算入</th><th></th>
                </tr>
            </thead>
            <tbody>
                @forelse ($rows as $row)
                    @php($b = $row['billing'])
                    @php($t = $row['totals'])
                    <tr data-testid="row-billing" @if($b->patient_id === $patient->id) style="font-weight:bold" @endif>
                        <td>{{ $b->slip_no !== null ? $b->slip_no : '（未確定）' }}</td>
                        <td>{{ $b->billed_on->toDateString() }}</td>
                        <td>{{ $b->status }}</td>
                        <td>{{ $b->patient?->name_kanji }}</td>
                        <td data-check="billing.net_amount">{{ number_format($t->netAmount) }}</td>
                        <td data-check="billing.tax_amount">{{ number_format($t->taxAmount) }}</td>
                        <td data-check="billing.total_amount">{{ number_format($t->totalAmount) }}</td>
                        <td data-check="billing.excluded_count">{{ $t->excludedDetailCount }}</td>
                        <td>
                            @if ($b->patient)
                                <a class="btn secondary" href="/animals/{{ $b->patient->karte_no }}/accounting?slip={{ $b->id }}">開く</a>
                            @endif
                        </td>
                    </tr>
                @empty
                    <tr data-testid="empty-accounting-history"><td colspan="9">伝票はありません。</td></tr>
                @endforelse
            </tbody>
        </table>
    </div>
@endsection
