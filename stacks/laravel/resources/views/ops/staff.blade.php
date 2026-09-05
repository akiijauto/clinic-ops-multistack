@extends('layouts.app')

@section('title', 'スタッフ')

@section('content')
    <div class="card" data-testid="screen-staff">
        <h1>スタッフ</h1>
        <table>
            <thead><tr><th>コード</th><th>氏名</th><th>役割</th><th>状態</th></tr></thead>
            <tbody>
                @foreach ($staffList as $s)
                    <tr data-testid="row-staff">
                        <td>{{ $s->staff_code }}</td>
                        <td>{{ $s->name }}</td>
                        <td>{{ $s->role }}</td>
                        <td>{{ $s->is_active ? '在籍' : '退職' }}</td>
                    </tr>
                @endforeach
            </tbody>
        </table>
    </div>
@endsection
