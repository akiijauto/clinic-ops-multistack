@extends('layouts.app')

@section('title', '本日の患者')

@section('content')
    <div class="card" data-testid="screen-today">
        <h1>本日の患者</h1>

        <p>
            完了件数（表示中）: {{ $receptions->where('status', 'done')->count() }}　/
            対象日の診察件数: <strong data-check="visit_count.today">{{ $visitCountToday }}</strong>
        </p>

        <p>
            <a class="button secondary" href="/today{{ $hideDone ? '' : '?hide=1' }}">
                {{ $hideDone ? '完了行も表示する' : '完了行を隠す' }}
            </a>
            <a class="button disabled" href="/todo/today_complete_delete_all">完了全削除</a>
            <a class="button disabled" href="/todo/today_complete_delete_one">完了削除</a>
            <a class="button disabled" href="/folded/hospital_division">分院</a>
        </p>

        <table>
            <thead>
                <tr>
                    <th>受付No</th><th>飼主</th><th>品種</th><th>動物</th>
                    <th>受付日時</th><th>オーナー目的</th><th>診療目的</th><th>状況</th><th>操作</th>
                </tr>
            </thead>
            <tbody>
                @forelse ($receptions as $r)
                    <tr data-testid="row-reception">
                        <td>{{ $r->display_no }}</td>
                        <td>{{ $r->patient?->owner?->name_kanji }}</td>
                        <td>{{ $r->patient?->breed }}</td>
                        <td>
                            @if ($r->patient)
                                <a href="/animals/{{ $r->patient->karte_no }}">{{ $r->patient->name_kanji }}</a>
                            @endif
                        </td>
                        <td>{{ optional($r->received_at)->format('H:i') }}</td>
                        <td>{{ $r->owner_purpose }}</td>
                        <td>{{ $r->medical_purpose }}</td>
                        <td>{{ $r->status }}</td>
                        <td>
                            @if ($r->patient)
                                <a class="button secondary" href="/animals/{{ $r->patient->karte_no }}/karte">カルテ</a>
                                <a class="button secondary" href="/animals/{{ $r->patient->karte_no }}/accounting">会計</a>
                            @endif
                        </td>
                    </tr>
                @empty
                    <tr data-testid="empty-reception"><td colspan="9" class="empty">本日の受付はありません。</td></tr>
                @endforelse
            </tbody>
        </table>
    </div>
@endsection
