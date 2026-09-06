@extends('layouts.app')

@section('title', '投薬 — '.$patient->name_kanji)

@section('content')
    <div class="card" data-testid="screen-dosing">
        <h1>投薬（{{ $kindName }}） — {{ $patient->name_kanji }}（{{ $patient->karte_no }}）</h1>

        @if (!empty($error))
            <div data-testid="error-banner">{{ $error }}</div>
        @endif
        @if (!empty($success))
            <div data-testid="success-banner">{{ $success }}</div>
        @endif

        <form method="get" action="/animals/{{ $patient->karte_no }}/dosing/{{ $kindId }}">
            <label>年度 <input type="number" name="fiscal_year" value="{{ $fiscalYear }}"></label>
            <button class="btn secondary" type="submit">表示</button>
        </form>

        <form method="post" action="/animals/{{ $patient->karte_no }}/dosing/{{ $kindId }}">
            @csrf
            <input type="hidden" name="fiscal_year" value="{{ $fiscalYear }}">
            <table>
                <thead>
                    <tr>
                        @foreach (range(1, 12) as $m)
                            <th>{{ $m }}月</th>
                        @endforeach
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        @foreach (range(1, 12) as $m)
                            @php($key = sprintf('m%02d', $m))
                            <td>
                                <label>
                                    <input type="checkbox" name="months[{{ $key }}]"
                                        @checked($current && $current->{$key} === '○')>
                                </label>
                            </td>
                        @endforeach
                    </tr>
                </tbody>
            </table>
            <button class="btn" type="submit">保存</button>
        </form>

        <h2>過去の年度</h2>
        <table>
            <thead><tr><th>年度</th>@foreach (range(1,12) as $m)<th>{{ $m }}</th>@endforeach</tr></thead>
            <tbody>
                @foreach ($rows as $r)
                    <tr>
                        <td>{{ $r->fiscal_year }}</td>
                        @foreach (range(1,12) as $m)
                            @php($key = sprintf('m%02d', $m))
                            <td>{{ $r->{$key} }}</td>
                        @endforeach
                    </tr>
                @endforeach
            </tbody>
        </table>
    </div>
@endsection
