@extends('layouts.app')

@section('title', '予約')

@section('content')
    <div class="card" data-testid="screen-reservations">
        <h1>予約一覧（{{ $from }} 〜 {{ $to }}）</h1>
        <p><a class="btn" href="/reservations/new">新規予約</a></p>
        <table>
            <thead><tr><th>開始</th><th>終了</th><th>患者</th><th>担当</th><th>処置室</th><th>状態</th><th></th></tr></thead>
            <tbody>
                @forelse ($reservations as $r)
                    <tr data-testid="row-reservation">
                        <td>{{ $r->starts_at->format('Y-m-d H:i') }}</td>
                        <td>{{ $r->ends_at->format('Y-m-d H:i') }}</td>
                        <td>
                            @if ($r->patient)
                                <a href="/animals/{{ $r->patient->karte_no }}/karte">{{ $r->patient->name_kanji }}</a>
                            @endif
                        </td>
                        <td>{{ $r->staff?->name }}</td>
                        <td>{{ $r->room }}</td>
                        <td>{{ $r->status }}</td>
                        <td><a class="btn secondary" href="/reservations/{{ $r->id }}">開く</a></td>
                    </tr>
                @empty
                    <tr data-testid="empty-reservation"><td colspan="7">予約がありません。</td></tr>
                @endforelse
            </tbody>
        </table>
    </div>
@endsection
