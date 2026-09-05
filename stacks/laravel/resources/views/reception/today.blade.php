@extends('layouts.app')

@section('title', '本日の患者')

@section('content')
    <div class="card" data-testid="screen-today">
        <h1>本日の患者</h1>
        <p data-check="visit_count.today">{{ $receptions->count() }}</p>
        <table>
            <thead>
                <tr><th>受付No</th><th>患者</th><th>区分</th><th>状態</th></tr>
            </thead>
            <tbody>
                @forelse ($receptions as $r)
                    <tr data-testid="row-reception">
                        <td>{{ $r->display_no }}</td>
                        <td>
                            @if ($r->patient)
                                <a href="/animals/{{ $r->patient->karte_no }}/karte">{{ $r->patient->name_kanji }}</a>
                            @endif
                        </td>
                        <td>{{ $r->medical_purpose ?? $r->owner_purpose }}</td>
                        <td>{{ $r->status }}</td>
                    </tr>
                @empty
                    <tr data-testid="empty-reception"><td colspan="4">本日の受付はありません。</td></tr>
                @endforelse
            </tbody>
        </table>
    </div>
@endsection
