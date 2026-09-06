{{--
    カルテの診察一覧（経過記録つき）。通常画面と印刷画面の**両方**がこの部分テンプレートを
    そのまま include する（karte.blade.php / karte_print.blade.php）。
    別々に組み立てると印刷側だけ古い表示が残る食い違い（spec/acceptance.md 検算4）が起きるため。

    data-check の目印は spec/acceptance.md「共通の確認手段」表のとおり。
    行ごとの値をそのまま出す。固定値を書かないこと（検算3）。
--}}
@forelse ($visits as $visit)
    <table data-check-key="visit.id" data-check="visit.{{ $visit->id }}">
        <caption>
            {{ $visit->visit_date?->format('Y-m-d') }}（診察No.{{ $visit->visit_no }}）
            @if ($visit->isDeleted())
                <em>（削除済み）</em>
            @endif
            @if (! empty($interactive))
                <a class="btn secondary" href="/animals/{{ $patient->karte_no }}/karte/{{ $visit->id }}/print">この診察を印刷</a>
                @if ($visit->isDeleted())
                    <form method="post" action="/animals/{{ $patient->karte_no }}/karte/{{ $visit->id }}/restore" style="display:inline">
                        @csrf
                        <button class="btn secondary" type="submit">元に戻す</button>
                    </form>
                @else
                    <form method="post" action="/animals/{{ $patient->karte_no }}/karte/{{ $visit->id }}/delete" style="display:inline">
                        @csrf
                        <input name="reason" placeholder="削除理由（必須）" required>
                        <button class="btn secondary" type="submit">削除</button>
                    </form>
                @endif
            @endif
        </caption>
        <thead>
            <tr>
                <th>行</th>
                <th>体温(℃)</th>
                <th>脈拍</th>
                <th>呼吸数</th>
                <th>体重(kg)</th>
                <th>経過</th>
            </tr>
        </thead>
        <tbody>
            @forelse ($visit->progressNotes as $note)
                <tr data-testid="row-visit">
                    <td>{{ $note->row_no }}</td>
                    <td data-check="progress_note.temperature_c">{{ $note->temperature_c }}</td>
                    <td data-check="progress_note.pulse">{{ $note->pulse }}</td>
                    <td data-check="progress_note.respiration">{{ $note->respiration }}</td>
                    <td data-check="progress_note.body_weight_kg">{{ $note->body_weight_kg }}</td>
                    <td>{{ $note->symptom_course }}</td>
                </tr>
            @empty
                <tr><td colspan="6">経過記録なし</td></tr>
            @endforelse
        </tbody>
    </table>
@empty
    <p>診察記録がありません。</p>
@endforelse
