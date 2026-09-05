@extends('layouts.app')

@section('title', '検索')

@section('content')
    <div class="card" data-testid="screen-search">
        <h1>検索</h1>
        <form method="get" action="/search">
            <input type="text" name="q" value="{{ $q }}" placeholder="飼主名・カナ・カルテNo">
            <button class="btn" type="submit">検索</button>
        </form>
        <table>
            <thead><tr><th>カルテNo</th><th>患者名</th><th>飼主名</th></tr></thead>
            <tbody>
                @forelse ($patients as $p)
                    <tr data-testid="row-patient">
                        <td>{{ $p->karte_no }}</td>
                        <td><a href="/animals/{{ $p->karte_no }}/karte">{{ $p->name_kanji }}</a></td>
                        <td>{{ $p->owner?->name_kanji }}</td>
                    </tr>
                @empty
                    <tr data-testid="empty-search"><td colspan="3">該当する患者がいません。</td></tr>
                @endforelse
            </tbody>
        </table>
    </div>
@endsection
