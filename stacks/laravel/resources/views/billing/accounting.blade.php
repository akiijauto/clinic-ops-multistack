@extends('layouts.app')

@section('title', '会計')

@section('content')
    <div class="card" data-testid="screen-accounting">
        <h1>会計</h1>
        <p>{{ $patient->name_kanji }}（{{ $patient->karte_no }}）</p>

        @if ($error)
            <div data-testid="error-banner" class="error-banner">{{ $error }}</div>
        @endif
        @if ($success)
            <div data-testid="success-banner" class="success-banner">{{ $success }}</div>
        @endif

        <p>
            伝票番号: {{ $billing->slip_no !== null ? $billing->slip_no : '（未確定）' }} /
            状態: {{ $billing->status }} / 会計日: {{ $billing->billed_on->toDateString() }}
        </p>

        <table>
            <thead>
                <tr><th>コード</th><th>内容</th><th>単価</th><th>数量</th><th>課税</th><th>金額</th><th></th></tr>
            </thead>
            <tbody>
                @forelse ($billing->details as $d)
                    <tr data-testid="row-billing-detail">
                        <td>{{ $d->price_code }}</td>
                        <td>{{ $d->name }}</td>
                        <td class="num">{{ $d->hasPrice() ? number_format($d->unit_price) : '未設定' }}</td>
                        <td class="num">{{ rtrim(rtrim((string) $d->quantity, '0'), '.') ?: $d->quantity }}</td>
                        <td>{{ $d->is_taxable ? '課税' : '非課税' }}</td>
                        <td class="num">{{ $d->hasPrice() ? number_format($d->quantity * $d->unit_price) : '（未算入）' }}</td>
                        <td>
                            @if ($billing->status !== 'confirmed')
                                <form method="post" action="/animals/{{ $patient->karte_no }}/accounting/details/{{ $d->id }}/remove">
                                    @csrf
                                    <button class="button secondary" type="submit">削除</button>
                                </form>
                            @endif
                        </td>
                    </tr>
                @empty
                    <tr><td colspan="7">明細はありません。</td></tr>
                @endforelse
            </tbody>
        </table>

        <p>
            税抜合計: <strong data-check="billing.net_amount">{{ number_format($totals->netAmount) }}</strong> 円 /
            消費税額: <strong data-check="billing.tax_amount">{{ number_format($totals->taxAmount) }}</strong> 円 /
            税込合計: <strong data-check="billing.total_amount">{{ number_format($totals->totalAmount) }}</strong> 円 /
            未算入の行数: <strong data-check="billing.excluded_count">{{ $totals->excludedDetailCount }}</strong>
        </p>

        @if ($billing->status !== 'confirmed')
            <div class="card">
                <h2>明細を追加</h2>
                <form method="post" action="/animals/{{ $patient->karte_no }}/accounting?slip={{ $billing->id }}">
                    @csrf
                    <select name="price_code">
                        @foreach ($priceCategories as $major => $items)
                            <optgroup label="{{ $major }}">
                                @foreach ($items as $item)
                                    <option value="{{ $item['price_code'] }}">
                                        {{ $item['name'] }}
                                        ({{ $item['unit_price'] !== null ? number_format($item['unit_price']).'円' : '単価未設定' }})
                                    </option>
                                @endforeach
                            </optgroup>
                        @endforeach
                    </select>
                    <input type="number" name="quantity" value="1" min="0.01" step="0.01" style="width:5em">
                    <button class="button" type="submit">追加</button>
                </form>

                <form method="post" action="/animals/{{ $patient->karte_no }}/accounting/{{ $billing->id }}/clear">
                    @csrf
                    <button class="button secondary" type="submit">全削除</button>
                </form>

                <form method="post" action="/animals/{{ $patient->karte_no }}/accounting/{{ $billing->id }}/confirm">
                    @csrf
                    <button class="button" type="submit">確定</button>
                </form>
            </div>
        @else
            <p><em>確定済みのため、明細の追加・削除・全削除はできません。</em></p>
        @endif

        <p><a class="button secondary" href="/animals/{{ $patient->karte_no }}/accounting/history">会計履歴へ</a></p>
    </div>
@endsection
