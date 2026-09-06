@extends('layouts.app')

@section('title', 'スタッフ')

@section('content')
    <div class="card" data-testid="screen-staff">
        <h1>スタッフ</h1>

        <p>
            いま選ばれている担当:
            <strong data-testid="current-staff">{{ $current?->name ?? '未選択' }}</strong>
            @if ($current)
                <form method="post" action="/staff/clear" style="display:inline">
                    @csrf
                    <button class="button secondary" type="submit">担当を外す</button>
                </form>
            @endif
        </p>

        <table>
            <thead><tr><th>コード</th><th>氏名</th><th>役割</th><th>状態</th><th></th></tr></thead>
            <tbody>
                @foreach ($staffList as $s)
                    <tr data-testid="row-staff">
                        <td>{{ $s->staff_code }}</td>
                        <td>{{ $s->name }}</td>
                        <td>{{ $s->role }}</td>
                        <td>{{ $s->is_active ? '在籍' : '退職' }}</td>
                        <td>
                            @if ($current?->id === $s->id)
                                選択中
                            @else
                                <form method="post" action="/staff/{{ $s->id }}/select" style="display:inline">
                                    @csrf
                                    <button class="button secondary" type="submit">選ぶ</button>
                                </form>
                            @endif
                        </td>
                    </tr>
                @endforeach
            </tbody>
        </table>
    </div>
@endsection
