@extends('layouts.app')

@section('title', '書類 — '.$patient->name_kanji)

@section('content')
    <div class="card" data-testid="screen-papers">
        <h1>書類 — {{ $patient->name_kanji }}（{{ $patient->karte_no }}）</h1>
        <p><small>
            この企画は紙カルテPDFの実ファイル取込をスコープ外としています
            （<a href="/folded/karte_pdf">折りたたみ表示</a>参照）。ここでは題名とメモだけを記録します。
        </small></p>

        @if (!empty($error))
            <div data-testid="error-banner" class="error-banner">{{ $error }}</div>
        @endif
        @if (!empty($success))
            <div data-testid="success-banner" class="success-banner">{{ $success }}</div>
        @endif

        <form method="post" action="/animals/{{ $patient->karte_no }}/papers">
            @csrf
            <p><label>題名 <input name="title"></label></p>
            <p><label>メモ <input name="note"></label></p>
            <button class="button" type="submit">取り込む</button>
        </form>

        <table>
            <thead><tr><th>題名</th><th>メモ</th><th>取込日</th><th></th></tr></thead>
            <tbody>
                @forelse ($papers as $p)
                    <tr data-testid="row-paper">
                        <td><a href="/papers/{{ $p->id }}">{{ $p->title }}</a></td>
                        <td>{{ $p->note }}</td>
                        <td>{{ $p->created_at->toDateString() }}</td>
                        <td>
                            <form method="post" action="/papers/{{ $p->id }}/remove">
                                @csrf
                                <button class="button secondary" type="submit">取消</button>
                            </form>
                        </td>
                    </tr>
                @empty
                    <tr data-testid="empty-papers"><td colspan="4" class="empty">書類はありません。</td></tr>
                @endforelse
            </tbody>
        </table>
    </div>
@endsection
