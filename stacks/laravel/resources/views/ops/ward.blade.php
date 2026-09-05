@extends('layouts.app')

@section('title', '入院')

@section('content')
    <div class="card" data-testid="screen-ward-day">
        <h1>入院（{{ $date }} 時点）</h1>
        <table>
            <thead><tr><th>患者</th><th>入院日</th><th>退院日</th><th>処置室</th></tr></thead>
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
                    </tr>
                @empty
                    <tr data-testid="empty-hospitalization"><td colspan="4">入院中の患者はいません。</td></tr>
                @endforelse
            </tbody>
        </table>
    </div>
@endsection
