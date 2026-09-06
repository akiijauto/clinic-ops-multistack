@extends('layouts.app')

@section('title', 'マスタ')

@section('content')
    <div class="card" data-testid="screen-settings-master">
        <h1>マスタ（参照専用。編集はできません）</h1>

        <p>
            @foreach ($keys as $k)
                <a class="btn {{ $k === $key ? '' : 'secondary' }}" href="/settings/master/{{ $k }}">{{ $k }}</a>
            @endforeach
        </p>

        <table>
            <tbody>
                @foreach ($rows as $row)
                    <tr data-testid="row-master">
                        <td><pre style="margin:0">{{ json_encode($row, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT) }}</pre></td>
                    </tr>
                @endforeach
            </tbody>
        </table>
    </div>
@endsection
