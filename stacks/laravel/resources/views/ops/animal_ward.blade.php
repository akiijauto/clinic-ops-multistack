@extends('layouts.app')

@section('title', '入院')

@section('content')
    <div class="card" data-testid="screen-ward">
        <h1>入院</h1>
        <p>{{ $patient->name_kanji }}（{{ $patient->karte_no }}）</p>

        @if (!empty($error))
            <div data-testid="error-banner" class="error-banner">{{ $error }}</div>
        @endif
        @if (!empty($success))
            <div data-testid="success-banner" class="success-banner">{{ $success }}</div>
        @endif

        <div class="card">
            <h2>入院を開始する</h2>
            <form method="post" action="/animals/{{ $patient->karte_no }}/ward">
                @csrf
                <label>入院日 <input type="date" name="admitted_on"></label>
                <label>処置室 <input name="room" placeholder="入院室1"></label>
                <button class="button" type="submit">開始</button>
            </form>
        </div>

        @forelse ($hospitalizations as $h)
            <div class="card">
                <h3>
                    {{ $h->admitted_on->toDateString() }} 〜
                    {{ optional($h->discharged_on)->toDateString() ?? '入院中' }}
                    （{{ $h->room }}）
                </h3>

                <table>
                    <thead><tr><th>日時</th><th>種別</th><th>内容</th><th>実施者</th></tr></thead>
                    <tbody>
                        @forelse ($h->careRecords as $c)
                            <tr data-testid="row-care-record">
                                <td>{{ $c->recorded_at->format('Y-m-d H:i') }}</td>
                                <td>{{ $c->category }}</td>
                                <td>{{ $c->content }}</td>
                                <td data-check="care_record.performed_by">{{ $c->performedBy?->name }}</td>
                            </tr>
                        @empty
                            <tr data-testid="empty-care-record"><td colspan="4" class="empty">記録はありません。</td></tr>
                        @endforelse
                    </tbody>
                </table>

                @if ($h->isOngoing())
                    <form method="post" action="/animals/{{ $patient->karte_no }}/ward/{{ $h->id }}/care-records">
                        @csrf
                        <select name="category">
                            <option value="medication">投薬</option>
                            <option value="feeding">給餌</option>
                            <option value="measurement">計測</option>
                        </select>
                        <input name="content" placeholder="内容">
                        <select name="performed_by_staff_id">
                            <option value="">実施者を選ぶ</option>
                            @foreach (\App\Models\Staff::where('is_active', true)->get() as $s)
                                <option value="{{ $s->id }}">{{ $s->name }}</option>
                            @endforeach
                        </select>
                        <button class="button secondary" type="submit">記録を追加</button>
                    </form>

                    <form method="post" action="/animals/{{ $patient->karte_no }}/ward/{{ $h->id }}/discharge">
                        @csrf
                        <label>退院日 <input type="date" name="discharged_on"></label>
                        <button class="button secondary" type="submit">退院にする</button>
                    </form>
                @endif
            </div>
        @empty
            <p>入院記録はありません。</p>
        @endforelse
    </div>
@endsection
