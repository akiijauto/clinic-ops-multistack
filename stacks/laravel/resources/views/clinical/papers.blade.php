@extends('layouts.app')

@section('title', '書類')

@section('content')
    <div class="card" data-testid="screen-papers">
        <h1>書類</h1>
        <p>{{ $patient->name_kanji }}（{{ $patient->karte_no }}）</p>
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

        {{--
            「取り込んでいない（0件）」と「元から無い」は一覧だけでは区別が付かない
            （どちらも空に見える）ため、専用の印を付ける・外す入口を置く（画面13）。
        --}}
        <p data-testid="no-paper-status">
            @if ($patient->no_paper)
                この動物の紙カルテは<strong>元から無い</strong>という印が付いています。
            @else
                紙カルテが元から無いという印は付いていません。
            @endif
        </p>
        <form method="post" action="/animals/{{ $patient->karte_no }}/papers/no-paper" style="display:inline">
            @csrf
            <button class="button secondary" type="submit" data-testid="no-paper-toggle">
                {{ $patient->no_paper ? '印を外す' : '「紙カルテは元から無い」の印を付ける' }}
            </button>
        </form>

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
