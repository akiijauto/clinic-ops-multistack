@extends('layouts.app')

@section('title', '検査 — '.$patient->name_kanji)

@section('content')
    <div class="card" data-testid="screen-exam">
        <h1>検査 — {{ $patient->name_kanji }}（{{ $patient->karte_no }}）</h1>

        @if (!empty($error))
            <div data-testid="error-banner" class="error-banner">{{ $error }}</div>
        @endif
        @if (!empty($success))
            <div data-testid="success-banner" class="success-banner">{{ $success }}</div>
        @endif

        <p><a class="button secondary" href="/animals/{{ $patient->karte_no }}/accounting">会計</a></p>

        <div class="card">
            <h2>新しい検査を記録する</h2>
            <form method="post" action="/animals/{{ $patient->karte_no }}/exam">
                @csrf
                <p><label>検査カテゴリ <input name="category" value="一般検査"></label></p>
                <table>
                    <thead><tr><th>項目</th><th>基準値</th><th>単位</th><th>結果</th></tr></thead>
                    <tbody>
                        @foreach ($labItems as $li)
                            <tr>
                                <td>{{ $li['name'] }}</td>
                                <td>
                                    @php($range = collect($li['reference_ranges'])->firstWhere('species', in_array($patient->species, ['dog','cat']) ? $patient->species : 'other'))
                                    @if ($range)
                                        {{ $range['low'] }} 〜 {{ $range['high'] }}
                                    @endif
                                </td>
                                <td>{{ $li['unit'] }}</td>
                                <td><input name="items[{{ $li['item_code'] }}]"></td>
                            </tr>
                        @endforeach
                    </tbody>
                </table>
                <button class="button" type="submit">保存</button>
            </form>
        </div>

        @foreach ($tests as $test)
            <div class="card">
                <h3>{{ $test->tested_on->toDateString() }} — {{ $test->category }}</h3>
                <table>
                    <thead><tr><th>項目</th><th>基準値</th><th>単位</th><th>結果</th><th>判定</th></tr></thead>
                    <tbody>
                        @foreach ($labItems as $li)
                            @php($item = $test->items->firstWhere('item_code', $li['item_code']))
                            @php($judgment = $item ? \App\Http\Controllers\Clinical\ExamController::judge($item, $patient) : null)
                            <tr>
                                <td>{{ $li['name'] }}</td>
                                <td>
                                    @php($range = collect($li['reference_ranges'])->firstWhere('species', in_array($patient->species, ['dog','cat']) ? $patient->species : 'other'))
                                    @if ($range)
                                        {{ $range['low'] }} 〜 {{ $range['high'] }}
                                    @endif
                                </td>
                                <td>{{ $li['unit'] }}</td>
                                <td data-check="lab_test_item.value">{{ $item?->value_text ?? $item?->value_num }}</td>
                                <td
                                    data-check="lab_test_item.judgment"
                                    data-check-flag="{{ $judgment?->flag() ?? 'normal' }}"
                                    @class([
                                        'out-of-range' => in_array($judgment?->judgement, ['high', 'low'], true),
                                    ])
                                >{{ $judgment?->label() }}</td>
                            </tr>
                        @endforeach
                    </tbody>
                </table>
            </div>
        @endforeach
    </div>
@endsection
