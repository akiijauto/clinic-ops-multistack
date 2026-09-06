@extends('layouts.app')

@section('title', '予防 — '.$patient->name_kanji)

@section('content')
    <div class="card" data-testid="screen-prevention">
        <h1>予防（{{ $kindName }}） — {{ $patient->name_kanji }}（{{ $patient->karte_no }}）</h1>

        @if (!empty($error))
            <div data-testid="error-banner">{{ $error }}</div>
        @endif
        @if (!empty($success))
            <div data-testid="success-banner">{{ $success }}</div>
        @endif

        <form method="post" action="/animals/{{ $patient->karte_no }}/prevention/{{ $kindId }}">
            @csrf
            <p><label>実施内容 <input name="content"></label></p>
            <p><label>実施日 <input type="date" name="performed_date"></label></p>
            <p><label>次回予定日（空可） <input type="date" name="next_due_date"></label></p>
            <button class="btn" type="submit">保存</button>
        </form>

        <table>
            <thead><tr><th>実施日</th><th>内容</th><th>次回予定日</th></tr></thead>
            <tbody>
                @forelse ($rows as $r)
                    <tr data-testid="row-prevention">
                        <td>{{ optional($r->performed_date)->toDateString() }}</td>
                        <td>{{ $r->content }}</td>
                        <td>{{ optional($r->next_due_date)->toDateString() }}</td>
                    </tr>
                @empty
                    <tr data-testid="empty-prevention"><td colspan="3">実施記録はありません。</td></tr>
                @endforelse
            </tbody>
        </table>
    </div>
@endsection
