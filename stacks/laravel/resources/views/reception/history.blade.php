@extends('layouts.app')

@section('title', '来院履歴')

@section('content')
    <div class="card" data-testid="screen-history">
        <h1>来院履歴</h1>
        <p>{{ $patient->name_kanji }}（{{ $patient->karte_no }}）</p>

        @if (!empty($restored))
            <div data-testid="success-banner" class="success-banner">元に戻しました。</div>
        @endif

        <table>
            <thead>
                <tr><th>診察No</th><th>来院日</th><th>診療目的</th><th>病名</th><th>状態</th><th>操作</th></tr>
            </thead>
            <tbody>
                @forelse ($visits as $v)
                    <tr data-testid="row-visit">
                        <td>{{ $v->visit_no }}</td>
                        <td>{{ optional($v->visit_date)->toDateString() }}</td>
                        <td>{{ $v->chief_complaint }}</td>
                        <td>{{ $v->diagnosis }}</td>
                        <td>{{ $v->isDeleted() ? '削除済み' : '通常' }}</td>
                        <td>
                            @if ($v->isDeleted())
                                <form method="post" action="/animals/{{ $patient->karte_no }}/karte/{{ $v->id }}/restore" style="display:inline">
                                    @csrf
                                    <button class="button secondary" type="submit">元に戻す</button>
                                </form>
                            @endif
                        </td>
                    </tr>
                @empty
                    <tr data-testid="empty-history"><td colspan="6" class="empty">来院履歴はありません。</td></tr>
                @endforelse
            </tbody>
        </table>
    </div>
@endsection
