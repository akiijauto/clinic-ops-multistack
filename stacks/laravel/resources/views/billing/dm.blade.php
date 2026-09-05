@extends('layouts.app')

@section('title', 'DM管理')

@section('content')
    <div class="card" data-testid="screen-dm">
        <h1>DM管理</h1>
        <table>
            <thead><tr><th>患者</th><th>飼主</th><th>区分</th><th>次回予定</th></tr></thead>
            <tbody>
                @forelse ($rows as $r)
                    <tr data-testid="row-dm">
                        <td>
                            @if ($r->patient)
                                <a href="{{ url('/animals/'.$r->patient->karte_no.'/karte') }}">{{ $r->patient->name_kanji }}</a>
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
