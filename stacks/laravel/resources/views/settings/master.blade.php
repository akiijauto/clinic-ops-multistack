@extends('layouts.app')

@section('title', 'マスタ')

@section('content')
    <div class="card" data-testid="screen-settings-master">
        <h1>マスタ（参照専用。編集はできません）</h1>

        <p>
            @foreach ($keys as $k)
                <a class="button {{ $k === $key ? '' : 'secondary' }}" href="/settings/master/{{ $k }}">{{ $k }}</a>
            @endforeach
        </p>

        <table>
            <thead>
                <tr>
                    @foreach ($labels as $label)
                        <th>{{ $label }}</th>
                    @endforeach
                </tr>
            </thead>
            <tbody>
                @forelse ($cells as $row)
                    <tr data-testid="row-master">
                        @foreach ($row as $value)
                            <td>{{ $value }}</td>
                        @endforeach
                    </tr>
                @empty
                    <tr data-testid="empty-master"><td class="empty">データがありません。</td></tr>
                @endforelse
            </tbody>
        </table>
    </div>
@endsection
