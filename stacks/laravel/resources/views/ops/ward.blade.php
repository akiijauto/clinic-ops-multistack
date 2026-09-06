@extends('layouts.app')

@section('title', '入院')

@section('content')
    <div class="card" data-testid="screen-ward-day">
        <h1>入院</h1>
        <form method="get" action="/ward">
            <label>基準日 <input type="date" name="date" value="{{ $date }}"></label>
            <button class="button secondary" type="submit">表示する</button>
        </form>
        <p>{{ $date }} 時点</p>
        <table>
            <thead><tr><th>患者</th><th>入院日</th><th>退院日</th><th>処置室</th><th></th></tr></thead>
            <tbody>
                @forelse ($hospitalizations as $h)
                    <tr data-testid="row-hospitalization">
                        <td>
                            @if ($h->patient)
                                <a href="/animals/{{ $h->patient->karte_no }}/karte">{{ $h->patient->name_kanji }}</a>
                            @endif
                        </td>
                        <td>{{ $h->admitted_on?->format('Y-m-d') }}</td>
                        <td>{{ $h->discharged_on?->format('Y-m-d') ?? '入院中' }}</td>
                        <td>{{ $h->room }}</td>
                        <td>
                            @if ($h->patient)
                                <a class="button secondary" href="/animals/{{ $h->patient->karte_no }}/ward">入院記録</a>
                            @endif
                        </td>
                    </tr>
                @empty
                    <tr data-testid="empty-hospitalization"><td colspan="5" class="empty">入院中の患者はいません。</td></tr>
                @endforelse
            </tbody>
        </table>
    </div>
@endsection
