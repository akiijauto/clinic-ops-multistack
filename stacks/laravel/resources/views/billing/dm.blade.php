@extends('layouts.app')

@section('title', 'DM管理')

@section('content')
    <div class="card" data-testid="screen-dm">
        <h1>DM管理</h1>

        <form method="get" action="/dm">
            <label>区分
                <select name="type">
                    <option value="">すべて</option>
                    @foreach ($kinds as $i => $k)
                        <option value="{{ $i }}" @selected((string) $type === (string) $i)>{{ $k['name'] }}</option>
                    @endforeach
                </select>
            </label>
            <label>期間から <input type="date" name="from" value="{{ $from }}"></label>
            <label>まで <input type="date" name="to" value="{{ $to }}"></label>
            <button class="btn secondary" type="submit">絞り込む</button>
        </form>

        <p>件数: {{ $rows->count() }} / <a class="btn secondary" href="/dm.csv?{{ http_build_query(request()->query()) }}">CSVへ書き出す</a></p>

        <table>
            <thead><tr><th>患者</th><th>飼主</th><th>区分</th><th>次回予定</th></tr></thead>
            <tbody>
                @forelse ($rows as $r)
                    <tr data-testid="row-dm">
                        <td>
                            @if ($r->patient)
                                <a href="/animals/{{ $r->patient->karte_no }}/karte">{{ $r->patient->name_kanji }}</a>
                            @endif
                        </td>
                        <td>{{ $r->patient?->owner?->name_kanji }}</td>
                        <td>{{ $r->kind }}</td>
                        <td>{{ $r->next_due_date?->format('Y-m-d') }}</td>
                    </tr>
                @empty
                    <tr data-testid="empty-dm"><td colspan="4">対象がありません。</td></tr>
                @endforelse
            </tbody>
        </table>
    </div>
@endsection
