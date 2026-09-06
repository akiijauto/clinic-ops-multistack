@extends('layouts.app')

@section('title', '取込')

@section('content')
    <div class="card" data-testid="screen-settings-import">
        <h1>取込</h1>

        @if (!empty($error))
            <div data-testid="error-banner" class="error-banner">{{ $error }}</div>
        @endif
        @if (!empty($success))
            <div data-testid="success-banner" class="success-banner">
                {{ $success }}
                @if (isset($columns))
                    <p>列名: {{ implode(', ', $columns) }} / 行数: {{ $rowCount }}</p>
                @endif
            </div>
        @endif

        <p>この企画の初期データは <code>data/</code> から読み込むだけで、画面からの新規取込は行いません
            （<code>model.md</code>「変わらないもの」）。以下はCSVの列名と件数だけを確認するための
            補助機能です（<strong>内容は保存しません</strong>）。</p>

        <form method="post" action="/settings/import" enctype="multipart/form-data">
            @csrf
            <input type="file" name="file" accept=".csv">
            <button class="button" type="submit">読み取る</button>
        </form>

        <h2>読み込み済みデータの件数</h2>
        <table>
            <thead><tr><th>種類</th><th>DB件数</th><th>種データの件数</th></tr></thead>
            <tbody>
                @foreach ($counts as $label => $n)
                    <tr><td>{{ $label }}</td><td>{{ $n }}</td><td>{{ $seedCounts[$label] }}</td></tr>
                @endforeach
            </tbody>
        </table>
    </div>
@endsection
