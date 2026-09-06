@extends('layouts.app')

@section('title', '機能設定')

@section('content')
    <div class="card" data-testid="screen-settings-features">
        <h1>機能設定 — この企画でスコープに入れなかった機能</h1>
        <p>読むだけです。機能の出し入れは提供しません
            （<code>ClinicFeature</code> は <code>model.md</code> で落としたモデルです）。</p>

        <table>
            <thead><tr><th>機能</th><th>理由</th><th></th></tr></thead>
            <tbody>
                @foreach ($folded as $key => $item)
                    <tr data-testid="row-feature">
                        <td>{{ $item['title'] }}</td>
                        <td>{{ $item['message'] }}</td>
                        <td><a class="button secondary" href="/folded/{{ $key }}">折りたたみ表示で見る</a></td>
                    </tr>
                @endforeach
                @foreach ($todo as $key => $item)
                    <tr data-testid="row-feature">
                        <td>{{ $item['title'] }}</td>
                        <td>{{ $item['message'] }}</td>
                        <td><a class="button secondary" href="/todo/{{ $key }}">ToDoで見る</a></td>
                    </tr>
                @endforeach
            </tbody>
        </table>
    </div>
@endsection
